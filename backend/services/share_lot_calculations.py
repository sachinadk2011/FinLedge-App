"""FIFO share-lot calculations, separated from workbook persistence."""

from .excel_utils import to_float as _to_float, to_int as _to_int


def add_share_lot(lots_by_share: dict[str, list[dict]], share_key: str, quantity: int, price: float, asba: float = 0.0) -> None:
    if share_key and quantity > 0:
        lots_by_share.setdefault(share_key, []).append({"qty": quantity, "price": price, "asba": asba})


def consume_share_lots(lots_by_share: dict[str, list[dict]], share_key: str, sell_qty: int) -> float:
    return _consume_lots(lots_by_share.get(share_key, []), sell_qty)


def apply_sip_investment(investment_by_share: dict[str, float], share_key: str, amount: float, redeem: bool) -> float:
    """Update the running SIP principal and return redemption profit/loss."""
    if redeem:
        outstanding = investment_by_share.get(share_key, 0.0)
        investment_by_share[share_key] = 0.0
        return amount - outstanding
    investment_by_share[share_key] = investment_by_share.get(share_key, 0.0) + amount
    return 0.0


def _build_open_lots(sheet, share_name: str) -> list[dict]:
    lots: list[dict] = []
    target = share_name.strip().lower()

    for row in sheet.iter_rows(min_row=2, values_only=True):
        row_share_name = str(row[1] or "").strip().lower()
        if row_share_name != target:
            continue

        category = str(row[2] or "").strip().lower()
        qty = _to_int(row[5])
        price = _to_float(row[3])
        asba_charge = _to_float(row[4])
        buy_sell = str(row[6] or "").strip().lower()

        if qty <= 0:
            continue

        if category in {"ipo", "buy"} or (category == "dividend" and buy_sell == "bonus"):
            add_share_lot({target: lots}, target, qty, price, asba_charge if category == "ipo" else 0.0)
            continue

        if category == "sell":
            consume_share_lots({target: lots}, target, qty)
            lots = [lot for lot in lots if lot["qty"] > 0]

    return lots


def _cost_basis_for_sell(lots: list[dict], sell_qty: int) -> float:
    remaining = sell_qty
    cost_basis = 0.0

    for lot in lots:
        if remaining <= 0:
            break
        qty_available = lot["qty"]
        consumed = min(qty_available, remaining)
        cost_basis += consumed * lot["price"]
        asba_remaining = float(lot.get("asba", 0.0) or 0.0)
        if qty_available > 0 and asba_remaining != 0.0:
            cost_basis += asba_remaining * (consumed / qty_available)
        remaining -= consumed

    if remaining > 0:
        raise ValueError("Not enough available quantity to sell for this share.")

    return cost_basis


def _consume_lots(lots: list[dict], sell_qty: int) -> float:
    remaining = sell_qty
    cost_basis = 0.0

    for lot in lots:
        if remaining <= 0:
            break
        qty_before = lot["qty"]
        consumed = min(qty_before, remaining)
        cost_basis += consumed * lot["price"]
        asba_remaining = float(lot.get("asba", 0.0) or 0.0)
        if qty_before > 0 and asba_remaining != 0.0:
            consumed_asba = asba_remaining * (consumed / qty_before)
            cost_basis += consumed_asba
            lot["asba"] = asba_remaining - consumed_asba
        lot["qty"] = qty_before - consumed
        remaining -= consumed

    if remaining > 0:
        raise ValueError("Not enough available quantity to sell for this share.")

    return cost_basis
