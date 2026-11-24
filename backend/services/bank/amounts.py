"""Shared Bank currency normalization for workbook and SQLite boundaries."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from backend.db.core import decimal_to_scaled


_CURRENCY_QUANTUM = Decimal("0.01")


def normalize_bank_amount(value: Any, *, allow_excel_float: bool = False) -> Decimal:
    """Normalize Bank currency to cents; floats are accepted only at Excel import edges."""
    if isinstance(value, float) and not allow_excel_float:
        raise TypeError("Bank Services amount must be Decimal, not binary float")
    try:
        amount = value if isinstance(value, Decimal) else Decimal(str(value))
        if not amount.is_finite():
            raise InvalidOperation
        return amount.quantize(_CURRENCY_QUANTUM, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as error:
        raise ValueError("Amount must be a valid currency value.") from error


def bank_amount_to_scaled(value: Any) -> int:
    """Convert an API/service amount to canonical scaled units without accepting floats."""
    return decimal_to_scaled(normalize_bank_amount(value))


def legacy_bank_amount_to_scaled(value: Any) -> int:
    """Normalize an Excel cell (which openpyxl may expose as float) for migration staging."""
    return decimal_to_scaled(normalize_bank_amount(value, allow_excel_float=True))
