from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
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

    # Stable size so images render nicely inside the app and don't become ultra-wide.
    fig, ax = plt.subplots(figsize=(10.5, 4.8), dpi=150)

    if not x_labels:
        ax.text(0.5, 0.5, "No data yet", ha="center", va="center", fontsize=13)
        ax.set_axis_off()
    else:
        x = list(range(len(x_labels)))
        width = 0.86 / max(1, len(series))
        offset = -(len(series) - 1) * width / 2

        for idx, (name, values, color) in enumerate(series):
            positions = [(pos + offset + (idx * width)) for pos in x]
            bars = ax.bar(positions, values, width=width, label=name, color=color)

            # Show values on bars (helps readability in the app).
            for bar, v in zip(bars, values, strict=False):
                v = float(v or 0.0)
                if abs(v) < 1e-9:
                    continue
                x_text = bar.get_x() + (bar.get_width() / 2)
                # Use the bar "end" (y + height) so negatives and positives behave consistently.
                y_text = float(bar.get_y() + bar.get_height())
                # Always offset upward so negative labels sit closer to zero (and stay visible).
                va = "bottom"
                pad = 2.0
                ax.annotate(
                    f"{v:,.2f}",
                    (x_text, y_text),
                    textcoords="offset points",
                    xytext=(0, pad),
                    ha="center",
                    va=va,
                    fontsize=7,
                    color="#0f172a",
                    clip_on=False,
                )

        ax.set_xticks(x)
        ax.set_xticklabels(x_labels, rotation=45, ha="right")
        ax.set_ylabel(y_label)
        ax.set_title(title)
        ax.grid(axis="y", alpha=0.25)
        ax.axhline(0, color="#0f172a", linewidth=0.8, alpha=0.55)
        ax.legend(frameon=False, ncols=min(3, len(series)))

        # Ensure negative values are visible.
        all_values: list[float] = []
        for _, values, _ in series:
            all_values.extend([float(v or 0.0) for v in values])
        if all_values:
            vmin = min(all_values)
            vmax = max(all_values)
            if vmin == vmax:
                vmin -= 1.0
                vmax += 1.0
            margin = 0.12 * (vmax - vmin)
            ax.set_ylim(vmin - margin, vmax + margin)

    fig.tight_layout()
    buffer = BytesIO()
    fig.savefig(buffer, format="png", transparent=False, facecolor="white")
    plt.close(fig)
    buffer.seek(0)
    return buffer.read()


def _iter_dated_records(records: Iterable[dict]) -> list[tuple[date, dict]]:
    dated: list[tuple[date, dict]] = []
    for r in records:
        d = _safe_date(r.get("date"))
        if d:
            dated.append((d, r))
    return dated


def _last_n_days_window(dated: list[tuple[date, dict]], days: int) -> tuple[date, date]:
    anchor = max((d for d, _ in dated), default=date.today())
    end = anchor
    start = end - timedelta(days=days - 1)
    return start, end


def _day_keys(start: date, end: date) -> list[date]:
    keys: list[date] = []
    cur = start
    while cur <= end:
        keys.append(cur)
        cur += timedelta(days=1)
    return keys


def _format_day_label(d: date) -> str:
    # Short label to keep the x-axis readable inside the app UI.
    return d.strftime("%b %d")


def _format_month_label(month_key: str) -> str:
    # month_key: YYYY-MM
    try:
        year_s, month_s = month_key.split("-", 1)
        return date(int(year_s), int(month_s), 1).strftime("%b %Y")
    except Exception:
        return month_key


