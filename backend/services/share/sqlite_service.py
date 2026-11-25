"""Connection-injected Desktop Share event writes and weighted-average replay."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import uuid4

from backend.db.core import decimal_to_scaled, scaled_to_decimal, transaction
from backend.db.repositories import DividendRepository, ShareRepository
from backend.db.share import list_share_history, normalize_share_name, rebuild_share_holdings
from .import_normalization import normalize_ipo_quantity


class SQLiteShareService:
    """Atomic canonical Share operations; the caller owns database lifecycle."""

    def __init__(self, connection, *, device: str):
        self._connection = connection
        self._device = device
        self._shares = ShareRepository(connection)
        self._dividends = DividendRepository(connection)

    def create_share_transaction(
        self,
        *,
        entry_date: date | None,
        share_name: str,
        transaction_type: str,
        per_unit_price: Decimal,
        quantity: int | None,
        charge: Decimal | None = None,
    ) -> dict[str, Any]:
        self._require_writable()
        name = normalize_share_name(share_name)
        kind = _share_transaction_type(transaction_type)
        price_scaled = decimal_to_scaled(per_unit_price)
        if price_scaled < 0:
            raise ValueError("Per-unit price cannot be negative")
        quantity = _normalize_quantity(kind, quantity)
        charge_scaled = _share_charge(kind, charge, creating=True)
        with transaction(self._connection):
            share = self._resolve_share(name)
            row_id = self._shares.create({
                "txn_date": (entry_date or date.today()).isoformat(),
                "share_id": str(share["share_id"]),
                "transaction_type": kind,
                "per_unit_price_scaled": price_scaled,
                "quantity": quantity,
                "charge_scaled": charge_scaled,
            }, device=self._device)
            replay = rebuild_share_holdings(self._connection, device=self._device)
        return self._event_payload(row_id, replay)

    def update_share_transaction(
        self,
        *,
        row_id: str,
        entry_date: date | None,
        per_unit_price: Decimal,
        quantity: int | None,
        charge: Decimal | None = None,
    ) -> dict[str, Any]:
        self._require_writable()
        price_scaled = decimal_to_scaled(per_unit_price)
        if price_scaled < 0:
            raise ValueError("Per-unit price cannot be negative")
        with transaction(self._connection):
            existing = self._shares.get(row_id)
            if existing is None:
                raise ValueError("Share transaction was not found")
            kind = str(existing["transaction_type"])
            normalized_quantity = _normalize_quantity(kind, quantity)
            normalized_charge = _share_charge(
                kind,
                charge if charge is not None else Decimal(int(existing["charge_scaled"])) / Decimal(10_000),
                creating=False,
            )
            updated = self._shares.update(row_id, {
                "txn_date": (entry_date or date.today()).isoformat(),
                "per_unit_price_scaled": price_scaled,
                "quantity": normalized_quantity,
                "charge_scaled": normalized_charge,
            }, device=self._device)
            if not updated:
                raise ValueError("Share transaction was not found")
            replay = rebuild_share_holdings(self._connection, device=self._device)
        return self._event_payload(row_id, replay)

    def delete_share_transaction(self, *, row_id: str, note: str | None = None) -> dict[str, Any]:
        self._require_writable()
        with transaction(self._connection):
            deleted = self._shares.delete(row_id, deleted_by_device=self._device, note=note)
            if deleted is None:
                raise ValueError("Share transaction was not found")
            replay = rebuild_share_holdings(self._connection, device=self._device)
        return {"deleted_id": row_id, "remaining_holdings": replay.holdings}

    def create_dividend_event(
        self,
        *,
        entry_date: date | None,
        share_name: str,
        event_type: str,
        cash_amount: Decimal | None = None,
        bonus_quantity: int | None = None,
    ) -> dict[str, Any]:
        self._require_writable()
        name = normalize_share_name(share_name)
        kind = str(event_type or "").strip().casefold()
        if kind not in {"cash", "bonus"}:
            raise ValueError("event_type must be 'cash' or 'bonus'")
        cash_scaled, quantity = _dividend_values(kind, cash_amount, bonus_quantity)
        with transaction(self._connection):
            share = self._resolve_share(name)
            row_id = self._dividends.create({
                "txn_date": (entry_date or date.today()).isoformat(),
                "share_id": str(share["share_id"]),
                "event_type": kind,
                "cash_amount_scaled": cash_scaled,
                "quantity": quantity,
            }, device=self._device)
            replay = rebuild_share_holdings(self._connection, device=self._device)
        return self._event_payload(row_id, replay)

    def update_dividend_event(
        self,
        *,
        row_id: str,
        entry_date: date | None,
        cash_amount: Decimal | None = None,
        bonus_quantity: int | None = None,
    ) -> dict[str, Any]:
        self._require_writable()
        with transaction(self._connection):
            existing = self._dividends.get(row_id)
            if existing is None:
                raise ValueError("Dividend event was not found")
            kind = str(existing["event_type"])
            cash_scaled, quantity = _dividend_values(kind, cash_amount, bonus_quantity)
            updated = self._dividends.update(row_id, {
                "txn_date": (entry_date or date.today()).isoformat(),
                "cash_amount_scaled": cash_scaled,
                "quantity": quantity,
            }, device=self._device)
            if not updated:
                raise ValueError("Dividend event was not found")
            replay = rebuild_share_holdings(self._connection, device=self._device)
        return self._event_payload(row_id, replay)

    def delete_dividend_event(self, *, row_id: str, note: str | None = None) -> dict[str, Any]:
        self._require_writable()
        with transaction(self._connection):
            deleted = self._dividends.delete(row_id, deleted_by_device=self._device, note=note)
            if deleted is None:
                raise ValueError("Dividend event was not found")
            replay = rebuild_share_holdings(self._connection, device=self._device)
        return {"deleted_id": row_id, "remaining_holdings": replay.holdings}

    def rebuild_holdings(self) -> dict[str, dict[str, Any]]:
        self._require_writable()
        with transaction(self._connection):
            replay = rebuild_share_holdings(self._connection, device=self._device)
        return replay.holdings

    def list_history(
        self,
        *,
        investment_name: str | None = None,
        limit: int = 500,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List a read-only unified history while retaining each source row identity."""
        return [
            {
                "row_id": str(row["row_id"]),
                "entity_type": str(row["entity_type"]),
                "sequence_no": int(row["sequence_no"]),
                "date": str(row["txn_date"]),
                "investment_name": str(row["investment_name"]),
                "transaction_type": str(row["transaction_type"]),
                "quantity": int(row["quantity"]) if row["quantity"] is not None else None,
                "units": int(row["units"]) if row["units"] is not None else None,
                "amount": (
                    scaled_to_decimal(int(row["amount_scaled"]))
                    if row["amount_scaled"] is not None else None
                ),
                "sip_plan_id": str(row["sip_plan_id"]) if row["sip_plan_id"] is not None else None,
            }
            for row in list_share_history(
                self._connection,
                investment_name=investment_name,
                limit=limit,
                offset=offset,
            )
        ]

    def _resolve_share(self, canonical_name: str):
        existing = self._connection.execute(
            "SELECT share_id, name FROM shares WHERE name=?", (canonical_name,)
        ).fetchone()
        if existing is not None:
            return existing
        return self._shares.ensure_share(share_id=str(uuid4()), name=canonical_name)

    def _event_payload(self, row_id: str, replay) -> dict[str, Any]:
        event = replay.events.get(row_id)
        if event is None:
            raise RuntimeError("Share event is missing from its completed replay")
        entity_type = event["entity_type"]
        table = "share_transactions" if entity_type == "share" else "dividend_events"
        row = self._connection.execute(f"SELECT * FROM {table} WHERE row_id=?", (row_id,)).fetchone()
        return {
            **event,
            "created_timestamp": str(row["created_timestamp"]),
            "last_updated_timestamp": str(row["last_updated_timestamp"]),
            "updated_device": str(row["updated_device"]),
            "content_hash": str(row["content_hash"]),
        }

    def _require_writable(self) -> None:
        reason = getattr(self._connection, "read_only_reason", None)
        if reason:
            raise RuntimeError(str(reason))


