"""Connection-scoped repository helpers for shared database support records."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Mapping
from uuid import NAMESPACE_URL, UUID, uuid5

from ..core.metadata import utc_timestamp_now


SEQUENCE_KEYS = {
    "share": "share_sequence_next",
    "sip": "sip_sequence_next",
}
ENTITY_TYPES = {"bank", "personal_finance", "share", "sip", "dividend", "transfer"}
DEVICE_LABELS = {"desktop-exe", "desktop-appx", "desktop-dev", "desktop-test", "mobile", "legacy"}


def allocate_sequence(connection: sqlite3.Connection, scope: str) -> int:
    """Allocate the next non-reusable sequence inside the caller's transaction."""
    _require_transaction(connection)
    if scope == "share":
        key = SEQUENCE_KEYS["share"]
    elif scope == "sip":
        key = SEQUENCE_KEYS["sip"]
    else:
        raise ValueError(f"Unknown sequence scope: {scope!r}")

    row = connection.execute(
        "UPDATE app_metadata "
        "SET value = CAST(value AS INTEGER) + 1 "
        "WHERE key = ? AND CAST(value AS INTEGER) > 0 "
        "RETURNING CAST(value AS INTEGER) - 1 AS allocated_sequence",
        (key,),
    ).fetchone()
    if row is None:
        raise RuntimeError(f"Sequence metadata {key!r} is missing or invalid")
    return int(row["allocated_sequence"])


def add_tombstone(
    connection: sqlite3.Connection,
    *,
    row_id: str,
    entity_type: str,
    deleted_by_device: str,
    sequence_no: int | None = None,
    note: str | None = None,
    deleted_timestamp: str | None = None,
) -> None:
    """Write a deletion tombstone as part of the caller's delete transaction."""
    _require_transaction(connection)
    _validate_uuid(row_id, "row_id")
    if entity_type not in ENTITY_TYPES:
        raise ValueError(f"Unknown tombstone entity type: {entity_type!r}")
    if deleted_by_device not in DEVICE_LABELS:
        raise ValueError(f"Unknown device label: {deleted_by_device!r}")
    if sequence_no is not None and sequence_no <= 0:
        raise ValueError("sequence_no must be positive when provided")

    connection.execute(
        "INSERT INTO deleted_records "
        "(row_id, entity_type, deleted_timestamp, deleted_by_device, sequence_no, note) "
        "VALUES (?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(row_id) DO UPDATE SET "
        "entity_type=excluded.entity_type, "
        "deleted_timestamp=excluded.deleted_timestamp, "
        "deleted_by_device=excluded.deleted_by_device, "
        "sequence_no=excluded.sequence_no, note=excluded.note "
        "WHERE excluded.deleted_timestamp > deleted_records.deleted_timestamp",
        (
            row_id,
            entity_type,
            deleted_timestamp or utc_timestamp_now(),
            deleted_by_device,
            sequence_no,
            note,
        ),
    )


def get_tombstone(connection: sqlite3.Connection, row_id: str) -> dict[str, object] | None:
    """Return the persisted tombstone for a UUID without changing database state."""
    _validate_uuid(row_id, "row_id")
    row = connection.execute(
        "SELECT row_id, entity_type, deleted_timestamp, deleted_by_device, sequence_no, note "
        "FROM deleted_records WHERE row_id = ?",
        (row_id,),
    ).fetchone()
    return dict(row) if row is not None else None


def resolve_legacy_row_id(connection: sqlite3.Connection, identity_key: str) -> str:
    """Return the persisted UUID for a legacy identity key, creating it once."""
    _require_transaction(connection)
    normalized_key = str(identity_key).strip()
    if not normalized_key:
        raise ValueError("identity_key cannot be blank")

    existing = connection.execute(
        "SELECT row_id FROM legacy_identity_map WHERE identity_key = ?",
        (normalized_key,),
    ).fetchone()
    if existing is not None:
        return str(existing["row_id"])

    row_id = str(uuid5(NAMESPACE_URL, f"finledge-row-v1:{normalized_key}"))
    connection.execute(
        "INSERT INTO legacy_identity_map(identity_key, row_id, created_timestamp) "
        "VALUES (?, ?, ?)",
        (normalized_key, row_id, utc_timestamp_now()),
    )
    return row_id


