"""Shared normalization for Share Portfolio import payloads."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any


def normalize_ipo_quantity(value: Any) -> int | None:
    """Map a blank or zero IPO allotment to ``None``; preserve positive whole units.

    Workbook import and future device-transfer staging use this same conversion
    before rows reach the canonical SQLite event table.
    """
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, bool):
        raise ValueError("IPO allotted quantity must be blank, zero, or a positive whole number")
    try:
        quantity = Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, TypeError, ValueError) as error:
        raise ValueError("IPO allotted quantity must be blank, zero, or a positive whole number") from error
    if not quantity.is_finite() or quantity < 0 or quantity != quantity.to_integral_value():
        raise ValueError("IPO allotted quantity must be blank, zero, or a positive whole number")
    return None if quantity == 0 else int(quantity)
