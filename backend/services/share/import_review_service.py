"""Read-only Smart Merge classification for staged Share workbook events."""

from __future__ import annotations

import sqlite3

from backend.db.imports.share.models import ShareImportPlan, ShareMergePlan, ShareMergeRow, StagedShareRecord
from backend.db.repositories import (
    DividendRepository,
    ShareRepository,
    SipRepository,
    find_other_entity_owner,
    get_tombstone,
)


def classify_share_import(connection: sqlite3.Connection, plan: ShareImportPlan) -> ShareMergePlan:
    """Classify staged rows without writing to the source workbook or SQLite."""
    repositories = {
        "share": ShareRepository(connection),
        "sip": SipRepository(connection),
        "dividend": DividendRepository(connection),
    }
    rows = tuple(_classify_row(connection, repositories, staged) for staged in plan.records)
    return ShareMergePlan(source_name=plan.source_name, rows=rows)


def _classify_row(connection, repositories, staged: StagedShareRecord) -> ShareMergeRow:
    if staged.status != "ready":
        messages = " ".join(issue.message for issue in staged.issues)
        return ShareMergeRow(
            staged=staged,
            classification=staged.status,
            review_message=messages or f"This row is {staged.status} and must be reviewed.",
        )
    entity = staged.entity_type
    if entity not in repositories:
        return ShareMergeRow(staged, "invalid", review_message="The row has no supported Share event type.")

    row_id = staged.row_id
    if row_id is None and staged.identity_key:
        mapped = connection.execute(
            "SELECT row_id FROM legacy_identity_map WHERE identity_key = ?", (staged.identity_key,)
        ).fetchone()
        row_id = str(mapped["row_id"]) if mapped is not None else None

    if row_id:
        owner = find_other_entity_owner(connection, row_id, entity)
        if owner:
            return ShareMergeRow(
                staged, "invalid", resolved_row_id=row_id,
                review_message=f"This UUID already belongs to the {owner} entity.",
            )
        tombstone = get_tombstone(connection, row_id)
        if tombstone is not None and tombstone["entity_type"] != entity:
            return ShareMergeRow(
                staged, "invalid", resolved_row_id=row_id, existing_record=tombstone,
                review_message="This UUID has a deletion record for a different entity type.",
            )
        if tombstone is not None and str(tombstone["deleted_timestamp"]) > staged.last_updated_timestamp:
            return ShareMergeRow(
                staged, "conflict", resolved_row_id=row_id, existing_record=tombstone,
                review_message="A newer deletion prevents automatic restoration of this row.",
            )
        existing = repositories[entity].get(row_id)
        if existing is not None:
            values = dict(existing)
            actual_hash = repositories[entity].canonical_content_hash(values)
            if actual_hash != str(existing["content_hash"]):
                return ShareMergeRow(
                    staged, "invalid", resolved_row_id=row_id, existing_record=values,
                    review_message="The local event has a stale content hash and needs repair before merge.",
                )
            if actual_hash == staged.content_hash:
                return ShareMergeRow(staged, "already_present", resolved_row_id=row_id, existing_record=values)
            return ShareMergeRow(
                staged, "conflict", resolved_row_id=row_id, existing_record=values,
                review_message="This Row ID already exists with different Share event content.",
            )

    candidates = _possible_duplicates(repositories[entity], staged, excluding_row_id=row_id)
    if candidates:
        return ShareMergeRow(
            staged, "possible_duplicate", resolved_row_id=row_id,
            possible_duplicates=tuple(candidates),
            review_message="A different Row ID has matching date, event type, name, amount/price, quantity, and charge.",
        )
    return ShareMergeRow(staged, "add", resolved_row_id=row_id)


def _possible_duplicates(repository, staged: StagedShareRecord, *, excluding_row_id: str | None):
    if staged.entity_type == "share":
        if staged.per_unit_price_scaled is None:
            return []
        return repository.find_possible_duplicates(
            txn_date=staged.txn_date or "", share_name=staged.share_name or "",
            transaction_type=staged.event_type or "", per_unit_price_scaled=staged.per_unit_price_scaled,
            quantity=staged.quantity, charge_scaled=staged.charge_scaled or 0, excluding_row_id=excluding_row_id,
        )
    if staged.entity_type == "sip":
        if staged.amount_scaled is None:
            return []
        return repository.find_possible_duplicates(
            txn_date=staged.txn_date or "", investment_name=staged.share_name or "",
            transaction_type=staged.event_type or "", amount_scaled=staged.amount_scaled,
            charge_scaled=staged.charge_scaled or 0, units=staged.units, excluding_row_id=excluding_row_id,
        )
    return repository.find_possible_duplicates(
        txn_date=staged.txn_date or "", share_name=staged.share_name or "",
        event_type=staged.event_type or "", cash_amount_scaled=staged.cash_amount_scaled,
        quantity=staged.quantity, excluding_row_id=excluding_row_id,
    )
