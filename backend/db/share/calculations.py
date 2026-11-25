"""Weighted-average Share replay and full derived-holdings rebuild."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..core.metadata import utc_timestamp_now
from ..repositories.record_repository import replace_share_holding


SHARE_CALCULATION_VERSION = 1


class ShareReplayError(ValueError):
    """A canonical Share event makes the ordered financial timeline invalid."""

    def __init__(self, code: str, message: str, *, row_id: str, share_name: str, txn_date: str):
        super().__init__(message)
        self.code = code
        self.row_id = row_id
        self.share_name = share_name
        self.txn_date = txn_date


@dataclass(frozen=True)
class ShareReplay:
    events: dict[str, dict[str, Any]]
    holdings: dict[str, dict[str, Any]]


def calculate_share_replay(connection) -> ShareReplay:
    """Replay share trades and dividends by `(txn_date, sequence_no)`.

    SIP is intentionally excluded. Event financial values stay as scaled
    integers, and weighted-average fractions are rounded only at the stored
    4-decimal currency boundary.
    """
    states: dict[str, dict[str, int]] = {}
    names: dict[str, str] = {}
    for row in connection.execute("SELECT share_id, name FROM shares"):
        share_id = str(row["share_id"])
        names[share_id] = str(row["name"])
        states[share_id] = _empty_state()

    event_rows = connection.execute(
        """
        SELECT row_id, sequence_no, txn_date, share_id, 'share' AS entity_type,
               transaction_type AS event_type, per_unit_price_scaled,
               quantity, charge_scaled, NULL AS cash_amount_scaled
        FROM share_transactions
        UNION ALL
        SELECT row_id, sequence_no, txn_date, share_id, 'dividend' AS entity_type,
               event_type, NULL AS per_unit_price_scaled, quantity,
               NULL AS charge_scaled, cash_amount_scaled
        FROM dividend_events
        ORDER BY txn_date, sequence_no, row_id
        """
    )

    event_results: dict[str, dict[str, Any]] = {}
    cumulative_profit_scaled = 0
    for row in event_rows:
        row_id = str(row["row_id"])
        sequence_no = int(row["sequence_no"])
        txn_date = str(row["txn_date"])
        share_id = str(row["share_id"])
        share_name = names.get(share_id, share_id)
        state = states.setdefault(share_id, _empty_state())
        event_type = str(row["event_type"])
        quantity = int(row["quantity"] or 0)
        total_amount_scaled = 0
        profit_loss_scaled = 0

        if row["entity_type"] == "share":
            price_scaled = int(row["per_unit_price_scaled"])
            charge_scaled = int(row["charge_scaled"])
            if event_type == "ipo":
                total_amount_scaled = price_scaled * quantity + charge_scaled
                if quantity > 0:
                    state["quantity"] += quantity
                    state["total_cost_scaled"] += total_amount_scaled
            elif event_type == "buy":
                total_amount_scaled = price_scaled * quantity + charge_scaled
                state["quantity"] += quantity
                state["total_cost_scaled"] += total_amount_scaled
            elif event_type == "sell":
                if quantity <= 0 or quantity > state["quantity"]:
                    message = "Not enough available quantity to sell for this share."
                    raise _event_error("insufficient_quantity", message, row_id, share_name, txn_date)
                total_amount_scaled = price_scaled * quantity - charge_scaled
                if total_amount_scaled <= 0:
                    raise _event_error(
                        "invalid_net_proceeds", "Sell charge must be less than gross sale proceeds.",
                        row_id, share_name, txn_date,
                    )
                if quantity == state["quantity"]:
                    cost_basis_scaled = state["total_cost_scaled"]
                else:
                    cost_basis_scaled = _round_half_up(
                        state["total_cost_scaled"] * quantity, state["quantity"]
                    )
                state["quantity"] -= quantity
                state["total_cost_scaled"] -= cost_basis_scaled
                if state["quantity"] == 0:
                    state["total_cost_scaled"] = 0
                profit_loss_scaled = total_amount_scaled - cost_basis_scaled
                state["realized_profit_loss_scaled"] += profit_loss_scaled
        elif event_type == "cash":
            if state["quantity"] <= 0:
                raise _event_error(
                    "no_holding_at_event_date",
                    f"Cannot record a cash dividend for {share_name} on {txn_date}: no shares are held at that point.",
                    row_id, share_name, txn_date,
                )
            total_amount_scaled = int(row["cash_amount_scaled"] or 0)
            profit_loss_scaled = total_amount_scaled
            state["cash_dividends_scaled"] += total_amount_scaled
        elif event_type == "bonus":
            if state["quantity"] <= 0:
                raise _event_error(
                    "no_holding_at_event_date",
                    f"Cannot record bonus shares for {share_name} on {txn_date}: no shares are held at that point.",
                    row_id, share_name, txn_date,
                )
            if quantity <= 0:
                raise _event_error(
                    "invalid_bonus_quantity", "Bonus share quantity must be greater than zero.",
                    row_id, share_name, txn_date,
                )
            state["quantity"] += quantity
            state["bonus_units"] += quantity
        else:
            raise _event_error(
                "invalid_event_type", f"Unsupported Share event type: {event_type}",
                row_id, share_name, txn_date,
            )

        cumulative_profit_scaled += profit_loss_scaled
        state["last_event_sequence_no"] = max(state["last_event_sequence_no"], sequence_no)
        average_cost_scaled = (
            _round_half_up(state["total_cost_scaled"], state["quantity"])
            if state["quantity"] > 0 else 0
        )
        event_results[row_id] = {
            "row_id": row_id,
            "share_id": share_id,
            "share_name": share_name,
            "entity_type": str(row["entity_type"]),
            "event_type": event_type,
            "sequence_no": sequence_no,
            "txn_date": txn_date,
            "total_amount_scaled": total_amount_scaled,
            "profit_loss_scaled": profit_loss_scaled,
            "cumulative_profit_scaled": cumulative_profit_scaled,
            "holding_quantity": state["quantity"],
            "average_cost_scaled": average_cost_scaled,
            "holding_cost_scaled": state["total_cost_scaled"],
        }

    holdings = {}
    for share_id, state in states.items():
        quantity = state["quantity"]
        holdings[share_id] = {
            "share_id": share_id,
            "quantity": quantity,
            "total_cost_scaled": state["total_cost_scaled"],
            "average_cost_scaled": (
                _round_half_up(state["total_cost_scaled"], quantity) if quantity > 0 else 0
            ),
            "realized_profit_loss_scaled": state["realized_profit_loss_scaled"],
            "cash_dividends_scaled": state["cash_dividends_scaled"],
            "bonus_units": state["bonus_units"],
            "last_event_sequence_no": state["last_event_sequence_no"],
        }
    return ShareReplay(events=event_results, holdings=holdings)


def rebuild_share_holdings(
    connection,
    *,
    device: str,
    timestamp: str | None = None,
) -> ShareReplay:
    """Replace all materialized share summaries from canonical event replay.

    The caller must wrap this full rebuild and any event mutation in the same
    transaction. This function never opens its own connection or transaction.
    """
    if not connection.in_transaction:
        raise RuntimeError("Share summary rebuild requires an active caller-owned transaction")
    replay = calculate_share_replay(connection)
    updated_at = timestamp or utc_timestamp_now()
    connection.execute("DELETE FROM share_holdings")
    for summary in replay.holdings.values():
        replace_share_holding(connection, {
            **summary,
            "calculation_version": SHARE_CALCULATION_VERSION,
            "summary_updated_timestamp": updated_at,
            "summary_updated_device": device,
        })
    return replay


def _empty_state() -> dict[str, int]:
    return {
        "quantity": 0,
        "total_cost_scaled": 0,
        "realized_profit_loss_scaled": 0,
        "cash_dividends_scaled": 0,
        "bonus_units": 0,
        "last_event_sequence_no": 0,
    }


def _round_half_up(numerator: int, denominator: int) -> int:
    if denominator <= 0:
        raise ValueError("denominator must be positive")
    quotient, remainder = divmod(numerator, denominator)
    return quotient + (1 if remainder * 2 >= denominator else 0)


def _event_error(code: str, message: str, row_id: str, share_name: str, txn_date: str) -> ShareReplayError:
    return ShareReplayError(code, message, row_id=row_id, share_name=share_name, txn_date=txn_date)