def import_legacy_identity_entries(
    connection: sqlite3.Connection,
    entries: Mapping[str, str],
    *,
    created_timestamp: str | None = None,
) -> tuple[int, int]:
    """Idempotently import a pre-existing identity map before legacy rows are staged."""
    _require_transaction(connection)
    imported = 0
    already_present = 0
    timestamp = created_timestamp or utc_timestamp_now()
    for identity_key, row_id in entries.items():
        if not isinstance(identity_key, str) or not identity_key.strip():
            raise ValueError("identity_key cannot be blank")
        key = identity_key
        canonical_row_id = str(row_id)
        _validate_uuid(canonical_row_id, "row_id")

        by_key = connection.execute(
            "SELECT row_id FROM legacy_identity_map WHERE identity_key = ?", (key,)
        ).fetchone()
        if by_key is not None:
            if str(by_key["row_id"]) != canonical_row_id:
                raise ValueError(f"Legacy identity key {key!r} is already mapped to a different row_id")
            already_present += 1
            continue

        by_id = connection.execute(
            "SELECT identity_key FROM legacy_identity_map WHERE row_id = ?", (canonical_row_id,)
        ).fetchone()
        if by_id is not None:
            raise ValueError(f"Legacy row_id {canonical_row_id} is already assigned to another identity key")

        connection.execute(
            "INSERT INTO legacy_identity_map(identity_key, row_id, created_timestamp) VALUES (?, ?, ?)",
            (key, canonical_row_id, timestamp),
        )
        imported += 1
    return imported, already_present


def record_conflict(
    connection: sqlite3.Connection,
    *,
    row_id: str,
    entity_type: str,
    losing_values: Mapping,
    losing_device: str,
    winning_timestamp: str | None = None,
    detected_timestamp: str | None = None,
) -> int:
    """Persist a losing merge version using canonical JSON and return its ID."""
    _require_transaction(connection)
    _validate_uuid(row_id, "row_id")
    if entity_type not in ENTITY_TYPES:
        raise ValueError(f"Unknown conflict entity type: {entity_type!r}")
    if losing_device not in DEVICE_LABELS:
        raise ValueError(f"Unknown device label: {losing_device!r}")
    try:
        losing_json = json.dumps(
            losing_values,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        )
    except (TypeError, ValueError) as error:
        raise ValueError("Conflict values must be canonical JSON-compatible data") from error

    connection.execute(
        "INSERT INTO record_conflicts "
        "(row_id, entity_type, losing_values_json, losing_device, winning_timestamp, detected_timestamp) "
        "VALUES (?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(row_id, losing_device, losing_values_json) DO NOTHING",
        (
            row_id,
            entity_type,
            losing_json,
            losing_device,
            winning_timestamp,
            detected_timestamp or utc_timestamp_now(),
        ),
    )
    row = connection.execute(
        "SELECT conflict_id FROM record_conflicts "
        "WHERE row_id=? AND losing_device=? AND losing_values_json=?",
        (row_id, losing_device, losing_json),
    ).fetchone()
    return int(row["conflict_id"])


def resolve_conflict(
    connection: sqlite3.Connection,
    conflict_id: int,
    resolution: str,
    *,
    resolved_timestamp: str | None = None,
) -> None:
    """Resolve a recorded conflict in the caller's transaction, idempotently."""
    _require_transaction(connection)
    if isinstance(conflict_id, bool) or not isinstance(conflict_id, int) or conflict_id <= 0:
        raise ValueError("conflict_id must be a positive integer")
    if resolution not in {"kept_local", "kept_incoming", "merged", "dismissed"}:
        raise ValueError(f"Unsupported conflict resolution: {resolution!r}")

    existing = connection.execute(
        "SELECT resolution FROM record_conflicts WHERE conflict_id = ?", (conflict_id,)
    ).fetchone()
    if existing is None:
        raise ValueError(f"Conflict {conflict_id} does not exist")
    current = str(existing["resolution"])
    if current == resolution:
        return
    if current != "pending":
        raise ValueError(f"Conflict {conflict_id} is already resolved as {current}")
    connection.execute(
        "UPDATE record_conflicts SET resolution = ?, resolved_timestamp = ? "
        "WHERE conflict_id = ? AND resolution = 'pending'",
        (resolution, resolved_timestamp or utc_timestamp_now(), conflict_id),
    )


def _validate_uuid(value: str, field: str) -> None:
    try:
        parsed = UUID(str(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise ValueError(f"{field} must be a canonical UUID") from error
    if str(parsed) != str(value):
        raise ValueError(f"{field} must be a lowercase canonical UUID")


def _require_transaction(connection: sqlite3.Connection) -> None:
    if not connection.in_transaction:
        raise RuntimeError("Support repository writes require an active transaction")

