"""Snapshot-gated transactional Replace for reviewed Bank workbooks."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from pathlib import Path

from backend.db.core import transaction
from backend.db.imports.bank.models import BankImportPlan, BankReplaceReport
from backend.db.imports.common import import_legacy_identity_file
from backend.db.repositories import (
    BankRepository,
    find_other_entity_owner,
    get_tombstone,
    resolve_legacy_row_id,
)
from backend.services.common import replace_records_for_reviewed_import, snapshot_before_operation

from .import_service import _canonical_values, _validate_plan


def replace_staged_bank_workbook(
    connection: sqlite3.Connection,
    plan: BankImportPlan,
    *,
    device: str,
    before_replace_snapshot: Callable[[], object] | None = None,
    legacy_identity_map_path: str | Path | None = None,
) -> BankReplaceReport:
    """Replace the Bank dataset from a reviewed source as one atomic operation."""
    _validate_plan(plan)
    if connection.in_transaction:
        raise RuntimeError("Bank Replace must own its transaction boundary")
    device = str(device or "").strip().casefold()
    if device not in {"desktop-exe", "desktop-appx", "desktop-dev", "desktop-test"}:
        raise ValueError("Bank Replace requires a supported Desktop device label")
    sequences = [record.sequence_no for record in plan.records]
    if sequences != list(range(1, len(plan.records) + 1)):
        raise ValueError("Bank Replace rows must retain contiguous workbook order")

    snapshot = snapshot_before_operation(connection, "pre-replace", before_replace_snapshot)
    imported_identity_count = existing_identity_count = 0
    repository = BankRepository(connection)
    with transaction(connection):
        if legacy_identity_map_path is not None:
            imported_identity_count, existing_identity_count = import_legacy_identity_file(
                connection, legacy_identity_map_path
            )
        row_ids = []
        for staged in plan.records:
            row_id = staged.row_id
            if row_id is None:
                if not staged.identity_key:
                    raise ValueError(f"Bank row {staged.row_number} has no UUID or legacy identity key")
                row_id = resolve_legacy_row_id(connection, staged.identity_key)
            owner = find_other_entity_owner(connection, row_id, "bank")
            if owner is not None:
                raise ValueError(f"Bank Row ID {row_id} already belongs to the {owner} entity")
            tombstone = get_tombstone(connection, row_id)
            if tombstone is not None:
                if str(tombstone["entity_type"]) != "bank":
                    raise ValueError(f"Bank Row ID {row_id} has a deletion record for another entity type")
                if str(tombstone["deleted_timestamp"]) > staged.last_updated_timestamp:
                    raise ValueError(
                        f"Bank Row ID {row_id} conflicts with a newer deletion; explicit restore review is required"
                    )
            row_ids.append(row_id)

        removed_count = replace_records_for_reviewed_import(
            connection,
            repository,
            incoming_row_ids=set(row_ids),
            deleted_by_device=device,
        )
        for staged, row_id in zip(plan.records, row_ids, strict=True):
            repository.import_existing(_canonical_values(staged, row_id))

    return BankReplaceReport(
        imported_count=len(plan.records),
        removed_count=removed_count,
        snapshot_path=str(getattr(snapshot, "path", "")),
        imported_identity_count=imported_identity_count,
        existing_identity_count=existing_identity_count,
        imported_missing_rows=tuple(
            record.row_number for record in plan.records
            if record.metadata_quality == "imported_missing"
        ),
    )
