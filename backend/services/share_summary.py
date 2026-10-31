"""Pure aggregate calculations for Share Portfolio records."""

from datetime import date

from .excel_utils import to_float as _to_float


def summarize_share_records(
    records: list[dict],
    all_records: list[dict] | None = None,
    closing_end_date: date | str | None = None,
) -> dict:
    total_ipo_investment = 0.0
    total_sip_investment = 0.0
    total_sip_redeemed = 0.0
    sip_profit_loss = 0.0
    total_buy_amount = 0.0
    total_sell_amount = 0.0
    total_profit = 0.0
    total_dividend = 0.0
    bonus_shares_received = 0

    for record in records:
        category = str(record.get("category") or "").strip().lower()
        buy_sell = str(record.get("buy_sell") or "").strip().lower()
        total_amount = _to_float(record.get("total_amount"))
        profit_loss = _to_float(record.get("profit_loss"))

        if category == "ipo":
            total_ipo_investment += total_amount
        elif category == "sip" and buy_sell in {"redeem", "redeemed"}:
            total_sip_redeemed += total_amount
            sip_profit_loss += profit_loss
        elif category == "sip":
            total_sip_investment += total_amount
        elif category == "buy":
            total_buy_amount += total_amount
        elif category == "sell":
            total_sell_amount += total_amount
            total_profit += profit_loss
        elif category == "dividend" and buy_sell == "cash":
            total_dividend += total_amount
        elif category == "dividend" and buy_sell == "bonus":
            bonus_shares_received += int(_to_float(record.get("allotted")))

    overall_investment = total_ipo_investment + total_buy_amount
    closing_records = all_records if all_records is not None else records
    end_key = closing_end_date.isoformat() if isinstance(closing_end_date, date) else str(closing_end_date or date.today().isoformat())[:10]
    closing_records = [record for record in closing_records if str(record.get("date") or "")[:10] <= end_key]
    latest_positions: dict[str, dict] = {}
    all_sip_investment = 0.0
    all_sip_redeemed = 0.0
    for record in closing_records:
        share_name = str(record.get("share_name") or "").strip().casefold()
        if share_name:
            prior = latest_positions.get(share_name)
            sort_key = (str(record.get("date") or ""), int(record.get("id") or 0))
            prior_key = (str(prior.get("date") or ""), int(prior.get("id") or 0)) if prior else None
            if prior is None or sort_key >= prior_key:
                latest_positions[share_name] = record
        if str(record.get("category") or "").strip().lower() == "sip":
            action = str(record.get("buy_sell") or "").strip().lower()
            amount = _to_float(record.get("total_amount"))
            if action in {"redeem", "redeemed"}:
                all_sip_redeemed += amount
            else:
                all_sip_investment += amount

    share_holding_cost = sum(_to_float(record.get("holding_cost")) for record in latest_positions.values())
    sip_unrecovered_capital = max(all_sip_investment - all_sip_redeemed, 0.0)
    realized_trading_profit_loss = total_profit
    share_net_cash_result = realized_trading_profit_loss + total_dividend - share_holding_cost
    grand_total_investment = overall_investment + total_sip_investment
    grand_holding_cost = share_holding_cost + sip_unrecovered_capital
    grand_total_received = total_sell_amount + total_dividend + total_sip_redeemed
    grand_net_cash_result = grand_total_received - grand_total_investment
    overall_profit_loss = share_net_cash_result
    grand_profit_loss = grand_net_cash_result

    return {
        "total_ipo_investment": total_ipo_investment,
        "total_sip_investment": total_sip_investment,
        "total_sip_redeemed": total_sip_redeemed,
        "sip_profit_loss": sip_profit_loss,
        "total_buy_amount": total_buy_amount,
        "overall_investment": overall_investment,
        "total_sell_amount": total_sell_amount,
        "total_dividend": total_dividend,
        "total_profit": total_profit,
        "total_share_investment": overall_investment,
        "total_sell_proceeds": total_sell_amount,
        "cash_dividends_received": total_dividend,
        "bonus_shares_received": bonus_shares_received,
        "realized_trading_profit_loss": realized_trading_profit_loss,
        "share_holding_cost": share_holding_cost,
        "share_net_cash_result": share_net_cash_result,
        "sip_unrecovered_capital": sip_unrecovered_capital,
        "sip_net_cash_result": total_sip_redeemed - total_sip_investment,
        "grand_holding_cost": grand_holding_cost,
        "grand_total_received": grand_total_received,
        "grand_net_cash_result": grand_net_cash_result,
        "overall_profit_loss": overall_profit_loss,
        "grand_total_investment": grand_total_investment,
        "grand_profit_loss": grand_profit_loss,
    }
