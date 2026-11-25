"""Explicit snapshot-gated decisions for Personal Finance import conflicts."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from typing import Literal

from backend.db.imports.personal_finance.models import (
    PersonalFinanceConflictResolutionReport,
    PersonalFinanceMergeRow,
)
from backend.db.repositories import PersonalFinanceRepository
from backend.services.common import resolve_import_record_conflict


ConflictDecision = Literal["keep_local", "keep_incoming"]


def resolve_personal_finance_import_conflict(
    connection: sqlite3.Connection,
    review: PersonalFinanceMergeRow,
    *,
    decision: ConflictDecision,
    device: str,
    before_import_snapshot: Callable[[], object] | None = None,
) -> PersonalFinanceConflictResolutionReport:
    """Archive the losing version and apply the reviewed winner atomically."""
    row_id = review.resolved_row_id
    if review.classification != "conflict" or not row_id:
        raise ValueError("Only a resolved Personal Finance row conflict can use this decision path")
    if not review.existing_record or "content_hash" not in review.existing_record:
        raise ValueError("Deletion conflicts need an explicit restore review")

    incoming = _incoming_values(review, row_id)
    repository = PersonalFinanceRepository(connection)
    result = resolve_import_record_conflict(
        connection,
        repository,
        row_id=row_id,
        entity_type="personal_finance",
        expected_content_hash=str(review.existing_record["content_hash"]),
        incoming_values=incoming,
        update_values={
            "txn_date": incoming["txn_date"],
            "flow_type": incoming["flow_type"],
            "direction": incoming["direction"],
            "category": incoming["category"],
            "amount_scaled": incoming["amount_scaled"],
            "description": incoming["description"],
        },
        decision=decision,
        device=device,
        before_import_snapshot=before_import_snapshot,
    )
    return PersonalFinanceConflictResolutionReport(
        row_id=row_id,
        conflict_id=result.conflict_id,
        resolution=result.resolution,
        row_updated=result.row_updated,
    )


def _incoming_values(review: PersonalFinanceMergeRow, row_id: str) -> dict[str, object]:
    staged = review.staged
    required = {
        "txn_date": staged.txn_date,
        "direction": staged.direction,
        "category": staged.category,
        "amount_scaled": staged.amount_scaled,
        "content_hash": staged.content_hash,
    }
    missing = [name for name, value in required.items() if value is None]
    if staged.status != "ready" or missing:
        raise ValueError(
            f"Incoming Personal Finance row is not ready for resolution: {', '.join(missing) or staged.status}"
        )
    amount_scaled = staged.amount_scaled
    assert amount_scaled is not None
    signed_amount_scaled = amount_scaled if staged.direction == "income" else -amount_scaled
    return {
        "row_id": row_id,
        "sequence_no": staged.sequence_no,
        "txn_date": staged.txn_date,
        "flow_type": staged.flow_type,
        "direction": staged.direction,
        "category": staged.category,
        "amount_scaled": amount_scaled,
        "signed_amount_scaled": signed_amount_scaled,
        "description": staged.description,
        "created_timestamp": staged.created_timestamp,
        "last_updated_timestamp": staged.last_updated_timestamp,
        "updated_device": staged.updated_device,
        "metadata_quality": staged.metadata_quality,
        "content_hash": staged.content_hash,
    }
