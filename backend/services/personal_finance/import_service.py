"""Snapshot-gated atomic import of reviewed Personal Finance workbooks."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from pathlib import Path

from backend.db.core import transaction
from backend.services.common import snapshot_before_operation
from backend.db.imports.common import import_legacy_identity_file
from backend.db.imports.personal_finance.models import (
    PersonalFinanceImportPlan,
    PersonalFinanceImportReport,
    StagedPersonalFinanceRecord,
)
from backend.db.repositories import PersonalFinanceRepository, resolve_legacy_row_id


def import_staged_personal_finance_workbook(
    connection: sqlite3.Connection,
    plan: PersonalFinanceImportPlan,
    *,
    before_import_snapshot: Callable[[], object] | None = None,
    legacy_identity_map_path: str | Path | None = None,
) -> PersonalFinanceImportReport:
    """Commit one reviewed flow workbook; new rows append in worksheet order.

    The two flow workbooks share one table and one globally unique sequence.
    Therefore staged worksheet positions are retained as ordering, while each
    new database row receives the next available sequence number.
    """
    _validate_plan(plan)
    if connection.in_transaction:
        raise RuntimeError("Personal Finance workbook import must own its transaction boundary")
    snapshot_before_operation(connection, "pre-import", before_import_snapshot)
    repository = PersonalFinanceRepository(connection)
    identity_counts = (0, 0)
    imported_count = 0
    already_present_count = 0
    with transaction(connection):
        if legacy_identity_map_path is not None:
            identity_counts = import_legacy_identity_file(connection, legacy_identity_map_path)

        for staged in plan.records:
            row_id = staged.row_id
            if row_id is None:
                if not staged.identity_key:
                    raise ValueError(f"Personal Finance row {staged.row_number} has no UUID or legacy identity key")
                row_id = resolve_legacy_row_id(connection, staged.identity_key)

            _check_tombstone(connection, row_id, staged)
            existing = repository.get(row_id)
            if existing is not None:
                existing_values = dict(existing)
                actual_hash = repository.canonical_content_hash(existing_values)
                if actual_hash != str(existing["content_hash"]):
                    raise RuntimeError(
                        f"Personal Finance row {row_id} has a stale content hash; repair or review it before import"
                    )
                if actual_hash == staged.content_hash:
                    already_present_count += 1
                    continue
                raise ValueError(
                    f"Personal Finance Row ID {row_id} already exists with different business content; "
                    "classify and resolve the conflict before commit"
                )

            record = _canonical_values(staged, row_id, repository.next_sequence_no())
            if repository.import_existing(record):
                imported_count += 1
            else:
                already_present_count += 1

    return PersonalFinanceImportReport(
        imported_count=imported_count,
        already_present_count=already_present_count,
        imported_identity_count=identity_counts[0],
        existing_identity_count=identity_counts[1],
        imported_missing_rows=tuple(
            record.row_number for record in plan.records
            if record.metadata_quality == "imported_missing"
        ),
    )


def _validate_plan(plan: PersonalFinanceImportPlan) -> None:
    if plan.flow_type not in {"bank", "cash"}:
        raise ValueError("Personal Finance import plan flow_type must be bank or cash")
    blocked = [record for record in plan.records if record.status != "ready"]
    if blocked:
        descriptions = ", ".join(f"row {record.row_number} ({record.status})" for record in blocked[:8])
        raise ValueError(f"Resolve all Personal Finance import review issues before commit: {descriptions}")
    sequences = [record.sequence_no for record in plan.records]
    if sequences != list(range(1, len(plan.records) + 1)):
        raise ValueError("Personal Finance staged rows must have unique, contiguous worksheet order")
    for record in plan.records:
        if record.flow_type != plan.flow_type:
            raise ValueError(f"Personal Finance row {record.row_number} does not match its reviewed flow type")
        required = {
            "txn_date": record.txn_date,
            "direction": record.direction,
            "category": record.category,
            "amount_scaled": record.amount_scaled,
            "created_timestamp": record.created_timestamp,
            "last_updated_timestamp": record.last_updated_timestamp,
            "updated_device": record.updated_device,
            "metadata_quality": record.metadata_quality,
            "content_hash": record.content_hash,
        }
        missing = [name for name, value in required.items() if value is None or value == ""]
        if missing:
            raise ValueError(f"Personal Finance row {record.row_number} is missing staged values: {', '.join(missing)}")


def _canonical_values(
    record: StagedPersonalFinanceRecord,
    row_id: str,
    sequence_no: int,
) -> dict[str, object]:
    amount_scaled = record.amount_scaled
    assert amount_scaled is not None
    signed_amount_scaled = amount_scaled if record.direction == "income" else -amount_scaled
    return {
        "row_id": row_id,
        "sequence_no": sequence_no,
        "txn_date": record.txn_date,
        "flow_type": record.flow_type,
        "direction": record.direction,
        "category": record.category,
        "amount_scaled": amount_scaled,
        "signed_amount_scaled": signed_amount_scaled,
        "description": record.description,
        "created_timestamp": record.created_timestamp,
        "last_updated_timestamp": record.last_updated_timestamp,
        "updated_device": record.updated_device,
        "metadata_quality": record.metadata_quality,
        "content_hash": record.content_hash,
    }


def _check_tombstone(
    connection: sqlite3.Connection,
    row_id: str,
    staged: StagedPersonalFinanceRecord,
) -> None:
    tombstone = connection.execute(
        "SELECT entity_type, deleted_timestamp FROM deleted_records WHERE row_id = ?", (row_id,)
    ).fetchone()
    if tombstone is None:
        return
    if str(tombstone["entity_type"]) != "personal_finance":
        raise ValueError(f"Personal Finance Row ID {row_id} has a deletion record for another entity type")
    if str(tombstone["deleted_timestamp"]) > staged.last_updated_timestamp:
        raise ValueError(f"Personal Finance Row ID {row_id} conflicts with a newer deletion record; explicit restore review is required")
