"""Shared Excel header aliases, normalization, lookup, and row mapping."""

from __future__ import annotations

from typing import Any


HEADER_ALIASES: dict[str, str] = {
    "cumulative total": "Cumulative Amount",
    "cumulative balance": "Cumulative Amount",
    "running total": "Cumulative Amount",
    "timestamp": "Created Timestamp",
    "created at": "Created Timestamp",
    "created timestamp": "Created Timestamp",
    "type": "Direction",
    "transaction type": "Direction",
    "transfer direction": "Direction",
    "note": "Description",
    "notes": "Description",
    "remarks": "Description",
}


def header_key(value: object) -> str:
    """Return a whitespace-normalized, alias-aware, case-insensitive header key."""
    raw = " ".join(str(value or "").strip().casefold().replace("_", " ").split())
    canonical = HEADER_ALIASES.get(raw, raw)
    return " ".join(str(canonical).strip().casefold().split())


def normalize_header(value: object) -> str:
    """Return the canonical display spelling for known aliases."""
    raw = " ".join(str(value or "").strip().casefold().replace("_", " ").split())
    return HEADER_ALIASES.get(raw, str(value or "").strip())


def header_indexes(headers: list[object]) -> dict[str, int]:
    return {header_key(header): index for index, header in enumerate(headers) if header_key(header)}


def get_header_value(headers: list[object], row: list[Any] | tuple[Any, ...], name: str, default: Any = None) -> Any:
    index = header_indexes(headers).get(header_key(name))
    return row[index] if index is not None and index < len(row) else default


def map_workbook_row(
    source_headers: list[object],
    row: list[Any] | tuple[Any, ...],
    target_headers: list[object],
) -> list[Any]:
    """Map one row by normalized header name and apply shared audit defaults."""
    source_indexes = header_indexes(source_headers)
    created_index = source_indexes.get(header_key("Created Timestamp"))
    created = row[created_index] if created_index is not None and created_index < len(row) else None
    result = []
    for header in target_headers:
        key = header_key(header)
        index = source_indexes.get(key)
        value = row[index] if index is not None and index < len(row) else None
        if key == "last updated timestamp" and not value:
            value = created
        elif key == "updated device" and not value:
            value = "legacy"
        result.append(value)
    return result
