"""Explicit-path import and validation for the legacy identity JSON map."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import UUID

from backend.db.repositories.support_repository import import_legacy_identity_entries


def load_legacy_identity_entries(path: str | Path) -> dict[str, str]:
    """Load and validate a legacy identity map without reading environment paths."""
    source = Path(path).expanduser().resolve()
    try:
        contents = source.read_text(encoding="utf-8")
    except OSError:
        raise
    try:
        payload = json.loads(contents, object_pairs_hook=_unique_object)
    except json.JSONDecodeError as error:
        raise ValueError(f"Legacy identity map is not valid JSON: {source.name}") from error
    if not isinstance(payload, dict):
        raise ValueError("Legacy identity map must contain one JSON object.")

    entries: dict[str, str] = {}
    seen_ids: set[str] = set()
    for raw_key, raw_row_id in payload.items():
        if not isinstance(raw_key, str) or not raw_key.strip():
            raise ValueError("Legacy identity map contains a blank or non-text identity key.")
        if not isinstance(raw_row_id, str) or not raw_row_id.strip():
            raise ValueError(f"Legacy identity key {raw_key!r} does not map to a UUID string.")
        try:
            row_id = str(UUID(raw_row_id.strip()))
        except (ValueError, AttributeError) as error:
            raise ValueError(f"Legacy identity key {raw_key!r} has an invalid UUID.") from error
        if row_id in seen_ids:
            raise ValueError(f"Legacy identity map assigns UUID {row_id} more than once.")
        seen_ids.add(row_id)
        if raw_key != raw_key.strip():
            raise ValueError("Legacy identity map keys must not have surrounding whitespace.")
        entries[raw_key] = row_id
    return entries


def import_legacy_identity_file(
    connection,
    path: str | Path,
    *,
    created_timestamp: str | None = None,
) -> tuple[int, int]:
    """Import a validated JSON map inside a caller-owned SQLite transaction."""
    if not connection.in_transaction:
        raise RuntimeError("Legacy identity imports require an active caller-owned transaction")
    entries = load_legacy_identity_entries(path)
    return import_legacy_identity_entries(
        connection,
        entries,
        created_timestamp=created_timestamp,
    )


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Legacy identity map contains duplicate JSON key {key!r}.")
        result[key] = value
    return result
