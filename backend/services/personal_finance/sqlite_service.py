"""Connection-injected SQLite service for Desktop Personal Finance data."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Iterable, Mapping

from backend.db.core import decimal_to_scaled, scaled_to_decimal, transaction
from backend.db.repositories import PersonalFinanceRepository
from backend.models import PF_EXPENSE_CATEGORIES, PF_INCOME_CATEGORIES
from .summary import LINKED_MODULE_SOURCES, SHARE_ONLY_CATEGORIES
from .transfer_directions import (
    destination_flow,
    normalize_transfer_direction,
    origin_flow,
    transfer_flow_label,
)


_FLOW_TYPES = {"bank", "cash"}
_DIRECTIONS = {"income", "expense"}


class SQLitePersonalFinanceService:
    """Manual Personal Finance CRUD and query-time transfer projectionsp

    The service never selects or creates a database pathp Read-only linked rows
    are supplied by their owning module and are never persisted here.
    """

    def __init__(self, connection, *, device: str):
        self._connection = connection
        self._device = device
        self._repository = PersonalFinanceRepository(connection)

    def add(
        self,
        *,
        entry_date: date | None,
        flow_type: str,
        direction: str,
        category: str,
        amount: Decimal,
        description: str | None = None,
    ) -> dict[str, Any]:
        self._require_writable()
        flow, action, category_value, amount_scaled = _validated_entry(
            flow_type, direction, category, amount
        )
        with transaction(self._connection):
            row_id = self._repository.create(
                {
                    "txn_date": (entry_date or date.today()).isoformat(),
                    "flow_type": flow,
                    "direction": action,
                    "category": category_value,
                    "amount_scaled": amount_scaled,
                    "description": _clean_description(description),
                },
                device=self._device,
            )
        return self._entry_by_id(row_id)

    def update(
        self,
        *,
        row_id: str,
        entry_date: date | None,
        flow_type: str,
        direction: str,
        category: str,
        amount: Decimal,
        description: str | None = None,
    ) -> dict[str, Any]:
        self._require_writable()
        flow, action, category_value, amount_scaled = _validated_entry(
            flow_type, direction, category, amount
        )
        with transaction(self._connection):
            updated = self._repository.update(
                row_id,
                {
                    "txn_date": (entry_date or date.today()).isoformat(),
                    "flow_type": flow,
                    "direction": action,
                    "category": category_value,
                    "amount_scaled": amount_scaled,
                    "description": _clean_description(description),
                },
                device=self._device,
            )
            if not updated:
                raise ValueError("Personal Finance record was not found")
        return self._entry_by_id(row_id)

    def delete(self, *, row_id: str, note: str | None = None) -> dict[str, Any]:
        self._require_writable()
        with transaction(self._connection):
            deleted = self._repository.delete(
                row_id,
                deleted_by_device=self._device,
                note=note,
            )
            if deleted is None:
                raise ValueError("Personal Finance record was not found")
        return {"deleted_id": row_id}

    def list_records(
        self,
        flow_type: str | None = None,
        *,
        read_only_records: Iterable[Mapping[str, Any]] = (),
    ) -> list[dict[str, Any]]:
        flow_filter = _normalize_flow_filter(flow_type)
        manual_rows = self._connection.execute(
            "SELECT * FROM personal_finance_entries ORDER BY sequence_no"
        )
        records = [self._map_manual_row(row) for row in manual_rows]
        transfers = self._transfer_projections(flow_filter)
        records.extend(transfers)
        for supplied in read_only_records:
            source = str(supplied.get("source") or "").strip().casefold()
            if source not in LINKED_MODULE_SOURCES:
                raise ValueError("Only linked-module rows can be supplied as Personal Finance read-only records")
            row_flow = str(supplied.get("flow_type") or "").strip().casefold()
            if row_flow not in _FLOW_TYPES or (flow_filter in _FLOW_TYPES and row_flow != flow_filter):
                continue
            projection = dict(supplied)
            projection.pop("row_id", None)
            projection["id"] = projection.get("id") or f"{source}:{projection.get('source_ref') or projection.get('display_id') or 'row'}"
            projection["display_id"] = projection.get("display_id") or str(projection["id"])
            projection["read_only"] = True
            records.append(projection)

        if flow_filter in _FLOW_TYPES:
            records = [row for row in records if row.get("flow_type") == flow_filter]
        elif flow_filter == "combined":
            records = [row for row in records if row.get("source") != "transfer" or row.get("origin_side")]
        return sorted(
            records,
            key=lambda row: (
                str(row.get("timestamp") or row.get("last_updated_timestamp") or ""),
                str(row.get("date") or ""),
                str(row.get("display_id") or row.get("id") or ""),
            ),
        )

    def summarize(
        self,
        *,
        read_only_records: Iterable[Mapping[str, Any]] = (),
    ) -> dict[str, Any]:
        records = [self._map_manual_row(row) for row in self._connection.execute(
            "SELECT * FROM personal_finance_entries ORDER BY sequence_no"
        )]
        records.extend(self._transfer_projections("all"))
        records.extend(dict(row) for row in read_only_records)
        return _summarize_exact(records)

    def _transfer_projections(self, flow_filter: str) -> list[dict[str, Any]]:
        rows = self._connection.execute("SELECT * FROM transfers ORDER BY sequence_no")
        projections = []
        for row in rows:
            direction = normalize_transfer_direction(row["direction"])
            if not direction:
                continue
            origin, destination = origin_flow(direction), destination_flow(direction)
            amount = scaled_to_decimal(int(row["amount_scaled"]))
            sides = ((origin, -amount, True), (destination, amount, False))
            for side, signed, is_origin in sides:
                if flow_filter in _FLOW_TYPES and side != flow_filter:
                    continue
                if flow_filter == "combined" and not is_origin:
                    continue
                label = transfer_flow_label(direction, side)
                description = str(row["description"] or "").strip()
                projections.append({
                    "id": f"transfer:{row['row_id']}:{side}",
                    "display_id": f"T-{int(row['sequence_no'])}-{side[0].upper()}",
                    "transfer_id": str(row["row_id"]),
                    "date": str(row["txn_date"]),
                    "flow_type": side,
                    "direction": "transfer",
                    "category": "Transfer",
                    "amount": amount,
                    "signed_amount": signed,
                    "description": f"{label}{': ' + description if description else ''}",
                    "source": "transfer",
                    "transfer_direction": direction,
                    "source_ref": str(row["transfer_ref"]),
                    "timestamp": str(row["last_updated_timestamp"]),
                    "created_timestamp": str(row["created_timestamp"]),
                    "last_updated_timestamp": str(row["last_updated_timestamp"]),
                    "updated_device": str(row["updated_device"]),
                    "read_only": True,
                    "origin_side": is_origin,
                })
        return projections

    def _map_manual_row(self, row) -> dict[str, Any]:
        flow = str(row["flow_type"])
        sequence = int(row["sequence_no"])
        return {
            "id": str(row["row_id"]),
            "display_id": f"{flow[0].upper()}-{sequence}",
            "row_id": str(row["row_id"]),
            "sequence_no": sequence,
            "date": str(row["txn_date"]),
            "flow_type": flow,
            "direction": str(row["direction"]),
            "category": str(row["category"]),
            "amount": scaled_to_decimal(int(row["amount_scaled"])),
            "signed_amount": scaled_to_decimal(int(row["signed_amount_scaled"])),
            "description": row["description"],
            "source": "manual",
            "source_ref": "",
            "timestamp": str(row["last_updated_timestamp"]),
            "created_timestamp": str(row["created_timestamp"]),
            "last_updated_timestamp": str(row["last_updated_timestamp"]),
            "updated_device": str(row["updated_device"]),
            "content_hash": str(row["content_hash"]),
            "read_only": False,
        }

    def _entry_by_id(self, row_id: str) -> dict[str, Any]:
        row = self._repository.get(row_id)
        if row is None:
            raise RuntimeError("Personal Finance record disappeared after a committed write")
        return self._map_manual_row(row)

    def _require_writable(self) -> None:
        reason = getattr(self._connection, "read_only_reason", None)
        if reason:
            raise RuntimeError(str(reason))


def _validated_entry(flow_type: str, direction: str, category: str, amount: Decimal):
    flow = str(flow_type or "").strip().casefold()
    action = str(direction or "").strip().casefold()
    category_value = str(category or "").strip()
    if flow not in _FLOW_TYPES:
        raise ValueError("flow_type must be 'bank' or 'cash'")
    if action not in _DIRECTIONS:
        raise ValueError("direction must be 'income' or 'expense'")
    allowed = PF_INCOME_CATEGORIES if action == "income" else PF_EXPENSE_CATEGORIES
    categories = {item.value: item.value for item in allowed}
    if category_value not in categories:
        raise ValueError(f"{action.title()} entries must use a matching Personal Finance category")
    amount_scaled = decimal_to_scaled(amount)
    if amount_scaled <= 0:
        raise ValueError("amount must be greater than zero")
    return flow, action, categories[category_value], amount_scaled


def _normalize_flow_filter(flow_type: str | None) -> str:
    value = str(flow_type or "combined").strip().casefold()
    if value not in {*_FLOW_TYPES, "combined"}:
        raise ValueError("flow_type must be 'bank', 'cash', or 'combined'")
    return value


def _summarize_exact(records: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    summaries = {flow: _empty_summary() for flow in _FLOW_TYPES}
    for record in records:
        flow = str(record.get("flow_type") or "").strip().casefold()
        if flow not in summaries:
            continue
        source = str(record.get("source") or "manual").strip().casefold()
        category = str(record.get("category") or "").strip() or "Uncategorized"
        if source in LINKED_MODULE_SOURCES or category.casefold() in SHARE_ONLY_CATEGORIES:
            continue
        amount = abs(_as_decimal(record.get("amount", 0)))
        summary = summaries[flow]
        if source == "transfer":
            signed_amount = _as_decimal(record.get("signed_amount", 0))
            if signed_amount >= 0:
                summary["total_income"] += amount
                summary["income"] += amount
                summary["transfer_in"] += amount
                _add_breakdown(summary["income_breakdown"], "Transfer In", amount)
            else:
                summary["total_income"] -= amount
                summary["income"] -= amount
                summary["transfer_out"] += amount
                _add_breakdown(summary["income_breakdown"], "Transfer Out", amount)
            continue
        direction = str(record.get("direction") or "").strip().casefold()
        if direction == "income":
            summary["total_income"] += amount
            summary["income"] += amount
            _add_breakdown(summary["income_breakdown"], category, amount)
        else:
            summary["total_expenses"] += amount
            summary["expenses"] += amount
            _add_breakdown(summary["expense_breakdown"], category, amount)

    for summary in summaries.values():
        summary["net"] = summary["total_income"] - summary["total_expenses"]
    combined = {
        "overall_income": summaries["bank"]["total_income"] + summaries["cash"]["total_income"],
        "overall_expenses": summaries["bank"]["total_expenses"] + summaries["cash"]["total_expenses"],
        "bank": summaries["bank"],
        "cash": summaries["cash"],
    }
    combined["overall_net"] = combined["overall_income"] - combined["overall_expenses"]
    return {"bank": summaries["bank"], "cash": summaries["cash"], "combined": combined}


def _empty_summary() -> dict[str, Any]:
    zero = Decimal(0)
    return {
        "income": zero,
        "expenses": zero,
        "transfer_out": zero,
        "transfer_in": zero,
        "total_income": zero,
        "total_expenses": zero,
        "net": zero,
        "income_breakdown": {},
        "expense_breakdown": {},
    }


def _add_breakdown(breakdown: dict[str, Decimal], category: str, amount: Decimal) -> None:
    breakdown[category] = breakdown.get(category, Decimal(0)) + amount


def _as_decimal(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        return Decimal(str(value))
    return Decimal(str(value or 0))


def _clean_description(value: str | None) -> str | None:
    cleaned = str(value or "").strip()
    return cleaned or None
