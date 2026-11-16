"""Exact scaled-integer and Decimal mapping for financial database values."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any


MONEY_SCALE = 10_000
PRICE_SCALE = 10_000


def scaled_to_decimal(value: int | None, *, scale: int = MONEY_SCALE) -> Decimal | None:
    if value is None:
        return None
    _validate_scale(scale)
    return Decimal(value) / Decimal(scale)


def decimal_to_scaled(value: Any, *, scale: int = MONEY_SCALE) -> int:
    """Convert exactly; reject excess precision instead of choosing a rounding rule."""
    _validate_scale(scale)
    if isinstance(value, float):
        raise TypeError("Binary float input must be normalized before financial conversion")
    try:
        decimal_value = value if isinstance(value, Decimal) else Decimal(str(value))
    except (InvalidOperation, ValueError) as error:
        raise ValueError(f"Invalid decimal value: {value!r}") from error
    if not decimal_value.is_finite():
        raise ValueError("Financial values must be finite")

    scaled_value = decimal_value * Decimal(scale)
    integral_value = scaled_value.to_integral_value()
    if scaled_value != integral_value:
        raise ValueError(
            f"Value {decimal_value} has more precision than the selected scale supports"
        )
    return int(integral_value)


def _validate_scale(scale: int) -> None:
    if isinstance(scale, bool) or not isinstance(scale, int) or scale <= 0:
        raise ValueError("Scale must be a positive integer")

