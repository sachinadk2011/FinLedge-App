"""Explicit, snapshot-gated resolution for Bank Smart Merge conflicts."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from typing import Literal

from backend.db.imports.bank.models import BankConflictResolutionReport, BankMergeRow
from backend.db.repositories import BankRepository
from backend.services.common import resolve_import_record_conflict


ConflictDecision = Literal["keep_local", "keep_incoming"]


def resolve_bank_import_conflict(
    connection: sqlite3.Connection,
    review: BankMergeRow,
    *,
    decision: ConflictDecision,
    device: str,
    before_import_snapshot: Callable[[], object] | None = None,
) -> BankConflictResolutionReport:
    """Record the losing row and apply the reviewed decision atomically.

    The caller must show the conflict and collect the decision first. Snapshot
    creation happens before writes; state is revalidated under the write lock.
    Newer tombstones and stale/non-row conflicts require separate review paths.
    """
    row_id = review.resolved_row_id
    if review.classification != "conflict" or not row_id:
        raise ValueError("Only a resolved Bank row conflict can use this decision path")
    if not review.existing_record or "content_hash" not in review.existing_record:
        raise ValueError("This conflict is not an existing Bank row; deletion conflicts need explicit restore review")

    incoming = _incoming_values(review, row_id)
    repository = BankRepository(connection)
    result = resolve_import_record_conflict(
        connection,
        repository,
        row_id=row_id,
        entity_type="bank",
        expected_content_hash=str(review.existing_record["content_hash"]),
        incoming_values=incoming,
        update_values={
            "txn_date": incoming["txn_date"],
            "category": incoming["category"],
            "amount_scaled": incoming["amount_scaled"],
            "description": incoming["description"],
        },
        decision=decision,
        device=device,
        before_import_snapshot=before_import_snapshot,
    )

    return BankConflictResolutionReport(
        row_id=row_id,
        conflict_id=result.conflict_id,
        resolution=result.resolution,
        row_updated=result.row_updated,
    )


def _incoming_values(review: BankMergeRow, row_id: str) -> dict[str, object]:
    staged = review.staged
    required = {
        "txn_date": staged.txn_date,
        "category": staged.category,
        "amount_scaled": staged.amount_scaled,
        "content_hash": staged.content_hash,
    }
    missing = [name for name, value in required.items() if value is None]
    if staged.status != "ready" or missing:
        raise ValueError(f"Incoming Bank row is not ready for resolution: {', '.join(missing) or staged.status}")
    return {
        "row_id": row_id,
        "sequence_no": staged.sequence_no,
        "txn_date": staged.txn_date,
        "category": staged.category,
        "amount_scaled": staged.amount_scaled,
        "description": staged.description,
        "created_timestamp": staged.created_timestamp,
        "last_updated_timestamp": staged.last_updated_timestamp,
        "updated_device": staged.updated_device,
        "metadata_quality": staged.metadata_quality,
        "content_hash": staged.content_hash,
    }
