from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from io import BytesIO
from typing import Iterable


def _safe_date(value: object) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        try:
            return datetime.fromisoformat(text).date()
        except ValueError:
            return None


def _sorted_keys(d: dict) -> list:
    return sorted(d.keys())


def _render_bar_chart(
    *,
    title: str,
    x_labels: list[str],
    series: list[tuple[str, list[float], str]],
    y_label: str,
) -> bytes:
    # Import lazily so the app can still start even if matplotlib is missing.
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig_w = max(8.0, min(16.0, 0.85 * max(1, len(x_labels))))
    fig, ax = plt.subplots(figsize=(fig_w, 4.6), dpi=150)

    if not x_labels:
        ax.text(0.5, 0.5, "No data yet", ha="center", va="center", fontsize=13)
        ax.set_axis_off()
    else:
        x = list(range(len(x_labels)))
        width = 0.8 / max(1, len(series))
        offset = -(len(series) - 1) * width / 2

        for idx, (name, values, color) in enumerate(series):
            positions = [(pos + offset + (idx * width)) for pos in x]
            ax.bar(positions, values, width=width, label=name, color=color)

        ax.set_xticks(x)
        ax.set_xticklabels(x_labels, rotation=35, ha="right")
        ax.set_ylabel(y_label)
        ax.set_title(title)
        ax.grid(axis="y", alpha=0.25)
        ax.legend(frameon=False, ncols=min(3, len(series)))

    fig.tight_layout()
    buffer = BytesIO()
    fig.savefig(buffer, format="png", transparent=True)
    plt.close(fig)
    buffer.seek(0)
    return buffer.read()


def build_monthly_bank_png(records: Iterable[dict]) -> bytes:
    # month_key -> income/expense
    monthly: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})

    for r in records:
        d = _safe_date(r.get("date"))
        if not d:
            continue
        key = f"{d.year:04d}-{d.month:02d}"
        category = str(r.get("category") or "").strip().lower()
        amt = float(r.get("amount") or 0.0)
        if category == "income":
            monthly[key]["income"] += amt
        else:
            monthly[key]["expense"] += abs(amt)

    keys = _sorted_keys(monthly)
    # Keep it readable: show last 12 months if there are many.
    if len(keys) > 12:
        keys = keys[-12:]

    return _render_bar_chart(
        title="Monthly bank transactions",
        x_labels=keys,
        series=[
            ("Income", [monthly[k]["income"] for k in keys], "#16a34a"),
            ("Expenses", [monthly[k]["expense"] for k in keys], "#ef4444"),
        ],
        y_label="Amount",
    )


def build_yearly_bank_png(records: Iterable[dict]) -> bytes:
    yearly: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})

    for r in records:
        d = _safe_date(r.get("date"))
        if not d:
            continue
        key = f"{d.year:04d}"
        category = str(r.get("category") or "").strip().lower()
        amt = float(r.get("amount") or 0.0)
        if category == "income":
            yearly[key]["income"] += amt
        else:
            yearly[key]["expense"] += abs(amt)

    keys = _sorted_keys(yearly)
    return _render_bar_chart(
        title="Yearly bank transactions",
        x_labels=keys,
        series=[
            ("Income", [yearly[k]["income"] for k in keys], "#16a34a"),
            ("Expenses", [yearly[k]["expense"] for k in keys], "#ef4444"),
        ],
        y_label="Amount",
    )


def build_monthly_share_png(records: Iterable[dict]) -> bytes:
    monthly: dict[str, dict[str, float]] = defaultdict(lambda: {"investment": 0.0, "profit": 0.0})

    for r in records:
        d = _safe_date(r.get("date"))
        if not d:
            continue
        key = f"{d.year:04d}-{d.month:02d}"
        category = str(r.get("category") or "").strip().lower()
        total = float(r.get("total_amount") or 0.0)
        profit = float(r.get("profit_loss") or 0.0)

        if category in {"ipo", "buy"}:
            monthly[key]["investment"] += total
        elif category == "sell":
            monthly[key]["profit"] += profit

    keys = _sorted_keys(monthly)
    if len(keys) > 12:
        keys = keys[-12:]

    return _render_bar_chart(
        title="Monthly share investment and profit",
        x_labels=keys,
        series=[
            ("Investment", [monthly[k]["investment"] for k in keys], "#2563eb"),
            ("Profit/Loss", [monthly[k]["profit"] for k in keys], "#a855f7"),
        ],
        y_label="Amount",
    )


