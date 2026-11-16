"""Canonical Desktop Share identity helpers."""

from __future__ import annotations


def normalize_share_name(value: object) -> str:
    """Trim, collapse whitespace, uppercase, and reject blank share names."""
    canonical = " ".join(str(value or "").split()).upper()
    if not canonical:
        raise ValueError("share name cannot be blank")
    return canonical
