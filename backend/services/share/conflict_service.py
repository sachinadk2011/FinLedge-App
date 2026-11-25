"""Snapshot-gated conflict decisions for Share/SIP/dividend imports."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from typing import Literal

from backend.db.imports.share.models import ShareConflictResolutionReport, ShareMergeRow
from backend.db.repositories import DividendRepository, ShareRepository, SipRepository
from backend.db.share import rebuild_share_holdings
from backend.db.sip import rebuild_sip_plan_summaries
from backend.services.common import resolve_import_record_conflict


ConflictDecision = Literal["keep_local", "keep_incoming"]


def resolve_share_import_conflict(
    connection: sqlite3.Connection,
    review: ShareMergeRow,
    *,
    decision: ConflictDecision,
    device: str,
    before_import_snapshot: Callable[[], object] | None = None,
) -> ShareConflictResolutionReport:
    """Persist an explicit conflict winner and dependent summaries atomically."""
    row_id = review.resolved_row_id
    if review.classification != "conflict" or not row_id:
        raise ValueError("Only a resolved Share event conflict can use this decision path")
    existing = review.existing_record
    if not existing or "content_hash" not in existing:
        raise ValueError("Newer deletion conflicts require a separate explicit restore review")
    staged = review.staged
    entity = staged.entity_type
    if entity not in {"share", "sip", "dividend"} or staged.status != "ready":
        raise ValueError("The staged Share event is not ready for conflict resolution")
    if staged.event_type != existing.get("transaction_type", existing.get("event_type")):
        raise ValueError("Event type is immutable; this conflict needs a separate event replacement review")

    repositories = {
        "share": ShareRepository(connection),
        "sip": SipRepository(connection),
        "dividend": DividendRepository(connection),
    }
    repository = repositories[entity]
    incoming = _incoming_values(connection, staged, existing, row_id)
    if repository.canonical_content_hash(incoming) != staged.content_hash:
        raise ValueError("Incoming Share event hash does not match its canonical values")
    update_values = _mutable_values(entity, incoming)

    def rebuild_summaries() -> None:
        rebuild_share_holdings(connection, device=device)
        rebuild_sip_plan_summaries(connection, device=device)

    result = resolve_import_record_conflict(
        connection,
        repository,
        row_id=row_id,
        entity_type=entity,
        expected_content_hash=str(existing["content_hash"]),
        incoming_values=incoming,
        update_values=update_values,
        decision=decision,
        device=device,
        before_import_snapshot=before_import_snapshot,
        after_incoming_update=rebuild_summaries,
    )
    return ShareConflictResolutionReport(
        row_id=row_id,
        conflict_id=result.conflict_id,
        resolution=result.resolution,
        row_updated=result.row_updated,
    )


def _incoming_values(connection, staged, existing, row_id: str) -> dict[str, object]:
    if not staged.txn_date or not staged.event_type or not staged.content_hash:
        raise ValueError("Incoming Share event is missing a canonical date, type or hash")
    values: dict[str, object] = {
        "row_id": row_id,
        "sequence_no": int(existing["sequence_no"]),
        "txn_date": staged.txn_date,
        "created_timestamp": staged.created_timestamp,
        "last_updated_timestamp": staged.last_updated_timestamp,
        "updated_device": staged.updated_device,
        "metadata_quality": staged.metadata_quality,
        "content_hash": staged.content_hash,
    }
    if staged.entity_type in {"share", "dividend"}:
        if not staged.share_name:
            raise ValueError("Incoming Share event has no share name")
        share = connection.execute("SELECT share_id, name FROM shares WHERE share_id=?", (existing["share_id"],)).fetchone()
        if share is None or str(share["name"]) != staged.share_name:
            raise ValueError("Changing the share name during conflict resolution requires a separate identity review")
        values["share_id"] = str(share["share_id"])
        if staged.entity_type == "share":
            if staged.per_unit_price_scaled is None:
                raise ValueError("Incoming trade has no unit price")
            values.update({
                "transaction_type": staged.event_type,
                "per_unit_price_scaled": staged.per_unit_price_scaled,
                "quantity": staged.quantity,
                "charge_scaled": staged.charge_scaled or 0,
            })
        else:
            values.update({
                "event_type": staged.event_type,
                "cash_amount_scaled": staged.cash_amount_scaled,
                "quantity": staged.quantity,
            })
    else:
        if not staged.share_name or not staged.sip_plan_id or staged.amount_scaled is None:
            raise ValueError("Incoming SIP event is missing plan identity or amount")
        if str(existing["sip_plan_id"]) != staged.sip_plan_id:
            raise ValueError("SIP plan UUID is immutable for a row conflict; review the plan mapping separately")
        values.update({
            "investment_name": staged.share_name,
            "sip_plan_id": staged.sip_plan_id,
            "transaction_type": staged.event_type,
            "amount_scaled": staged.amount_scaled,
            "charge_scaled": staged.charge_scaled or 0,
            "units": staged.units,
        })
    return values


def _mutable_values(entity: str, incoming: dict[str, object]) -> dict[str, object]:
    fields = {
        "share": ("txn_date", "share_id", "per_unit_price_scaled", "quantity", "charge_scaled"),
        "dividend": ("txn_date", "share_id", "cash_amount_scaled", "quantity"),
        "sip": ("txn_date", "investment_name", "amount_scaled", "charge_scaled", "units"),
    }[entity]
    return {field: incoming[field] for field in fields}
