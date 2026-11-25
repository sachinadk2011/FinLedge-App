"""Shared atomic conflict persistence for reviewed workbook imports."""

from __future__ import annotations

from dataclasses import dataclass
import sqlite3
from collections.abc import Callable, Mapping
from typing import Literal

from backend.db.core import transaction
from backend.db.core.metadata import utc_timestamp_now
from backend.db.repositories import DEVICE_LABELS, record_conflict, resolve_conflict
from .sqlite_snapshots import snapshot_before_operation


ConflictDecision = Literal["keep_local", "keep_incoming"]


@dataclass(frozen=True)
class ImportConflictResolution:
    conflict_id: int
    resolution: Literal["kept_local", "kept_incoming"]
    row_updated: bool


def resolve_import_record_conflict(
    connection: sqlite3.Connection,
    repository,
    *,
    row_id: str,
    entity_type: str,
    expected_content_hash: str,
    incoming_values: Mapping[str, object],
    update_values: Mapping[str, object],
    decision: ConflictDecision,
    device: str,
    before_import_snapshot: Callable[[], object] | None = None,
    after_incoming_update: Callable[[], object] | None = None,
) -> ImportConflictResolution:
    """Record the losing version and apply the explicit winner in one transaction."""
    if entity_type not in {"bank", "personal_finance", "share", "sip", "dividend", "transfer"}:
        raise ValueError(f"Unknown conflict entity type: {entity_type!r}")
    if decision not in {"keep_local", "keep_incoming"}:
        raise ValueError("Choose keep_local or keep_incoming")
    if device not in DEVICE_LABELS:
        raise ValueError(f"Unknown device label: {device!r}")
    if connection.in_transaction:
        raise RuntimeError("Conflict resolution must own its transaction boundary")
    if not incoming_values.get("content_hash"):
        raise ValueError("Incoming conflict values are missing their canonical content hash")
    if repository.canonical_content_hash(incoming_values) != incoming_values["content_hash"]:
        raise ValueError("Incoming conflict content hash does not match its canonical business fields")

    snapshot_before_operation(connection, "pre-import", before_import_snapshot)
    with transaction(connection):
        current_row = repository.get(row_id)
        if current_row is None:
            raise ValueError("The local row changed after review; classify the import again")
        current = dict(current_row)
        actual_hash = repository.canonical_content_hash(current)
        if actual_hash != str(current["content_hash"]):
            raise RuntimeError(f"The local {entity_type} row has a stale content hash and must be repaired")
        if current["content_hash"] != expected_content_hash:
            raise ValueError("The local row changed after review; classify the import again")
        if current["content_hash"] == incoming_values["content_hash"]:
            raise ValueError("The incoming row is already present; classify the import again")

        if decision == "keep_local":
            losing_values = dict(incoming_values)
            losing_device = str(incoming_values["updated_device"])
            winning_timestamp = str(current["last_updated_timestamp"])
            resolution = "kept_local"
            row_updated = False
        else:
            losing_values = current
            losing_device = str(current["updated_device"])
            winning_timestamp = utc_timestamp_now()
            updated = repository.update(
                row_id,
                dict(update_values),
                device=device,
                timestamp=winning_timestamp,
            )
            if not updated:
                raise RuntimeError(f"The reviewed {entity_type} row disappeared during conflict resolution")
            if after_incoming_update is not None:
                after_incoming_update()
            resolution = "kept_incoming"
            row_updated = True

        conflict_id = record_conflict(
            connection,
            row_id=row_id,
            entity_type=entity_type,
            losing_values=losing_values,
            losing_device=losing_device,
            winning_timestamp=winning_timestamp,
        )
        resolve_conflict(connection, conflict_id, resolution)

    return ImportConflictResolution(conflict_id, resolution, row_updated)
