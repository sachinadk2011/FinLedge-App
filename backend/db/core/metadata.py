"""Shared timestamp and device metadata helpers for SQLite-backed writes."""

from __future__ import annotations

from datetime import datetime, timezone
import warnings


def utc_timestamp_now() -> str:
    """Return fixed-width UTC text with microsecond precision."""
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def stamp_create(device: str, *, timestamp: str | None = None) -> dict[str, str]:
    created = timestamp or utc_timestamp_now()
    return {
        "created_timestamp": created,
        "last_updated_timestamp": created,
        "updated_device": _normalize_device(device),
    }


def stamp_material_edit(
    existing: dict,
    device: str,
    *,
    changed: bool,
    timestamp: str | None = None,
) -> dict[str, str]:
    """Preserve creation metadata; update last-writer fields only on change."""
    created = str(existing["created_timestamp"])
    if not changed:
        return {
            "created_timestamp": created,
            "last_updated_timestamp": str(existing["last_updated_timestamp"]),
            "updated_device": str(existing["updated_device"]),
        }
    return {
        "created_timestamp": created,
        "last_updated_timestamp": timestamp or utc_timestamp_now(),
        "updated_device": _normalize_device(device),
    }


def _normalize_device(device: str) -> str:
    value = str(device).strip().casefold()
    if value == "desktop":
        return "legacy"
    allowed = {"desktop-exe", "desktop-appx", "desktop-dev", "desktop-test", "mobile", "legacy"}
    if value not in allowed:
        warnings.warn(
            f"Unknown device label {device!r}; storing the legacy label instead",
            RuntimeWarning,
            stacklevel=2,
        )
        return "legacy"
    return value

