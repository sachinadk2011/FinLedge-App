"""FIFO share-lot calculations, separated from workbook persistence."""

from .excel_utils import to_float as _to_float, to_int as _to_int


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
            lots.append({"qty": qty, "price": price, "asba": asba_charge if category == "ipo" else 0.0})
            continue

        if category == "sell":
            remaining = qty
            for lot in lots:
                if remaining <= 0:
                    break
                qty_before = lot["qty"]
                consumed = min(qty_before, remaining)
                if qty_before > 0 and lot.get("asba", 0.0) != 0.0:
                    lot["asba"] -= lot["asba"] * (consumed / qty_before)
                lot["qty"] = qty_before - consumed
                remaining -= consumed
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