def build_yearly_share_png(records: Iterable[dict]) -> bytes:
    yearly: dict[str, dict[str, float]] = defaultdict(lambda: {"investment": 0.0, "profit": 0.0})

    for r in records:
        d = _safe_date(r.get("date"))
        if not d:
            continue
        key = f"{d.year:04d}"
        category = str(r.get("category") or "").strip().lower()
        total = float(r.get("total_amount") or 0.0)
        profit = float(r.get("profit_loss") or 0.0)

        if category in {"ipo", "buy"}:
            yearly[key]["investment"] += total
        elif category == "sell":
            yearly[key]["profit"] += profit

    keys = _sorted_keys(yearly)
    return _render_bar_chart(
        title="Yearly share investment and profit",
        x_labels=keys,
        series=[
            ("Investment", [yearly[k]["investment"] for k in keys], "#2563eb"),
            ("Profit/Loss", [yearly[k]["profit"] for k in keys], "#a855f7"),
        ],
        y_label="Amount",
    )


def build_combined_position_png(*, bank_summary: dict, share_summary: dict) -> bytes:
    bank_income = float(bank_summary.get("total_income") or 0.0)
    bank_expenses = float(bank_summary.get("total_expenses") or 0.0)
    share_investment = float(share_summary.get("overall_investment") or 0.0)
    share_profit = float(share_summary.get("overall_profit_loss") or 0.0)

    bank_net = bank_income - bank_expenses
    overall_net = bank_net - share_investment + share_profit

    labels = ["Bank net", "Share investment", "Share profit/loss", "Overall net"]
    values = [bank_net, share_investment, share_profit, overall_net]

    return _render_bar_chart(
        title="Combined financial position",
        x_labels=labels,
        series=[("Position", values, "#0f766e")],
        y_label="Amount",
    )


def build_monthly_overview_png(*, bank_records: Iterable[dict], share_records: Iterable[dict]) -> bytes:
    monthly: dict[str, dict[str, float]] = defaultdict(
        lambda: {"bank_income": 0.0, "bank_expense": 0.0, "share_investment": 0.0, "share_profit": 0.0}
    )

    for r in bank_records:
        d = _safe_date(r.get("date"))
        if not d:
            continue
        key = f"{d.year:04d}-{d.month:02d}"
        category = str(r.get("category") or "").strip().lower()
        amt = float(r.get("amount") or 0.0)
        if category == "income":
            monthly[key]["bank_income"] += amt
        else:
            monthly[key]["bank_expense"] += abs(amt)

    for r in share_records:
        d = _safe_date(r.get("date"))
        if not d:
            continue
        key = f"{d.year:04d}-{d.month:02d}"
        category = str(r.get("category") or "").strip().lower()
        total = float(r.get("total_amount") or 0.0)
        profit = float(r.get("profit_loss") or 0.0)
        if category in {"ipo", "buy"}:
            monthly[key]["share_investment"] += total
        elif category == "sell":
            monthly[key]["share_profit"] += profit

    keys = _sorted_keys(monthly)
    if len(keys) > 12:
        keys = keys[-12:]

    return _render_bar_chart(
        title="Monthly financial overview",
        x_labels=keys,
        series=[
            ("Bank income", [monthly[k]["bank_income"] for k in keys], "#16a34a"),
            ("Bank expenses", [monthly[k]["bank_expense"] for k in keys], "#ef4444"),
            ("Share investment", [monthly[k]["share_investment"] for k in keys], "#2563eb"),
            ("Share profit/loss", [monthly[k]["share_profit"] for k in keys], "#a855f7"),
        ],
        y_label="Amount",
    )


def build_yearly_overview_png(*, bank_records: Iterable[dict], share_records: Iterable[dict]) -> bytes:
    yearly: dict[str, dict[str, float]] = defaultdict(
        lambda: {"bank_income": 0.0, "bank_expense": 0.0, "share_investment": 0.0, "share_profit": 0.0}
    )

    for r in bank_records:
        d = _safe_date(r.get("date"))
        if not d:
            continue
        key = f"{d.year:04d}"
        category = str(r.get("category") or "").strip().lower()
        amt = float(r.get("amount") or 0.0)
        if category == "income":
            yearly[key]["bank_income"] += amt
        else:
            yearly[key]["bank_expense"] += abs(amt)

    for r in share_records:
        d = _safe_date(r.get("date"))
        if not d:
            continue
        key = f"{d.year:04d}"
        category = str(r.get("category") or "").strip().lower()
        total = float(r.get("total_amount") or 0.0)
        profit = float(r.get("profit_loss") or 0.0)
        if category in {"ipo", "buy"}:
            yearly[key]["share_investment"] += total
        elif category == "sell":
            yearly[key]["share_profit"] += profit

    keys = _sorted_keys(yearly)
    return _render_bar_chart(
        title="Yearly financial overview",
        x_labels=keys,
        series=[
            ("Bank income", [yearly[k]["bank_income"] for k in keys], "#16a34a"),
            ("Bank expenses", [yearly[k]["bank_expense"] for k in keys], "#ef4444"),
            ("Share investment", [yearly[k]["share_investment"] for k in keys], "#2563eb"),
            ("Share profit/loss", [yearly[k]["share_profit"] for k in keys], "#a855f7"),
        ],
        y_label="Amount",
    )
