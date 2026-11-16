"""Connection-injected Desktop SIP events and derived plan summaries."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from backend.db.core import decimal_to_scaled, scaled_to_decimal, transaction
from backend.db.sip import (
    SIP_CALCULATION_VERSION,
    SipReplay,
    calculate_sip_replay,
    rebuild_sip_plan_summaries,
    list_pending_unit_suggestions,
)
from backend.db.repositories import SipRepository


class SQLiteSipService:
    """SIP event CRUD with plan UUIDs and same-transaction summary rebuilds."""

    def __init__(self, connection, *, device: str):
        self._connection = connection
        self._device = device
        self._repository = SipRepository(connection)

    def create_installment(
        self,
        *,
        entry_date: date | None,
        investment_name: str,
        amount: Decimal,
        charge: Decimal = Decimal(0),
        units: int | None = None,
        sip_plan_id: str | None = None,
    ) -> dict[str, Any]:
        self._require_writable()
        name = _normalize_name(investment_name)
        amount_scaled = _positive_amount(amount, "Installment amount")
        charge_scaled = _nonnegative_amount(charge, "SIP charge")
        normalized_units = _normalize_units(units)
        with transaction(self._connection):
            prior = calculate_sip_replay(self._connection)
            plan_id = self._select_plan_id(prior, name, sip_plan_id)
            row_id = self._repository.create({
                "txn_date": (entry_date or date.today()).isoformat(),
                "investment_name": name,
                "sip_plan_id": plan_id,
                "transaction_type": "sip_installment",
                "amount_scaled": amount_scaled,
                "charge_scaled": charge_scaled,
                "units": normalized_units,
            }, device=self._device)
            replay = rebuild_sip_plan_summaries(self._connection, device=self._device)
        return self._event_payload(row_id, replay)

    def update_installment(
        self,
        *,
        row_id: str,
        entry_date: date | None,
        amount: Decimal,
        charge: Decimal,
        units: int | None,
    ) -> dict[str, Any]:
        self._require_writable()
        amount_scaled = _positive_amount(amount, "Installment amount")
        charge_scaled = _nonnegative_amount(charge, "SIP charge")
        normalized_units = _normalize_units(units)
        with transaction(self._connection):
            existing = self._repository.get(row_id)
            if existing is None or existing["transaction_type"] != "sip_installment":
                raise ValueError("SIP installment was not found")
            updated = self._repository.update(row_id, {
                "txn_date": (entry_date or date.today()).isoformat(),
                "amount_scaled": amount_scaled,
                "charge_scaled": charge_scaled,
                "units": normalized_units,
            }, device=self._device)
            if not updated:
                raise ValueError("SIP installment was not found")
            replay = rebuild_sip_plan_summaries(self._connection, device=self._device)
        return self._event_payload(row_id, replay)

    def redeem_plan(
        self,
        *,
        sip_plan_id: str,
        entry_date: date | None,
        amount_received: Decimal,
        charge: Decimal = Decimal(0),
    ) -> dict[str, Any]:
        self._require_writable()
        plan_id = _canonical_uuid(sip_plan_id)
        amount_scaled = _positive_amount(amount_received, "Redemption amount received")
        charge_scaled = _nonnegative_amount(charge, "SIP redemption charge")
        with transaction(self._connection):
            prior = calculate_sip_replay(self._connection)
            plan = prior.plans.get(plan_id)
            if plan is None:
                raise ValueError("SIP plan was not found")
            if plan["plan_status"] != "open":
                raise ValueError("SIP plan is already fully redeemed; create a new plan UUID for a later purchase")
            row_id = self._repository.create({
                "txn_date": (entry_date or date.today()).isoformat(),
                "investment_name": plan["sip_name"],
                "sip_plan_id": plan_id,
                "transaction_type": "sip_redemption",
                "amount_scaled": amount_scaled,
                "charge_scaled": charge_scaled,
                "units": None,
            }, device=self._device)
            replay = rebuild_sip_plan_summaries(self._connection, device=self._device)
        return self._event_payload(row_id, replay)

    def update_redemption(
        self,
        *,
        row_id: str,
        entry_date: date | None,
        amount_received: Decimal,
        charge: Decimal,
    ) -> dict[str, Any]:
        self._require_writable()
        amount_scaled = _positive_amount(amount_received, "Redemption amount received")
        charge_scaled = _nonnegative_amount(charge, "SIP redemption charge")
        with transaction(self._connection):
            existing = self._repository.get(row_id)
            if existing is None or existing["transaction_type"] != "sip_redemption":
                raise ValueError("SIP redemption was not found")
            updated = self._repository.update(row_id, {
                "txn_date": (entry_date or date.today()).isoformat(),
                "amount_scaled": amount_scaled,
                "charge_scaled": charge_scaled,
                "units": None,
            }, device=self._device)
            if not updated:
                raise ValueError("SIP redemption was not found")
            replay = rebuild_sip_plan_summaries(self._connection, device=self._device)
        return self._event_payload(row_id, replay)

    def delete_event(self, *, row_id: str, note: str | None = None) -> dict[str, Any]:
        self._require_writable()
        with transaction(self._connection):
            deleted = self._repository.delete(row_id, deleted_by_device=self._device, note=note)
            if deleted is None:
                raise ValueError("SIP event was not found")
            replay = rebuild_sip_plan_summaries(self._connection, device=self._device)
        return {"deleted_id": row_id, "remaining_plans": replay.plans}

    def list_transactions(self, sip_plan_id: str | None = None) -> list[dict[str, Any]]:
        if sip_plan_id is None:
            rows = self._connection.execute(
                "SELECT * FROM sip_transactions ORDER BY txn_date, sequence_no, row_id"
            )
        else:
            rows = self._repository.list_for_plan(_canonical_uuid(sip_plan_id))
        return [self._map_transaction(row) for row in rows]

    def list_plan_summaries(self) -> list[dict[str, Any]]:
        self._ensure_summaries_fresh()
        return [dict(row) for row in self._connection.execute(
            "SELECT * FROM sip_plan_summaries ORDER BY sip_name, start_date, sip_plan_id"
        )]

    def list_pending_unit_suggestions(self) -> list[dict[str, Any]]:
        """Return only first-installment prompts; redemption rows are never pending."""
        return [
            self._map_transaction(row)
            for row in list_pending_unit_suggestions(self._connection)
        ]

    def rebuild_summaries(self) -> dict[str, dict[str, Any]]:
        self._require_writable()
        with transaction(self._connection):
            replay = rebuild_sip_plan_summaries(self._connection, device=self._device)
        return replay.plans

    def _select_plan_id(self, replay: SipReplay, name: str, requested_id: str | None) -> str:
        open_plans = [
            plan for plan in replay.plans.values()
            if plan["sip_name"] == name and plan["plan_status"] == "open"
        ]
        if requested_id is not None:
            plan_id = _canonical_uuid(requested_id)
            existing = replay.plans.get(plan_id)
            if existing is not None:
                if existing["sip_name"] != name:
                    raise ValueError("SIP plan ID belongs to a different SIP name")
                if existing["plan_status"] != "open":
                    raise ValueError("SIP plan is already closed; a later purchase requires a new plan UUID")
                return plan_id
            raise ValueError("SIP plan was not found; new plan UUIDs are generated automatically")
        if len(open_plans) > 1:
            raise ValueError("More than one open plan uses this SIP name; select a plan UUID")
        if open_plans:
            return str(open_plans[0]["sip_plan_id"])
        return str(uuid4())

    def _ensure_summaries_fresh(self) -> None:
        expected = {
            str(row["sip_plan_id"]): int(row["last_event_sequence_no"])
            for row in self._connection.execute(
                "SELECT sip_plan_id, MAX(sequence_no) AS last_event_sequence_no "
                "FROM sip_transactions GROUP BY sip_plan_id"
            )
        }
        actual = {
            str(row["sip_plan_id"]): row
            for row in self._connection.execute("SELECT * FROM sip_plan_summaries")
        }
        stale = set(expected) != set(actual)
        if not stale:
            stale = any(
                int(actual[plan_id]["last_event_sequence_no"]) != last_sequence
                or int(actual[plan_id]["calculation_version"]) != SIP_CALCULATION_VERSION
                for plan_id, last_sequence in expected.items()
            )
        if stale:
            self._require_writable()
            with transaction(self._connection):
                rebuild_sip_plan_summaries(self._connection, device=self._device)

    def _event_payload(self, row_id: str, replay: SipReplay) -> dict[str, Any]:
        event = replay.events.get(row_id)
        if event is None:
            raise RuntimeError("SIP event is missing from its completed replay")
        row = self._repository.get(row_id)
        if row is None:
            raise RuntimeError("SIP event disappeared after a committed write")
        return {**event, **self._map_metadata(row)}

    def _map_transaction(self, row) -> dict[str, Any]:
        record = {
            "id": str(row["row_id"]),
            "row_id": str(row["row_id"]),
            "sequence_no": int(row["sequence_no"]),
            "date": str(row["txn_date"]),
            "investment_name": str(row["investment_name"]),
            "sip_plan_id": str(row["sip_plan_id"]),
            "transaction_type": str(row["transaction_type"]),
            "amount": scaled_to_decimal(int(row["amount_scaled"])),
            "charge": scaled_to_decimal(int(row["charge_scaled"])),
            "units": int(row["units"]) if row["units"] is not None else None,
        }
        record.update(self._map_metadata(row))
        return record

    @staticmethod
    def _map_metadata(row) -> dict[str, str]:
        return {
            "created_timestamp": str(row["created_timestamp"]),
            "last_updated_timestamp": str(row["last_updated_timestamp"]),
            "updated_device": str(row["updated_device"]),
            "content_hash": str(row["content_hash"]),
        }

    def _require_writable(self) -> None:
        reason = getattr(self._connection, "read_only_reason", None)
        if reason:
            raise RuntimeError(str(reason))


def _normalize_name(value: str) -> str:
    name = " ".join(str(value or "").split()).upper()
    if not name:
        raise ValueError("SIP name cannot be blank")
    return name


def _positive_amount(value: Decimal, label: str) -> int:
    scaled = decimal_to_scaled(value)
    if scaled <= 0:
        raise ValueError(f"{label} must be greater than zero")
    return scaled


def _nonnegative_amount(value: Decimal, label: str) -> int:
    scaled = decimal_to_scaled(value)
    if scaled < 0:
        raise ValueError(f"{label} cannot be negative")
    return scaled


def _normalize_units(value: int | None) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("SIP units must be blank, zero, or a positive whole number")
    return None if value == 0 else value


def _canonical_uuid(value: str) -> str:
    try:
        return str(UUID(str(value).strip().strip("{}")))
    except (TypeError, ValueError, AttributeError) as error:
        raise ValueError("sip_plan_id must be a valid UUID") from error