def _share_transaction_type(value: str) -> str:
    kind = str(value or "").strip().casefold()
    if kind not in {"ipo", "buy", "sell"}:
        raise ValueError("transaction_type must be 'ipo', 'buy', or 'sell'")
    return kind


def _normalize_quantity(transaction_type: str, value: int | None) -> int | None:
    if transaction_type == "ipo":
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError("IPO allotted quantity must be zero, blank, or a positive whole number")
        return normalize_ipo_quantity(value)
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError("Buy/sell quantity must be a positive whole number")
    return value


def _share_charge(transaction_type: str, charge: Decimal | None, *, creating: bool) -> int:
    if transaction_type == "ipo":
        value = Decimal("5.00") if charge is None and creating else (charge or Decimal("0"))
    else:
        value = charge or Decimal("0")
    scaled = decimal_to_scaled(value)
    if scaled < 0:
        raise ValueError("Charge cannot be negative")
    return scaled


def _dividend_values(
    event_type: str,
    cash_amount: Decimal | None,
    bonus_quantity: int | None,
) -> tuple[int | None, int | None]:
    if event_type == "cash":
        if cash_amount is None:
            raise ValueError("Cash dividends require an amount and cannot include bonus shares")
        if bonus_quantity is not None and (
            isinstance(bonus_quantity, bool) or not isinstance(bonus_quantity, int) or bonus_quantity != 0
        ):
            raise ValueError("Cash dividends require an amount and cannot include bonus shares")
        cash_scaled = decimal_to_scaled(cash_amount)
        if cash_scaled < 0:
            raise ValueError("Cash dividend amount cannot be negative")
        return cash_scaled, None
    if bonus_quantity is None or isinstance(bonus_quantity, bool) or not isinstance(bonus_quantity, int) or bonus_quantity <= 0:
        raise ValueError("Bonus share quantity must be a positive whole number")
    if cash_amount is not None and decimal_to_scaled(cash_amount) != 0:
        raise ValueError("Bonus events cannot include a cash amount")
    return None, bonus_quantity
