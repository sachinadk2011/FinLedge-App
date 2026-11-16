"""Connection-scoped SQLite Bank Services operations for Desktop migration work.

This module never chooses or creates a database path. The application controls
when it is called and supplies an already-open, migrated connection.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from backend.db.core import scaled_to_decimal, transaction
from backend.db.repositories import BankRepository


_CURRENCY_QUANTUM = Decimal("0.01")
_SCALE = 10_000


class SQLiteBankService:
    """Bank CRUD and summary operations over a caller-supplied SQLite connection."""

    def __init__(self, connection, *, device: str):
        self._connection = connection
        self._device = device
        self._repository = BankRepository(connection)

    def list_records(self) -> list[dict[str, Any]]:
        result = []
        for row in self._repository.list_with_cumulative():
            result.append({
                "id": str(row["row_id"]),
                "row_id": str(row["row_id"]),
                "sequence_no": int(row["sequence_no"]),
                "date": str(row["txn_date"]),
                "category": str(row["category"]),
                "amount": scaled_to_decimal(int(row["amount_scaled"])),
                "cumulative_amount": scaled_to_decimal(int(row["cumulative_amount_scaled"])),
                "description": row["description"],
                "created_timestamp": str(row["created_timestamp"]),
                "last_updated_timestamp": str(row["last_updated_timestamp"]),
                "updated_device": str(row["updated_device"]),
                "content_hash": str(row["content_hash"]),
            })
        return result

    def summarize(self) -> dict[str, Any]:
        return self._repository.summarize()

    def add(
        self,
        *,
        entry_date: date | None,
        category: str,
        amount: Decimal,
        description: str | None = None,
    ) -> dict[str, Any]:
        self._require_writable()
        amount_scaled = _to_bank_scaled(amount)
        with transaction(self._connection):
            row_id = self._repository.create(
                {
                    "txn_date": (entry_date or date.today()).isoformat(),
                    "category": category,
                    "amount_scaled": amount_scaled,
                    "description": _clean_description(description),
                },
                device=self._device,
            )
        return self._record_by_id(row_id)

    def update(
        self,
        *,
        row_id: str,
        entry_date: date | None,
        category: str,
        amount: Decimal,
        description: str | None = None,
    ) -> dict[str, Any]:
        self._require_writable()
        amount_scaled = _to_bank_scaled(amount)
        with transaction(self._connection):
            updated = self._repository.update(
                row_id,
                {
                    "txn_date": (entry_date or date.today()).isoformat(),
                    "category": category,
                    "amount_scaled": amount_scaled,
                    "description": _clean_description(description),
                },
                device=self._device,
            )
            if not updated:
                raise ValueError("Bank record was not found")
        return self._record_by_id(row_id)

    def delete(self, *, row_id: str, note: str | None = None) -> dict[str, Any]:
        self._require_writable()
        with transaction(self._connection):
            deleted = self._repository.delete(
                row_id,
                deleted_by_device=self._device,
                note=note,
            )
            if deleted is None:
                raise ValueError("Bank record was not found")
        return {"deleted_id": row_id}

    def _record_by_id(self, row_id: str) -> dict[str, Any]:
        row = self._repository.get(row_id)
        if row is None:
            raise RuntimeError("Bank record disappeared after a committed write")
        cumulative = self._connection.execute(
            """
            SELECT SUM(amount_scaled) AS cumulative_amount_scaled
            FROM bank_transactions WHERE sequence_no <= ?
            """,
            (int(row["sequence_no"]),),
        ).fetchone()["cumulative_amount_scaled"]
        return {
            "id": str(row["row_id"]),
            "row_id": str(row["row_id"]),
            "sequence_no": int(row["sequence_no"]),
            "date": str(row["txn_date"]),
            "category": str(row["category"]),
            "amount": scaled_to_decimal(int(row["amount_scaled"])),
            "cumulative_amount": scaled_to_decimal(int(cumulative)),
            "description": row["description"],
            "created_timestamp": str(row["created_timestamp"]),
            "last_updated_timestamp": str(row["last_updated_timestamp"]),
            "updated_device": str(row["updated_device"]),
            "content_hash": str(row["content_hash"]),
        }

    def _require_writable(self) -> None:
        reason = getattr(self._connection, "read_only_reason", None)
        if reason:
            raise RuntimeError(str(reason))


def _to_bank_scaled(amount: Decimal) -> int:
    if isinstance(amount, float):
        raise TypeError("Bank Services amount must be Decimal, not binary float")
    try:
        value = amount if isinstance(amount, Decimal) else Decimal(str(amount))
        if not value.is_finite():
            raise InvalidOperation
        rounded = value.quantize(_CURRENCY_QUANTUM, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as error:
        raise ValueError("Amount must be a valid currency value") from error
    return int(rounded * _SCALE)


def _clean_description(value: str | None) -> str | None:
    cleaned = str(value or "").strip()
    return cleaned or None
