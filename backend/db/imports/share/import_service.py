"""Snapshot-gated atomic import of reviewed Share workbook events."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from pathlib import Path
from uuid import uuid4

from backend.db.core import transaction
from backend.db.imports.common import import_legacy_identity_file
from backend.db.imports.share.models import ShareImportPlan, ShareImportReport, StagedShareRecord
from backend.db.repositories import (
    DividendRepository,
    ShareRepository,
    SipRepository,
    find_other_entity_owner,
    get_tombstone,
    resolve_legacy_row_id,
)
from backend.db.share import rebuild_share_holdings
from backend.db.sip import rebuild_sip_plan_summaries
from backend.services.common import snapshot_before_operation


def import_staged_share_workbook(
    connection: sqlite3.Connection,
    plan: ShareImportPlan,
    *,
    device: str,
    before_import_snapshot: Callable[[], object] | None = None,
    legacy_identity_map_path: str | Path | None = None,
) -> ShareImportReport:
    """Import one reviewed Share worksheet as one atomic three-entity batch."""
    _validate_plan(plan)
    if connection.in_transaction:
        raise RuntimeError("Share workbook import must own its transaction boundary")
    device = str(device or "").strip().casefold()
    if device not in {"desktop-exe", "desktop-appx", "desktop-dev", "desktop-test"}:
        raise ValueError("Share workbook import requires a supported Desktop device label")

    snapshot_before_operation(connection, "pre-import", before_import_snapshot)
    repositories = {
        "share": ShareRepository(connection),
        "sip": SipRepository(connection),
        "dividend": DividendRepository(connection),
    }
    imported = already_present = 0
    identity_counts = (0, 0)
    with transaction(connection):
        if legacy_identity_map_path is not None:
            identity_counts = import_legacy_identity_file(connection, legacy_identity_map_path)
        share_sequence = _next_share_sequence(connection)
        sip_sequence = int(connection.execute(
            "SELECT COALESCE(MAX(sequence_no), 0) + 1 FROM sip_transactions"
        ).fetchone()[0])

        for staged in plan.records:
            row_id = staged.row_id
            if row_id is None:
                if not staged.identity_key:
                    raise ValueError(f"Share row {staged.row_number} has no UUID or legacy identity key")
                row_id = resolve_legacy_row_id(connection, staged.identity_key)
            entity = str(staged.entity_type)
            _check_tombstone(connection, row_id, entity, staged)
            owner = find_other_entity_owner(connection, row_id, entity)
            if owner is not None:
                raise ValueError(f"Share Row ID {row_id} already belongs to {owner}")
            repository = repositories[entity]
            existing = repository.get(row_id)
            if existing is not None:
                actual_hash = repository.canonical_content_hash(dict(existing))
                if actual_hash != str(existing["content_hash"]):
                    raise RuntimeError(f"Share row {row_id} has a stale canonical hash; repair or review it first")
                if actual_hash == staged.content_hash:
                    already_present += 1
                    continue
                raise ValueError(f"Share Row ID {row_id} already exists with different business content; review the conflict first")

            record = _canonical_values(connection, staged, row_id, share_sequence, sip_sequence)
            if repository.import_existing(record):
                imported += 1
                if entity in {"share", "dividend"}:
                    share_sequence += 1
                else:
                    sip_sequence += 1
            else:
                already_present += 1

        # Any invalid historical order aborts both source rows and materialized summaries.
        rebuild_share_holdings(connection, device=device)
        rebuild_sip_plan_summaries(connection, device=device)

    return ShareImportReport(
        imported_count=imported,
        already_present_count=already_present,
        imported_identity_count=identity_counts[0],
        existing_identity_count=identity_counts[1],
        imported_missing_rows=tuple(
            record.row_number for record in plan.records
            if record.metadata_quality == "imported_missing"
        ),
    )


def _validate_plan(plan: ShareImportPlan) -> None:
    blocked = [record for record in plan.records if record.status != "ready"]
    if blocked:
        labels = ", ".join(f"row {record.row_number} ({record.status})" for record in blocked[:8])
        raise ValueError(f"Resolve all Share import review issues before commit: {labels}")
    sequences = [record.sequence_no for record in plan.records]
    if sequences != list(range(1, len(plan.records) + 1)):
        raise ValueError("Share staged rows must retain unique, contiguous worksheet order")
    for record in plan.records:
        if record.entity_type not in {"share", "sip", "dividend"}:
            raise ValueError(f"Share row {record.row_number} has no supported canonical entity")
        required = (
            record.row_id or record.identity_key,
            record.txn_date,
            record.share_name,
            record.event_type,
            record.created_timestamp,
            record.last_updated_timestamp,
            record.updated_device,
            record.metadata_quality,
            record.content_hash,
        )
        if any(value is None or value == "" for value in required):
            raise ValueError(f"Share row {record.row_number} is missing required staged canonical values")
        if record.entity_type == "share" and record.per_unit_price_scaled is None:
            raise ValueError(f"Share row {record.row_number} is missing per-unit price")
        if record.entity_type == "sip" and (record.amount_scaled is None or not record.sip_plan_id):
            raise ValueError(f"SIP row {record.row_number} is missing amount or plan UUID")
        if record.entity_type == "dividend" and record.event_type == "cash" and record.cash_amount_scaled is None:
            raise ValueError(f"Cash dividend row {record.row_number} is missing its amount")


def _canonical_values(
    connection: sqlite3.Connection,
    staged: StagedShareRecord,
    row_id: str,
    share_sequence: int,
    sip_sequence: int,
) -> dict[str, object]:
    metadata = {
        "row_id": row_id,
        "created_timestamp": staged.created_timestamp,
        "last_updated_timestamp": staged.last_updated_timestamp,
        "updated_device": staged.updated_device,
        "metadata_quality": staged.metadata_quality,
    }
    if staged.entity_type == "sip":
        assert staged.txn_date and staged.share_name and staged.sip_plan_id and staged.event_type
        assert staged.amount_scaled is not None
        return {
            **metadata,
            "sequence_no": sip_sequence,
            "txn_date": staged.txn_date,
            "investment_name": staged.share_name,
            "sip_plan_id": staged.sip_plan_id,
            "transaction_type": staged.event_type,
            "amount_scaled": staged.amount_scaled,
            "charge_scaled": staged.charge_scaled or 0,
            "units": staged.units,
            "content_hash": staged.content_hash,
        }

    assert staged.txn_date and staged.share_name and staged.event_type
    share = ShareRepository(connection).ensure_share(share_id=str(uuid4()), name=staged.share_name)
    if staged.entity_type == "share":
        assert staged.per_unit_price_scaled is not None
        return {
            **metadata,
            "sequence_no": share_sequence,
            "txn_date": staged.txn_date,
            "share_id": str(share["share_id"]),
            "transaction_type": staged.event_type,
            "per_unit_price_scaled": staged.per_unit_price_scaled,
            "quantity": staged.quantity,
            "charge_scaled": staged.charge_scaled or 0,
            "content_hash": staged.content_hash,
        }
    return {
        **metadata,
        "sequence_no": share_sequence,
        "txn_date": staged.txn_date,
        "share_id": str(share["share_id"]),
        "event_type": staged.event_type,
        "cash_amount_scaled": staged.cash_amount_scaled,
        "quantity": staged.quantity,
        "content_hash": staged.content_hash,
    }


def _next_share_sequence(connection: sqlite3.Connection) -> int:
    row = connection.execute(
        "SELECT COALESCE(MAX(sequence_no), 0) + 1 FROM "
        "(SELECT sequence_no FROM share_transactions UNION ALL SELECT sequence_no FROM dividend_events)"
    ).fetchone()
    return int(row[0])


def _check_tombstone(connection, row_id: str, entity: str, staged: StagedShareRecord) -> None:
    tombstone = get_tombstone(connection, row_id)
    if tombstone is None:
        return
    if tombstone["entity_type"] != entity:
        raise ValueError(f"Share Row ID {row_id} has a deletion record for another entity type")
    if str(tombstone["deleted_timestamp"]) > staged.last_updated_timestamp:
        raise ValueError(f"Share Row ID {row_id} conflicts with a newer deletion; explicit restore review is required")
