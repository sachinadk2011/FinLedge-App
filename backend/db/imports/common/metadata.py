"""Reusable legacy timestamp normalization for staged workbook imports."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone


@dataclass(frozen=True)
class NormalizedImportTimestamps:
    created_timestamp: str
    last_updated_timestamp: str
    metadata_quality: str
    created_quality: str
    updated_quality: str


def normalize_import_timestamps(
    created_value: object | None,
    updated_value: object | None,
    txn_date: str | None,
    *,
    import_timestamp: str,
) -> NormalizedImportTimestamps:
    """Apply schema §9.4 without changing historic wall-clock digits."""
    created_timestamp, created_quality = _normalize_one(created_value, txn_date, import_timestamp)
    if _is_blank(updated_value):
        updated_timestamp, updated_quality = created_timestamp, created_quality
    else:
        updated_timestamp, updated_quality = _normalize_one(updated_value, txn_date, import_timestamp)
    return NormalizedImportTimestamps(
        created_timestamp=created_timestamp,
        last_updated_timestamp=updated_timestamp,
        metadata_quality=created_quality,
        created_quality=created_quality,
        updated_quality=updated_quality,
    )


def _normalize_one(value: object | None, txn_date: str | None, import_timestamp: str) -> tuple[str, str]:
    if _is_blank(value):
        if txn_date:
            return f"{txn_date}T00:00:00.000000Z", "backfilled"
        return import_timestamp, "imported_missing"

    if isinstance(value, datetime):
        return _format_datetime(value)
    if isinstance(value, date):
        return f"{value.isoformat()}T00:00:00.000000Z", "legacy_date_only"

    text = str(value).strip()
    try:
        parsed_date = date.fromisoformat(text)
    except ValueError:
        parsed_date = None
    if parsed_date is not None:
        return f"{parsed_date.isoformat()}T00:00:00.000000Z", "legacy_date_only"

    iso_text = text[:-1] + "+00:00" if text.endswith(("Z", "z")) else text
    try:
        parsed = datetime.fromisoformat(iso_text)
    except ValueError as error:
        raise ValueError(f"Invalid timestamp value: {text!r}") from error
    return _format_datetime(parsed, explicit_offset=("+" in text[10:] or "-" in text[10:]))


def _format_datetime(value: datetime, *, explicit_offset: bool | None = None) -> tuple[str, str]:
    aware = value.tzinfo is not None and value.utcoffset() is not None
    if explicit_offset is None:
        explicit_offset = aware
    if aware:
        normalized = value.astimezone(timezone.utc)
        quality = "legacy_offset" if explicit_offset else "exact"
    else:
        normalized = value
        quality = "legacy_naive"
    formatted = normalized.isoformat(timespec="microseconds")
    if aware:
        formatted = formatted.replace("+00:00", "Z")
    else:
        formatted += "Z"
    return formatted, quality


def _is_blank(value: object | None) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())
