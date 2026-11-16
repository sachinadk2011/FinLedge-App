"""Canonical SHA-256 hashes for explicit authoritative business fields."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections.abc import Mapping, Sequence
from decimal import Decimal
from typing import Any


_WHITESPACE = re.compile(r"\s+")


def normalize_hash_text(value: str, *, casefold: bool = False, uppercase: bool = False) -> str:
    """Apply the documented Unicode and whitespace rules to hash text fields."""
    normalized = unicodedata.normalize("NFC", value)
    normalized = _WHITESPACE.sub(" ", normalized.strip())
    if uppercase:
        return normalized.upper()
    return normalized.casefold() if casefold else normalized


def canonical_business_payload(
    record: Mapping[str, Any],
    fields: Sequence[str],
) -> dict[str, Any]:
    """Select fields in declared order and reject binary floats from money data."""
    payload: dict[str, Any] = {}
    for field in fields:
        if field not in record:
            raise ValueError(f"Cannot hash a record missing authoritative field {field!r}")
        value = record[field]
        if isinstance(value, float):
            raise TypeError(f"Binary float is not allowed in authoritative field {field!r}")
        if isinstance(value, Decimal):
            value = format(value, "f")
        payload[field] = value
    return payload


def content_hash(record: Mapping[str, Any], fields: Sequence[str]) -> str:
    """Return ``sha256:<hex>`` for the caller-declared business fields."""
    payload = canonical_business_payload(record, fields)
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"