def build_monthly_bank_png(records: Iterable[dict]) -> bytes:
    # Day-wise activity for the last 14 days (matches "date-wise" request).
    dated = _iter_dated_records(records)
    start, end = _last_n_days_window(dated, 14)
    day_keys = _day_keys(start, end)

    by_day: dict[date, dict[str, float]] = {d: {"income": 0.0, "expense": 0.0} for d in day_keys}

    for d, r in dated:
        if d < start or d > end:
            continue
        category = str(r.get("category") or "").strip().lower()
        amt = float(r.get("amount") or 0.0)
        if category == "income":
            by_day[d]["income"] += amt
        else:
            by_day[d]["expense"] += abs(amt)

    keys = day_keys

    return _render_bar_chart(
        title="Monthly bank transactions (last 14 days)",
        x_labels=[_format_day_label(k) for k in keys],
        series=[
            ("Income", [by_day[k]["income"] for k in keys], "#16a34a"),
            ("Expenses", [by_day[k]["expense"] for k in keys], "#ef4444"),
        ],
        y_label="Amount",
    )


def build_yearly_bank_png(records: Iterable[dict]) -> bytes:
    # Month-wise totals for the last 12 months.
    dated = _iter_dated_records(records)
    anchor = max((d for d, _ in dated), default=date.today())

    keys: list[str] = []
    y = anchor.year
    m = anchor.month
    for _ in range(12):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    keys.reverse()

    by_month: dict[str, dict[str, float]] = {k: {"income": 0.0, "expense": 0.0} for k in keys}

    for d, r in dated:
        key = f"{d.year:04d}-{d.month:02d}"
        if key not in by_month:
            continue
        category = str(r.get("category") or "").strip().lower()
        amt = float(r.get("amount") or 0.0)
        if category == "income":
            by_month[key]["income"] += amt
        else:
            by_month[key]["expense"] += abs(amt)

    return _render_bar_chart(
        title="Yearly bank transactions (last 12 months)",
        x_labels=[_format_month_label(k) for k in keys],
        series=[
            ("Income", [by_month[k]["income"] for k in keys], "#16a34a"),
            ("Expenses", [by_month[k]["expense"] for k in keys], "#ef4444"),
        ],
        y_label="Amount",
    )


def build_monthly_share_png(records: Iterable[dict]) -> bytes:
    dated = _iter_dated_records(records)
    start, end = _last_n_days_window(dated, 14)
    day_keys = _day_keys(start, end)

    by_day: dict[date, dict[str, float]] = {d: {"investment": 0.0, "profit": 0.0} for d in day_keys}

    for d, r in dated:
        if d < start or d > end:
            continue
        category = str(r.get("category") or "").strip().lower()
        total = float(r.get("total_amount") or 0.0)
        profit = float(r.get("profit_loss") or 0.0)
        if category in {"ipo", "buy"}:
            by_day[d]["investment"] += total
        elif category == "sell":
            by_day[d]["profit"] += profit

    keys = day_keys

    return _render_bar_chart(
        title="Monthly share investment and profit (last 14 days)",
        x_labels=[_format_day_label(k) for k in keys],
        series=[
            ("Investment", [by_day[k]["investment"] for k in keys], "#2563eb"),
            ("Profit/Loss", [by_day[k]["profit"] for k in keys], "#a855f7"),
        ],
        y_label="Amount",
    )


