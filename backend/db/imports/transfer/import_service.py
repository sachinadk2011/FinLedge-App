"""Snapshot-gated atomic import of reviewed Bank/Cash transfer rows."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from pathlib import Path

from backend.db.core import transaction
from backend.db.imports.common import import_legacy_identity_file
from backend.db.imports.transfer.models import (
    StagedTransferRecord,
    TransferImportPlan,
    TransferImportReport,
)
from backend.db.repositories import (
    TransferRepository,
    find_other_entity_owner,
    get_tombstone,
    resolve_legacy_row_id,
)
from backend.services.personal_finance.transfer_import_validation import validate_transfer_income_timeline
from backend.services.common import snapshot_before_operation


def import_staged_transfer_workbook(
    connection: sqlite3.Connection,
    plan: TransferImportPlan,
    *,
    device: str,
    before_import_snapshot: Callable[[], object] | None = None,
    legacy_identity_map_path: str | Path | None = None,
) -> TransferImportReport:
    """Commit reviewed transfers without writing derived Personal Finance entries."""
    _validate_plan(plan)
    if connection.in_transaction:
        raise RuntimeError("Transfer workbook import must own its transaction boundary")
    device = str(device or "").strip().casefold()
    if device not in {"desktop-exe", "desktop-appx", "desktop-dev", "desktop-test"}:
        raise ValueError("Transfer workbook import requires a supported Desktop device label")

    snapshot_before_operation(connection, "pre-import", before_import_snapshot)
    repository = TransferRepository(connection)
    imported = already_present = 0
    identity_counts = (0, 0)
    with transaction(connection):
        if legacy_identity_map_path is not None:
            identity_counts = import_legacy_identity_file(connection, legacy_identity_map_path)
        sequence_no = repository.next_sequence_no()
        for staged in plan.records:
            row_id = staged.row_id
            if row_id is None:
                if not staged.identity_key:
                    raise ValueError(f"Transfer row {staged.row_number} has no UUID or legacy identity key")
                row_id = resolve_legacy_row_id(connection, staged.identity_key)
            tombstone = get_tombstone(connection, row_id)
            if tombstone is not None and tombstone["entity_type"] != "transfer":
                raise ValueError(f"Transfer Row ID {row_id} has a deletion record for another entity type")
            if tombstone is not None and str(tombstone["deleted_timestamp"]) > staged.last_updated_timestamp:
                raise ValueError(f"Transfer Row ID {row_id} conflicts with a newer deletion; explicit restore review is required")
            owner = find_other_entity_owner(connection, row_id, "transfer")
            if owner:
                raise ValueError(f"Transfer Row ID {row_id} already belongs to the {owner} entity")

            existing = repository.get(row_id)
            if existing is not None:
                actual_hash = repository.canonical_content_hash(dict(existing))
                if actual_hash != str(existing["content_hash"]):
                    raise RuntimeError(f"Transfer row {row_id} has a stale canonical hash; repair or review it first")
                if actual_hash == staged.content_hash:
                    already_present += 1
                    continue
                raise ValueError(f"Transfer Row ID {row_id} already exists with different business content; review the conflict first")

            ref_owner = connection.execute(
                "SELECT row_id FROM transfers WHERE transfer_ref=?", (staged.transfer_ref,)
            ).fetchone()
            if ref_owner is not None:
                raise ValueError(
                    f"Transfer reference {staged.transfer_ref!r} already belongs to row {ref_owner['row_id']}; review before import"
                )
            record = _canonical_values(staged, row_id, sequence_no)
            if repository.import_existing(record):
                imported += 1
                sequence_no += 1
            else:
                already_present += 1

        # Balances are query projections, but every imported transfer must pass
        # the same dated income replay as normal transfer edits.
        validate_transfer_income_timeline(connection)

    return TransferImportReport(
        imported_count=imported,
        already_present_count=already_present,
        imported_identity_count=identity_counts[0],
        existing_identity_count=identity_counts[1],
        imported_missing_rows=tuple(
            record.row_number for record in plan.records
            if record.metadata_quality == "imported_missing"
        ),
    )


def _validate_plan(plan: TransferImportPlan) -> None:
    blocked = [record for record in plan.records if record.status != "ready"]
    if blocked:
        labels = ", ".join(f"row {record.row_number} ({record.status})" for record in blocked[:8])
        raise ValueError(f"Resolve all Transfer import review issues before commit: {labels}")
    sequences = [record.sequence_no for record in plan.records]
    if sequences != list(range(1, len(plan.records) + 1)):
        raise ValueError("Transfer staged rows must retain unique, contiguous worksheet order")
    for record in plan.records:
        required = (
            record.row_id or record.identity_key,
            record.txn_date,
            record.direction,
            record.amount_scaled,
            record.transfer_ref,
            record.created_timestamp,
            record.last_updated_timestamp,
            record.updated_device,
            record.metadata_quality,
            record.content_hash,
        )
        if any(value is None or value == "" for value in required):
            raise ValueError(f"Transfer row {record.row_number} is missing required staged values")


def _canonical_values(record: StagedTransferRecord, row_id: str, sequence_no: int) -> dict[str, object]:
    assert record.txn_date and record.direction and record.amount_scaled is not None
    assert record.transfer_ref and record.content_hash
    return {
        "row_id": row_id,
        "sequence_no": sequence_no,
        "txn_date": record.txn_date,
        "direction": record.direction,
        "amount_scaled": record.amount_scaled,
        "description": record.description,
        "transfer_ref": record.transfer_ref,
        "created_timestamp": record.created_timestamp,
        "last_updated_timestamp": record.last_updated_timestamp,
        "updated_device": record.updated_device,
        "metadata_quality": record.metadata_quality,
        "content_hash": record.content_hash,
    }
