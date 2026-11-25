"""Snapshot-gated conflict decisions for imported transfer events."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from typing import Literal

from backend.db.imports.transfer.models import TransferConflictResolutionReport, TransferMergeRow
from backend.db.repositories import TransferRepository
from backend.services.common import resolve_import_record_conflict
from .transfer_import_validation import validate_transfer_income_timeline


ConflictDecision = Literal["keep_local", "keep_incoming"]


def resolve_transfer_import_conflict(
    connection: sqlite3.Connection,
    review: TransferMergeRow,
    *,
    decision: ConflictDecision,
    device: str,
    before_import_snapshot: Callable[[], object] | None = None,
) -> TransferConflictResolutionReport:
    """Archive the loser and validate transfer balances atomically for incoming wins."""
    row_id = review.resolved_row_id
    existing = review.existing_record
    if review.classification != "conflict" or not row_id:
        raise ValueError("Only a resolved transfer row conflict can use this decision path")
    if not existing or "content_hash" not in existing:
        raise ValueError("Tombstone conflicts require an explicit restore review")
    staged = review.staged
    if staged.status != "ready" or not staged.content_hash or not staged.transfer_ref:
        raise ValueError("The staged transfer is not ready for conflict resolution")
    if str(existing["transfer_ref"]) != staged.transfer_ref:
        raise ValueError("Transfer references are immutable; this conflict needs a separate identity review")
    if staged.txn_date is None or staged.direction is None or staged.amount_scaled is None:
        raise ValueError("Incoming transfer is missing canonical date, direction or amount")

    incoming = {
        "row_id": row_id,
        "sequence_no": int(existing["sequence_no"]),
        "txn_date": staged.txn_date,
        "direction": staged.direction,
        "amount_scaled": staged.amount_scaled,
        "description": staged.description,
        "transfer_ref": staged.transfer_ref,
        "created_timestamp": staged.created_timestamp,
        "last_updated_timestamp": staged.last_updated_timestamp,
        "updated_device": staged.updated_device,
        "metadata_quality": staged.metadata_quality,
        "content_hash": staged.content_hash,
    }

    result = resolve_import_record_conflict(
        connection,
        TransferRepository(connection),
        row_id=row_id,
        entity_type="transfer",
        expected_content_hash=str(existing["content_hash"]),
        incoming_values=incoming,
        update_values={
            "txn_date": incoming["txn_date"],
            "direction": incoming["direction"],
            "amount_scaled": incoming["amount_scaled"],
            "description": incoming["description"],
        },
        decision=decision,
        device=device,
        before_import_snapshot=before_import_snapshot,
        after_incoming_update=lambda: validate_transfer_income_timeline(connection),
    )
    return TransferConflictResolutionReport(
        row_id=row_id,
        conflict_id=result.conflict_id,
        resolution=result.resolution,
        row_updated=result.row_updated,
    )