def build_yearly_share_png(records: Iterable[dict]) -> bytes:
    dated = _iter_dated_records(records)
    anchor = max((d for d, _ in dated), default=date.today())

    keys: list[str] = []
    y = anchor.year
    m = anchor.month
    for _ in range(12):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    keys.reverse()

    by_month: dict[str, dict[str, float]] = {k: {"investment": 0.0, "profit": 0.0} for k in keys}

    for d, r in dated:
        key = f"{d.year:04d}-{d.month:02d}"
        if key not in by_month:
            continue
        category = str(r.get("category") or "").strip().lower()
        total = float(r.get("total_amount") or 0.0)
        profit = float(r.get("profit_loss") or 0.0)
        if category in {"ipo", "buy"}:
            by_month[key]["investment"] += total
        elif category == "sell":
            by_month[key]["profit"] += profit

    return _render_bar_chart(
        title="Yearly share investment and profit (last 12 months)",
        x_labels=[_format_month_label(k) for k in keys],
        series=[
            ("Investment", [by_month[k]["investment"] for k in keys], "#2563eb"),
            ("Profit/Loss", [by_month[k]["profit"] for k in keys], "#a855f7"),
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
    # Day-wise view (last 14 days) so users can see "on this date, this much".
    bank_dated = _iter_dated_records(bank_records)
    share_dated = _iter_dated_records(share_records)
    start, end = _last_n_days_window(bank_dated + share_dated, 14)
    day_keys = _day_keys(start, end)

    by_day: dict[date, dict[str, float]] = {
        d: {"bank_income": 0.0, "bank_expense": 0.0, "share_investment": 0.0, "share_profit": 0.0}
        for d in day_keys
    }

    for d, r in bank_dated:
        if d < start or d > end:
            continue
        category = str(r.get("category") or "").strip().lower()
        amt = float(r.get("amount") or 0.0)
        if category == "income":
            by_day[d]["bank_income"] += amt
        else:
            by_day[d]["bank_expense"] += abs(amt)

    for d, r in share_dated:
        if d < start or d > end:
            continue
        category = str(r.get("category") or "").strip().lower()
        total = float(r.get("total_amount") or 0.0)
        profit = float(r.get("profit_loss") or 0.0)
        if category in {"ipo", "buy"}:
            by_day[d]["share_investment"] += total
        elif category == "sell":
            by_day[d]["share_profit"] += profit

    keys = day_keys

    return _render_bar_chart(
        title="Monthly financial overview (last 14 days)",
        x_labels=[_format_day_label(k) for k in keys],
        series=[
            ("Bank income", [by_day[k]["bank_income"] for k in keys], "#16a34a"),
            ("Bank expenses", [by_day[k]["bank_expense"] for k in keys], "#ef4444"),
            ("Share investment", [by_day[k]["share_investment"] for k in keys], "#2563eb"),
            ("Share profit/loss", [by_day[k]["share_profit"] for k in keys], "#a855f7"),
        ],
        y_label="Amount",
    )


def build_yearly_overview_png(*, bank_records: Iterable[dict], share_records: Iterable[dict]) -> bytes:
    # Month-wise view (last 12 months), which is what most people mean by "yearly".
    bank_dated = _iter_dated_records(bank_records)
    share_dated = _iter_dated_records(share_records)
    anchor = max((d for d, _ in (bank_dated + share_dated)), default=date.today())

    keys: list[str] = []
    y = anchor.year
    m = anchor.month
    for _ in range(12):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    keys.reverse()

    by_month: dict[str, dict[str, float]] = {
        k: {"bank_income": 0.0, "bank_expense": 0.0, "share_investment": 0.0, "share_profit": 0.0} for k in keys
    }

    for d, r in bank_dated:
        key = f"{d.year:04d}-{d.month:02d}"
        if key not in by_month:
            continue
        category = str(r.get("category") or "").strip().lower()
        amt = float(r.get("amount") or 0.0)
        if category == "income":
            by_month[key]["bank_income"] += amt
        else:
            by_month[key]["bank_expense"] += abs(amt)

    for d, r in share_dated:
        key = f"{d.year:04d}-{d.month:02d}"
        if key not in by_month:
            continue
        category = str(r.get("category") or "").strip().lower()
        total = float(r.get("total_amount") or 0.0)
        profit = float(r.get("profit_loss") or 0.0)
        if category in {"ipo", "buy"}:
            by_month[key]["share_investment"] += total
        elif category == "sell":
            by_month[key]["share_profit"] += profit

    return _render_bar_chart(
        title="Yearly financial overview (last 12 months)",
        x_labels=[_format_month_label(k) for k in keys],
        series=[
            ("Bank income", [by_month[k]["bank_income"] for k in keys], "#16a34a"),
            ("Bank expenses", [by_month[k]["bank_expense"] for k in keys], "#ef4444"),
            ("Share investment", [by_month[k]["share_investment"] for k in keys], "#2563eb"),
            ("Share profit/loss", [by_month[k]["share_profit"] for k in keys], "#a855f7"),
        ],
        y_label="Amount",
    )
