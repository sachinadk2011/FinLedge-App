"""Pure aggregate calculations for Share Portfolio records."""

from .excel_utils import to_float as _to_float


def summarize_share_records(records: list[dict]) -> dict:
    total_ipo_investment = 0.0
    total_sip_investment = 0.0
    total_sip_redeemed = 0.0
    sip_profit_loss = 0.0
    total_buy_amount = 0.0
    total_sell_amount = 0.0
    total_profit = 0.0
    total_dividend = 0.0

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

    overall_investment = total_ipo_investment + total_buy_amount
    overall_profit_loss = total_profit + total_dividend - overall_investment
    grand_total_investment = overall_investment + total_sip_investment
    grand_profit_loss = overall_profit_loss + sip_profit_loss

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
        "overall_profit_loss": overall_profit_loss,
        "grand_total_investment": grand_total_investment,
        "grand_profit_loss": grand_profit_loss,
    }
