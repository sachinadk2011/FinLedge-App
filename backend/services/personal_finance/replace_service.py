"""Atomic Replace for one reviewed Personal Finance flow workbook."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from pathlib import Path

from backend.db.core import transaction
from backend.db.imports.common import import_legacy_identity_file
from backend.db.imports.personal_finance.models import (
    PersonalFinanceImportPlan,
    PersonalFinanceReplaceReport,
)
from backend.db.repositories import (
    PersonalFinanceRepository,
    find_other_entity_owner,
    get_tombstone,
    resolve_legacy_row_id,
)
from backend.services.common import replace_records_for_reviewed_import, snapshot_before_operation

from .import_service import _canonical_values, _validate_plan
from .transfer_import_validation import validate_transfer_income_timeline


def replace_staged_personal_finance_workbook(
    connection: sqlite3.Connection,
    plan: PersonalFinanceImportPlan,
    *,
    device: str,
    before_replace_snapshot: Callable[[], object] | None = None,
    legacy_identity_map_path: str | Path | None = None,
) -> PersonalFinanceReplaceReport:
    """Replace only the reviewed Bank or Cash Flow set in one transaction."""
    _validate_plan(plan)
    if connection.in_transaction:
        raise RuntimeError("Personal Finance Replace must own its transaction boundary")
    device = str(device or "").strip().casefold()
    if device not in {"desktop-exe", "desktop-appx", "desktop-dev", "desktop-test"}:
        raise ValueError("Personal Finance Replace requires a supported Desktop device label")

    snapshot = snapshot_before_operation(connection, "pre-replace", before_replace_snapshot)
    repository = PersonalFinanceRepository(connection)
    imported_identity_count = existing_identity_count = 0
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
                    raise ValueError(
                        f"Personal Finance row {staged.row_number} has no UUID or legacy identity key"
                    )
                row_id = resolve_legacy_row_id(connection, staged.identity_key)
            owner = find_other_entity_owner(connection, row_id, "personal_finance")
            if owner is not None:
                raise ValueError(f"Personal Finance Row ID {row_id} already belongs to the {owner} entity")
            existing = repository.get(row_id)
            if existing is not None and str(existing["flow_type"]) != plan.flow_type:
                raise ValueError(
                    f"Personal Finance Row ID {row_id} belongs to the other flow; "
                    "Replace cannot move a row between Bank Flow and Cash Flow"
                )
            tombstone = get_tombstone(connection, row_id)
            if tombstone is not None:
                if str(tombstone["entity_type"]) != "personal_finance":
                    raise ValueError(
                        f"Personal Finance Row ID {row_id} has a deletion record for another entity type"
                    )
                if str(tombstone["deleted_timestamp"]) > staged.last_updated_timestamp:
                    raise ValueError(
                        f"Personal Finance Row ID {row_id} conflicts with a newer deletion; "
                        "explicit restore review is required"
                    )
            row_ids.append(row_id)

        removed_count = replace_records_for_reviewed_import(
            connection,
            repository,
            incoming_row_ids=set(row_ids),
            deleted_by_device=device,
            scope_column="flow_type",
            scope_value=plan.flow_type,
        )
        for staged, row_id in zip(plan.records, row_ids, strict=True):
            repository.import_existing(
                _canonical_values(staged, row_id, repository.next_sequence_no())
            )

        validate_transfer_income_timeline(connection)

    return PersonalFinanceReplaceReport(
        flow_type=plan.flow_type,
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
