"""Connection-scoped repository helpers for shared database support records."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Mapping
from uuid import NAMESPACE_URL, UUID, uuid5

from .metadata import utc_timestamp_now


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

