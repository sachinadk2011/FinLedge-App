"""Canonical SIP plan replay and versioned derived summary rebuild."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..core.metadata import utc_timestamp_now
from ..repositories.record_repository import replace_sip_plan_summary


SIP_CALCULATION_VERSION = 1


class SipReplayError(ValueError):
    """A canonical SIP event sequence violates plan lifecycle rules."""

    def __init__(self, code: str, message: str, *, row_id: str, sip_plan_id: str, sip_name: str):
        super().__init__(message)
        self.code = code
        self.row_id = row_id
        self.sip_plan_id = sip_plan_id
        self.sip_name = sip_name


@dataclass(frozen=True)
class SipReplay:
    events: dict[str, dict[str, Any]]
    plans: dict[str, dict[str, Any]]


def calculate_sip_replay(connection) -> SipReplay:
    """Derive installment principal, units, redemption P/L, and plan status."""
    events: dict[str, dict[str, Any]] = {}
    states: dict[str, dict[str, Any]] = {}
    rows = connection.execute(
        "SELECT * FROM sip_transactions ORDER BY txn_date, sequence_no, row_id"
    )
    for row in rows:
        row_id = str(row["row_id"])
        plan_id = str(row["sip_plan_id"])
        name = " ".join(str(row["investment_name"] or "").split()).upper()
        event_type = str(row["transaction_type"])
        txn_date = str(row["txn_date"])
        state = states.get(plan_id)
        if state is None:
            state = _empty_plan(plan_id, name, txn_date)
            states[plan_id] = state
        elif state["sip_name"] != name:
            raise _error(
                "plan_name_mismatch", "A SIP plan must keep one canonical name.",
                row_id, plan_id, name,
            )
        if state["plan_status"] == "closed":
            raise _error(
                "plan_already_closed", f"SIP plan '{name}' is already fully redeemed.",
                row_id, plan_id, name,
            )

        amount_scaled = int(row["amount_scaled"])
        charge_scaled = int(row["charge_scaled"])
        units = row["units"]
        investment_total_scaled = 0
        profit_loss_scaled = 0
        if event_type == "sip_installment":
            investment_total_scaled = amount_scaled + charge_scaled
            state["outstanding_principal_scaled"] += investment_total_scaled
            if units is None:
                state["pending_installment_count"] += 1
            else:
                state["updated_units_total"] += int(units)
        elif event_type == "sip_redemption":
            if units is not None:
                raise _error(
                    "redemption_units_not_null", "SIP redemption units must be NULL.",
                    row_id, plan_id, name,
                )
            if state["outstanding_principal_scaled"] <= 0:
                raise _error(
                    "redemption_without_principal", f"SIP plan '{name}' has no invested principal to redeem.",
                    row_id, plan_id, name,
                )
            investment_total_scaled = amount_scaled
            profit_loss_scaled = amount_scaled - state["outstanding_principal_scaled"]
            state["total_redeemed_scaled"] += amount_scaled
            state["realized_profit_loss_scaled"] += profit_loss_scaled
            state["outstanding_principal_scaled"] = 0
            state["plan_status"] = "closed"
        else:
            raise _error(
                "invalid_transaction_type", f"Unsupported SIP transaction type: {event_type}",
                row_id, plan_id, name,
            )

        state["last_event_sequence_no"] = max(state["last_event_sequence_no"], int(row["sequence_no"]))
        events[row_id] = {
            "row_id": row_id,
            "sip_plan_id": plan_id,
            "investment_name": name,
            "transaction_type": event_type,
            "txn_date": txn_date,
            "sequence_no": int(row["sequence_no"]),
            "amount_scaled": amount_scaled,
            "charge_scaled": charge_scaled,
            "units": int(units) if units is not None else None,
            "investment_total_scaled": investment_total_scaled,
            "profit_loss_scaled": profit_loss_scaled,
            "outstanding_principal_scaled": state["outstanding_principal_scaled"],
            "updated_units_total": state["updated_units_total"],
            "pending_installment_count": state["pending_installment_count"],
            "total_redeemed_scaled": state["total_redeemed_scaled"],
            "plan_status": state["plan_status"],
        }

    return SipReplay(events=events, plans=states)


def rebuild_sip_plan_summaries(
    connection,
    *,
    device: str,
    timestamp: str | None = None,
) -> SipReplay:
    """Replace all SIP summaries from canonical events in the caller's transaction."""
    if not connection.in_transaction:
        raise RuntimeError("SIP summary rebuild requires an active caller-owned transaction")
    replay = calculate_sip_replay(connection)
    updated_at = timestamp or utc_timestamp_now()
    connection.execute("DELETE FROM sip_plan_summaries")
    for plan in replay.plans.values():
        replace_sip_plan_summary(connection, {
            **plan,
            "calculation_version": SIP_CALCULATION_VERSION,
            "summary_updated_timestamp": updated_at,
            "summary_updated_device": device,
        })
    return replay


def _empty_plan(sip_plan_id: str, sip_name: str, start_date: str) -> dict[str, Any]:
    return {
        "sip_plan_id": sip_plan_id,
        "sip_name": sip_name,
        "start_date": start_date,
        "outstanding_principal_scaled": 0,
        "updated_units_total": 0,
        "pending_installment_count": 0,
        "total_redeemed_scaled": 0,
        "realized_profit_loss_scaled": 0,
        "plan_status": "open",
        "last_event_sequence_no": 0,
    }


def _error(code: str, message: str, row_id: str, plan_id: str, name: str) -> SipReplayError:
    return SipReplayError(code, message, row_id=row_id, sip_plan_id=plan_id, sip_name=name)
