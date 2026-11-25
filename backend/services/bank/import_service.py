"""Transactional commit of reviewed Bank workbook rows into SQLite."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from pathlib import Path

from backend.db.core import transaction
from backend.services.common import snapshot_before_operation
from backend.db.imports.bank.models import BankImportPlan, BankImportReport, StagedBankRecord
from backend.db.imports.common import import_legacy_identity_file
from backend.db.repositories import BankRepository, resolve_legacy_row_id


def import_staged_bank_workbook(
    connection: sqlite3.Connection,
    plan: BankImportPlan,
    *,
    before_import_snapshot: Callable[[], object] | None = None,
    legacy_identity_map_path: str | Path | None = None,
) -> BankImportReport:
    """Snapshot first, then commit the identity map and Bank rows atomically."""
    _validate_plan(plan)
    if connection.in_transaction:
        raise RuntimeError("Bank workbook import must own its transaction boundary")
    snapshot_before_operation(connection, "pre-import", before_import_snapshot)
    repository = BankRepository(connection)
    with transaction(connection):
        identity_counts = (0, 0)
        if legacy_identity_map_path is not None:
            identity_counts = import_legacy_identity_file(connection, legacy_identity_map_path)

        imported_count = 0
        already_present_count = 0
        for staged in plan.records:
            row_id = staged.row_id
            if row_id is None:
                if not staged.identity_key:
                    raise ValueError(f"Bank row {staged.row_number} has no UUID or legacy identity key")
                row_id = resolve_legacy_row_id(connection, staged.identity_key)
            inserted = repository.import_existing(_canonical_values(staged, row_id))
            if inserted:
                imported_count += 1
            else:
                already_present_count += 1

    return BankImportReport(
        imported_count=imported_count,
        already_present_count=already_present_count,
        imported_identity_count=identity_counts[0],
        existing_identity_count=identity_counts[1],
        imported_missing_rows=tuple(
            record.row_number for record in plan.records
            if record.metadata_quality == "imported_missing"
        ),
    )


def _validate_plan(plan: BankImportPlan) -> None:
    blocked = [record for record in plan.records if record.status != "ready"]
    if blocked:
        descriptions = ", ".join(f"row {record.row_number} ({record.status})" for record in blocked[:8])
        raise ValueError(f"Resolve all Bank import review issues before commit: {descriptions}")
    for record in plan.records:
        required = {
            "txn_date": record.txn_date,
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
            raise ValueError(f"Bank row {record.row_number} is missing staged values: {', '.join(missing)}")


def _canonical_values(record: StagedBankRecord, row_id: str) -> dict[str, object]:
    return {
        "row_id": row_id,
        "sequence_no": record.sequence_no,
        "txn_date": record.txn_date,
        "category": record.category,
        "amount_scaled": record.amount_scaled,
        "description": record.description,
        "created_timestamp": record.created_timestamp,
        "last_updated_timestamp": record.last_updated_timestamp,
        "updated_device": record.updated_device,
        "metadata_quality": record.metadata_quality,
        "content_hash": record.content_hash,
    }
