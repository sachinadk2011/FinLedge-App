"""Read-only Smart Merge classification for staged transfer rows."""

from __future__ import annotations

import sqlite3

from backend.db.imports.transfer.models import TransferImportPlan, TransferMergePlan, TransferMergeRow
from backend.db.repositories import TransferRepository, find_other_entity_owner, get_tombstone


def classify_transfer_import(connection: sqlite3.Connection, plan: TransferImportPlan) -> TransferMergePlan:
    """Classify staged transfers without changing the workbook or database."""
    repository = TransferRepository(connection)
    rows = tuple(_classify_row(connection, repository, staged) for staged in plan.records)
    return TransferMergePlan(source_name=plan.source_name, rows=rows)


def _classify_row(connection, repository, staged) -> TransferMergeRow:
    if staged.status != "ready":
        message = " ".join(issue.message for issue in staged.issues)
        return TransferMergeRow(
            staged, staged.status,
            review_message=message or f"This row is {staged.status} and must be reviewed.",
        )
    row_id = staged.row_id
    if row_id is None and staged.identity_key:
        mapped = connection.execute(
            "SELECT row_id FROM legacy_identity_map WHERE identity_key=?", (staged.identity_key,)
        ).fetchone()
        row_id = str(mapped["row_id"]) if mapped is not None else None
    if row_id:
        owner = find_other_entity_owner(connection, row_id, "transfer")
        if owner:
            return TransferMergeRow(
                staged, "invalid", resolved_row_id=row_id,
                review_message=f"This UUID already belongs to the {owner} entity.",
            )
        tombstone = get_tombstone(connection, row_id)
        if tombstone is not None and tombstone["entity_type"] != "transfer":
            return TransferMergeRow(
                staged, "invalid", resolved_row_id=row_id, existing_record=tombstone,
                review_message="This UUID has a deletion record for a different entity type.",
            )
        if tombstone is not None and str(tombstone["deleted_timestamp"]) > staged.last_updated_timestamp:
            return TransferMergeRow(
                staged, "conflict", resolved_row_id=row_id, existing_record=tombstone,
                review_message="A newer deletion prevents automatic restoration of this transfer.",
            )
        existing = repository.get(row_id)
        if existing is not None:
            values = dict(existing)
            actual_hash = repository.canonical_content_hash(values)
            if actual_hash != str(existing["content_hash"]):
                return TransferMergeRow(
                    staged, "invalid", resolved_row_id=row_id, existing_record=values,
                    review_message="The local transfer has a stale content hash and needs repair before merge.",
                )
            if actual_hash == staged.content_hash:
                return TransferMergeRow(staged, "already_present", resolved_row_id=row_id, existing_record=values)
            return TransferMergeRow(
                staged, "conflict", resolved_row_id=row_id, existing_record=values,
                review_message="This Row ID already exists with different transfer content.",
            )

    ref_owner = connection.execute(
        "SELECT row_id FROM transfers WHERE transfer_ref=?", (staged.transfer_ref,)
    ).fetchone()
    if ref_owner is not None:
        return TransferMergeRow(
            staged, "invalid", resolved_row_id=row_id,
            existing_record={"row_id": str(ref_owner["row_id"]), "transfer_ref": staged.transfer_ref},
            review_message="This transfer reference already belongs to a different UUID.",
        )
    candidates = repository.find_possible_duplicates(
        txn_date=staged.txn_date or "", direction=staged.direction or "",
        amount_scaled=staged.amount_scaled or 0, description=staged.description,
        excluding_row_id=row_id,
    )
    if candidates:
        return TransferMergeRow(
            staged, "possible_duplicate", resolved_row_id=row_id,
            possible_duplicates=tuple(candidates),
            review_message="A different Row ID has matching date, direction, amount and normalized description.",
        )
    return TransferMergeRow(staged, "add", resolved_row_id=row_id)
