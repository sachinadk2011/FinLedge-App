"""Pure Personal Expenses summary calculations, separated from workbook I/O."""

from .excel_utils import to_float as _to_float

SHARE_ONLY_CATEGORIES = {
    "investment",
    "investment expense",
    "investment income",
    "investment return",
    "sip",
    "share market",
    "dividend",
}
LINKED_MODULE_SOURCES = {"share-sync", "bank-services-sync"}


def _empty_flow_summary() -> dict:
    return {
        "income": 0.0,
        "expenses": 0.0,
        "transfer_out": 0.0,
        "transfer_in": 0.0,
        "total_income": 0.0,
        "total_expenses": 0.0,
        "net": 0.0,
        "income_breakdown": {},
        "expense_breakdown": {},
    }


def summarize_personal_finance_records(records: list[dict]) -> dict:
    flow_summaries = {
        "bank": _empty_flow_summary(),
        "cash": _empty_flow_summary(),
    }

    for record in records:
        flow_type = str(record.get("flow_type") or "").strip().lower()
        if flow_type not in flow_summaries:
            continue

        direction = str(record.get("direction") or "").strip().lower()
        category = str(record.get("category") or "").strip() or "Uncategorized"
        source = str(record.get("source") or "manual").strip().lower()
        if source in LINKED_MODULE_SOURCES:
            continue
        if category.casefold() in SHARE_ONLY_CATEGORIES:
            continue
        amount = abs(_to_float(record.get("amount")))
        summary = flow_summaries[flow_type]

        if source == "transfer":
            # Transfers adjust income on each side.
            # signed_amount already encodes direction for this flow:
            #   positive → this flow receives money (income +, net +)
            #   negative → this flow sends money out (income -, net -)
            signed = _to_float(record.get("signed_amount", 0))
            if signed >= 0:
                summary["total_income"] += amount
                summary["income"] += amount
                summary["transfer_in"] += amount
                summary["income_breakdown"]["Transfer In"] = (
                    summary["income_breakdown"].get("Transfer In", 0.0) + amount
                )
            else:
                summary["total_income"] -= amount
                summary["income"] -= amount
                summary["transfer_out"] += amount
                summary["income_breakdown"]["Transfer Out"] = (
                    summary["income_breakdown"].get("Transfer Out", 0.0) + amount
                )
            continue

        if direction == "income":
            summary["total_income"] += amount
            summary["income_breakdown"][category] = summary["income_breakdown"].get(category, 0.0) + amount
            summary["income"] += amount
        else:
            summary["total_expenses"] += amount
            summary["expense_breakdown"][category] = summary["expense_breakdown"].get(category, 0.0) + amount
            summary["expenses"] += amount

    for summary in flow_summaries.values():
        summary["net"] = summary["total_income"] - summary["total_expenses"]

    combined = {
        "overall_income": flow_summaries["bank"]["total_income"] + flow_summaries["cash"]["total_income"],
        "overall_expenses": flow_summaries["bank"]["total_expenses"] + flow_summaries["cash"]["total_expenses"],
        "bank": flow_summaries["bank"],
        "cash": flow_summaries["cash"],
    }
    combined["overall_net"] = combined["overall_income"] - combined["overall_expenses"]

    return {
        "bank": flow_summaries["bank"],
        "cash": flow_summaries["cash"],
        "combined": combined,
    }
