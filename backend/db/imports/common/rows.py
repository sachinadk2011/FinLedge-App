"""Shared identity and date normalization for staged workbook rows."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID


def normalize_import_date(value: object | None) -> str | None:
    """Normalize Excel date cells and ISO-like date values to ``YYYY-MM-DD``."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    try:
        return date.fromisoformat(str(value or "").strip()[:10]).isoformat()
    except ValueError:
        return None


def normalize_import_row_id(value: object | None, seen_ids: set[str]) -> tuple[str | None, bool]:
    """Return canonical UUID text and whether it was already seen in this workbook.

    Malformed nonblank values raise ``ValueError``. Blank IDs remain ``None`` so
    the caller can resolve them through the stable legacy identity map.
    """
    text = str(value or "").strip()
    if not text:
        return None, False
    try:
        canonical = str(UUID(text))
    except (ValueError, AttributeError) as error:
        raise ValueError(f"Malformed Row ID {text!r}; review before re-minting.") from error
    duplicate = canonical in seen_ids
    if not duplicate:
        seen_ids.add(canonical)
    return canonical, duplicate
