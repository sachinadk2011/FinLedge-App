"""Exact replay validation for the Bank/Cash transfer income constraint."""

from __future__ import annotations

from decimal import Decimal

from backend.services.personal_finance import SHARE_ONLY_CATEGORIES, destination_flow, origin_flow
from .transfer_directions import normalize_transfer_direction


MONEY_SCALE = 10_000


def validate_transfer_income_timeline(connection) -> None:
    """Raise if existing transfers overdraw either flow in documented event order."""
    events = []
    for row in connection.execute(
        "SELECT txn_date, created_timestamp, sequence_no, flow_type, direction, category, amount_scaled "
        "FROM personal_finance_entries WHERE direction='income'"
    ):
        if str(row["category"] or "").strip().casefold() in SHARE_ONLY_CATEGORIES:
            continue
        flow = str(row["flow_type"] or "").strip().casefold()
        if flow not in {"bank", "cash"}:
            continue
        events.append((
            str(row["txn_date"]), str(row["created_timestamp"]), 0,
            int(row["sequence_no"]), "income", flow, int(row["amount_scaled"]),
        ))

    for row in connection.execute(
        "SELECT txn_date, created_timestamp, sequence_no, direction, amount_scaled FROM transfers"
    ):
        direction = normalize_transfer_direction(row["direction"])
        if not direction:
            raise ValueError(f"Transfer row has unsupported direction {row['direction']!r}")
        events.append((
            str(row["txn_date"]), str(row["created_timestamp"]), 1,
            int(row["sequence_no"]), direction, "", int(row["amount_scaled"]),
        ))

    balances = {"bank": 0, "cash": 0}
    for _date, _timestamp, _priority, _sequence, kind, flow, amount in sorted(events):
        if kind == "income":
            balances[flow] += amount
            continue
        origin = origin_flow(kind)
        destination = destination_flow(kind)
        available = balances[origin]
        if amount > available:
            formatted = Decimal(max(0, available)) / Decimal(MONEY_SCALE)
            raise ValueError(
                f"Transfer would overdraw {origin.title()}; only NPR {formatted:,.2f} is available."
            )
        balances[origin] -= amount
        balances[destination] += amount
