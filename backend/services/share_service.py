import threading
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from openpyxl import Workbook, load_workbook

from .excel_utils import (
    current_timestamp as _current_timestamp,
    ensure_workbook_exists,
    iter_sheet_rows_as_dicts,
    workbook_for_update,
    to_float as _to_float,
    to_int as _to_int,
)
from .path_utils import get_data_dir
from .share_lot_calculations import apply_sip_investment, apply_weighted_average_transaction
from .share_summary import summarize_share_records
from .workbook_merge import append_tombstone, get_device_label, new_row_id, refresh_sheet_metadata

DATA_DIR = get_data_dir()
FILE_PATH = DATA_DIR / "share_transactions.xlsx"
SHEET_NAME = "Share"
HEADERS = [
    "Date",
    "Share Name",
    "Category",
    "Per Unit Price",
    "Charge",
    "Allotted",
    "Buy/Sell",
    "Total Amount",
    "Profit/Loss",
    "Cumulative Profit",
    "Created Timestamp",
    "Last Updated Timestamp",
    "Updated Device",
    "Row ID",
    "Content Hash",
]

_file_lock = threading.Lock()


def _ensure_workbook_exists() -> None:
    ensure_workbook_exists(FILE_PATH, SHEET_NAME, HEADERS, DATA_DIR)


def _sip_outstanding_investment(sheet, share_name: str, before_date: date | None = None) -> float:
    target = share_name.strip().lower()
    outstanding = 0.0
    rows = []
    for row_idx in range(2, sheet.max_row + 1):
        row_share_name = str(sheet.cell(row=row_idx, column=2).value or "").strip().lower()
        if row_share_name != target:
            continue

        category = str(sheet.cell(row=row_idx, column=3).value or "").strip().lower()
        if category != "sip":
            continue

        raw_date = str(sheet.cell(row=row_idx, column=1).value or "")[:10]
        try:
            row_date = date.fromisoformat(raw_date)
        except ValueError:
            row_date = date.max
        if before_date is not None and row_date > before_date:
            continue
        rows.append((row_date, row_idx))

    for _, row_idx in sorted(rows):

        buy_sell = str(sheet.cell(row=row_idx, column=7).value or "").strip().lower()
        total_amount = _to_float(sheet.cell(row=row_idx, column=8).value)
        profit_loss = _to_float(sheet.cell(row=row_idx, column=9).value)

        if buy_sell in {"redeem", "redeemed"}:
            outstanding = max(outstanding - total_amount, 0.0)
        else:
            outstanding += total_amount

    return outstanding


def append_share_record(
    entry_date: Optional[date],
    share_name: str,
    category: str,
    per_unit_price: Decimal,
    allotted: int,
    buy_sell: str,
    charge: Decimal | None = None,
) -> dict:
    with workbook_for_update(FILE_PATH, _file_lock, _ensure_workbook_exists) as workbook:
        entry_date = entry_date or date.today()
        timestamp = _current_timestamp()
        share_name = share_name.strip().upper()
        category = category.strip().lower()
        if category not in {"ipo", "sip", "buy", "sell", "dividend"}:
            raise ValueError("Category must be one of: ipo, sip, buy, sell, dividend.")

        if category == "dividend":
            buy_sell = buy_sell.strip().lower()
            if buy_sell not in {"cash", "bonus"}:
                raise ValueError("Dividend type must be 'cash' or 'bonus'.")
            if buy_sell == "cash" and allotted != 0:
                raise ValueError("Cash dividend must have 0 allotted shares.")
            if buy_sell == "bonus" and allotted <= 0:
                raise ValueError("Bonus dividend must have greater than 0 allotted shares.")
        else:
            if allotted < 0:
                raise ValueError("Allotted cannot be negative.")
            if category not in {"ipo", "sip"} and allotted <= 0:
                raise ValueError("Allotted must be greater than 0 for buy/sell entries.")
            if category == "sip":
                buy_sell = (buy_sell or "installment").strip().lower()
                if buy_sell == "sip":
                    buy_sell = "installment"
                if buy_sell not in {"installment", "redeem"}:
                    raise ValueError("SIP type must be 'installment' or 'redeem'.")

        if per_unit_price < 0:
            raise ValueError("Per unit price cannot be negative.")

        sheet = workbook[SHEET_NAME]

        # ASBA charge rules:
        # - ipo: 5
        # - secondary/buy/sell: 0
        if charge is not None and Decimal(str(charge)) < 0:
            raise ValueError("Charge cannot be negative.")
        asba_charge_dec = (
            Decimal("5") if category == "ipo" and charge is None
            else Decimal("0") if charge is None or category not in {"ipo", "sip"}
            else Decimal(str(charge))
        )

        # Keep currency math in Decimal to avoid float rounding surprises.
        try:
            unit_price = per_unit_price if isinstance(per_unit_price, Decimal) else Decimal(str(per_unit_price))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValueError("Per unit price must be a valid number.") from exc

        if category == "dividend":
            if buy_sell == "cash":
                total_amount_dec = unit_price
                profit_loss_dec = total_amount_dec
            else:
                total_amount_dec = Decimal("0")
                profit_loss_dec = Decimal("0")
        elif category == "sip":
            if unit_price <= 0:
                raise ValueError("SIP investment amount must be greater than 0.")
            total_amount_dec = unit_price - asba_charge_dec if buy_sell == "redeem" else unit_price + asba_charge_dec
            if total_amount_dec < 0:
                raise ValueError("Charge cannot exceed the SIP redemption amount.")
            if buy_sell == "redeem":
                outstanding = _sip_outstanding_investment(sheet, share_name, entry_date)
                if outstanding <= 0:
                    raise ValueError(f"Cannot redeem '{share_name}': no outstanding SIP investment found.")
                # Profit = Redeemed Amount (total_amount_dec) - Total Invested (outstanding)
                profit_loss_dec = total_amount_dec - Decimal(str(outstanding))
            else:
                profit_loss_dec = Decimal("0")
        else:
            share_value_dec = unit_price * Decimal(int(allotted))
            total_amount_dec = share_value_dec + asba_charge_dec
            profit_loss_dec = Decimal("0")

        sheet.append(
            [
                entry_date.isoformat(),
                share_name,
                category,
                str(unit_price),
                float(asba_charge_dec),
                int(allotted),
                buy_sell,
                str(total_amount_dec),
                str(profit_loss_dec),
                    0.0,
                timestamp,
                timestamp,
                get_device_label(),
                new_row_id(),
                None,
            ]
        )
        _recompute_sheet(sheet)
        row_number = sheet.max_row
        total_amount_dec = Decimal(str(sheet.cell(row=row_number, column=8).value or 0))
        profit_loss_dec = Decimal(str(sheet.cell(row=row_number, column=9).value or 0))
        cumulative_profit = _to_float(sheet.cell(row=row_number, column=10).value)
        refresh_sheet_metadata(sheet, "share", touched_row=sheet.max_row, identity_scope="share_transactions.xlsx#share")
        return {
            "id": sheet.max_row - 1,
            "date": entry_date.isoformat(),
            "share_name": share_name,
            "category": category,
            "per_unit_price": str(unit_price),
            "asba_charge": float(asba_charge_dec),
            "charge": float(asba_charge_dec),
            "allotted": int(allotted),
            "buy_sell": buy_sell,
            "total_amount": str(total_amount_dec),
            "profit_loss": str(profit_loss_dec),
            "cumulative_profit": cumulative_profit,
            "timestamp": timestamp,
            "created_timestamp": timestamp,
            "last_updated_timestamp": timestamp,
            "updated_device": get_device_label(),
            "row_id": str(sheet.cell(sheet.max_row, 14).value or ""),
            "content_hash": str(sheet.cell(sheet.max_row, 15).value or ""),
            "file": str(FILE_PATH),
        }


def read_share_records() -> list[dict]:
    with _file_lock:
        _ensure_workbook_exists()

        workbook = load_workbook(FILE_PATH, data_only=True)
        sheet = workbook[SHEET_NAME]

        records: list[dict] = []
        for row_idx, row in iter_sheet_rows_as_dicts(sheet):
            created = row.get("created timestamp")
            updated = row.get("last updated timestamp") or created
            records.append(
                {
                    # Stable ID that matches the Excel row index (header excluded).
                    "id": row_idx - 1,
                    "date": str(row.get("date") or ""),
                    "share_name": str(row.get("share name") or ""),
                    "category": str(row.get("category") or ""),
                    "per_unit_price": _to_float(row.get("per unit price")),
                    "asba_charge": _to_float(row.get("charge")),
                    "charge": _to_float(row.get("charge")),
                    "allotted": _to_int(row.get("allotted")),
                    "buy_sell": str(row.get("buy/sell") or ""),
                    "total_amount": _to_float(row.get("total amount")),
                    "profit_loss": _to_float(row.get("profit/loss")),
                    "cumulative_profit": _to_float(row.get("cumulative profit")),
                    "timestamp": str(updated or ""),
                    "created_timestamp": str(created or ""),
                    "last_updated_timestamp": str(updated or ""),
                    "updated_device": str(row.get("updated device") or "legacy"),
                    "row_id": str(row.get("row id") or ""),
                    "content_hash": str(row.get("content hash") or ""),
                }
            )

        workbook.close()
        return _enrich_share_positions(records)


def _enrich_share_positions(records: list[dict]) -> list[dict]:
    """Attach current historical weighted-average positions to API rows."""
    holdings_by_share: dict[str, dict[str, float]] = {}
    ordered_records = sorted(records, key=lambda record: (str(record.get("date") or "9999-12-31")[:10], int(record.get("id") or 0)))
    for record in ordered_records:
        share_key = str(record.get("share_name") or "").strip().lower()
        category = str(record.get("category") or "").strip().lower()
        buy_sell = str(record.get("buy_sell") or "").strip().lower()
        quantity = _to_int(record.get("allotted"))
        if category in {"ipo", "buy"}:
            apply_weighted_average_transaction(
                holdings_by_share,
                share_key,
                category,
                quantity,
                acquisition_cost=_to_float(record.get("total_amount")),
            )
        elif category == "dividend" and buy_sell == "bonus":
            apply_weighted_average_transaction(holdings_by_share, share_key, "dividend", quantity)
        elif category == "sell":
            apply_weighted_average_transaction(
                holdings_by_share,
                share_key,
                "sell",
                quantity,
                sale_proceeds=_to_float(record.get("total_amount")),
            )
        holding = holdings_by_share.get(share_key, {"quantity": 0.0, "cost": 0.0})
        record["holding_quantity"] = int(holding["quantity"])
        record["average_cost"] = holding["cost"] / holding["quantity"] if holding["quantity"] else 0.0
        record["holding_cost"] = holding["cost"]
    return records


def _recompute_sheet(sheet) -> None:
    cumulative_profit = 0.0
    holdings_by_share: dict[str, dict[str, float]] = {}
    sip_investment_by_share: dict[str, float] = {}

    def transaction_order(row_idx: int) -> tuple[str, int]:
        raw_date = sheet.cell(row=row_idx, column=1).value
        try:
            parsed_date = date.fromisoformat(str(raw_date)[:10])
            return parsed_date.isoformat(), row_idx
        except (TypeError, ValueError):
            # Preserve workbook order for legacy rows with unparseable dates.
            return "9999-12-31", row_idx

    ordered_rows = sorted(range(2, sheet.max_row + 1), key=transaction_order)

    for row_idx in ordered_rows:
        share_name = str(sheet.cell(row=row_idx, column=2).value or "").strip()
        category = str(sheet.cell(row=row_idx, column=3).value or "").strip().lower()
        per_unit_price = _to_float(sheet.cell(row=row_idx, column=4).value)
        allotted = _to_int(sheet.cell(row=row_idx, column=6).value)
        buy_sell = str(sheet.cell(row=row_idx, column=7).value or "")
        stored_asba_charge = sheet.cell(row=row_idx, column=5).value
        asba_charge = _to_float(stored_asba_charge) if category == "ipo" else 0.0
        if category == "ipo" and stored_asba_charge in (None, ""):
            asba_charge = 5.0
        profit_loss = 0.0
        share_key = share_name.lower()

        if category == "dividend":
            if buy_sell == "cash":
                total_amount = float(per_unit_price)
                profit_loss = total_amount
            else:
                total_amount = 0.0
        elif category == "sip":
            normalized_buy_sell = buy_sell.strip().lower()
            if normalized_buy_sell == "sip":
                normalized_buy_sell = "installment"
            stored_total = _to_float(sheet.cell(row=row_idx, column=8).value)
            if stored_total <= 0:
                stored_total = float(per_unit_price) * int(allotted) if allotted > 0 else float(per_unit_price)
            total_amount = stored_total
            if normalized_buy_sell == "redeem":
                # Profit = Redeemed Amount - Total Invested
                profit_loss = apply_sip_investment(sip_investment_by_share, share_key, total_amount, redeem=True)
                per_unit_price = total_amount
                buy_sell = "redeem"
            else:
                apply_sip_investment(sip_investment_by_share, share_key, total_amount, redeem=False)
                buy_sell = "installment"
        else:
            total_amount = (float(per_unit_price) * int(allotted)) + float(asba_charge)

        if category in {"ipo", "buy"}:
            profit_loss = apply_weighted_average_transaction(
                holdings_by_share,
                share_key,
                category,
                allotted,
                acquisition_cost=total_amount,
            )
        elif category == "dividend" and buy_sell == "bonus":
            apply_weighted_average_transaction(holdings_by_share, share_key, "dividend", allotted)
        elif category == "sell":
            profit_loss = apply_weighted_average_transaction(
                holdings_by_share,
                share_key,
                "sell",
                allotted,
                sale_proceeds=total_amount,
            )

        cumulative_profit += profit_loss

        sheet.cell(row=row_idx, column=5).value = asba_charge
        sheet.cell(row=row_idx, column=7).value = buy_sell
        sheet.cell(row=row_idx, column=8).value = total_amount
        sheet.cell(row=row_idx, column=9).value = profit_loss
        sheet.cell(row=row_idx, column=10).value = cumulative_profit


def update_share_allotment(share_name: str, allotted: int) -> dict:
    with workbook_for_update(FILE_PATH, _file_lock, _ensure_workbook_exists) as workbook:
        sheet = workbook[SHEET_NAME]

        target = share_name.strip().lower()
        target_row = None
        found_any = False

        for row_idx in range(sheet.max_row, 1, -1):
            row_share_name = str(sheet.cell(row=row_idx, column=2).value or "").strip().lower()
            category = str(sheet.cell(row=row_idx, column=3).value or "").strip().lower()
            if row_share_name == target:
                found_any = True
            if row_share_name == target and category == "ipo":
                target_row = row_idx
                break

        if not target_row:
            workbook.close()
            if found_any:
                raise ValueError("Only IPO entries can be updated from this form.")
            raise ValueError("No IPO entry found for the provided share name.")

        previous_allotted = _to_int(sheet.cell(row=target_row, column=6).value)
        updated_date = str(sheet.cell(row=target_row, column=1).value or "")
        normalized_share_name = str(sheet.cell(row=target_row, column=2).value or share_name).strip().upper()
        timestamp = _current_timestamp()

        sheet.cell(row=target_row, column=6).value = int(allotted)
        if not sheet.cell(row=target_row, column=11).value:
            sheet.cell(row=target_row, column=11).value = timestamp
        sheet.cell(row=target_row, column=12).value = timestamp
        sheet.cell(row=target_row, column=13).value = get_device_label()
        _recompute_sheet(sheet)
        refresh_sheet_metadata(sheet, "share", touched_row=target_row, identity_scope="share_transactions.xlsx#share")
        return {
            "record_id": int(target_row - 1),
            "date": updated_date,
            "share_name": normalized_share_name,
            "previous_allotted": previous_allotted,
            "allotted": int(allotted),
            "timestamp": timestamp,
            "created_timestamp": str(sheet.cell(row=target_row, column=11).value or timestamp),
            "last_updated_timestamp": timestamp,
            "updated_device": get_device_label(),
            "row_id": str(sheet.cell(target_row, 14).value or ""),
        }


def delete_share_record(record_id: int) -> dict:
    """
    Delete a record by its 1-based index in the data list (header excluded),
    then recompute ASBA/total/profit/cumulative so the Excel stays consistent.
    """
    with workbook_for_update(FILE_PATH, _file_lock, _ensure_workbook_exists) as workbook:
        if record_id <= 0:
            raise ValueError("record_id must be a positive integer.")

        sheet = workbook[SHEET_NAME]

        excel_row = record_id + 1  # +1 for header row
        if excel_row < 2 or excel_row > sheet.max_row:
            raise ValueError("record_id is out of range.")

        row_id = str(sheet.cell(excel_row, 14).value or "")
        append_tombstone(workbook, row_id)
        sheet.delete_rows(excel_row, 1)
        _recompute_sheet(sheet)
        refresh_sheet_metadata(sheet, "share", identity_scope="share_transactions.xlsx#share")
        return {"deleted_id": int(record_id)}


def update_share_record(
    record_id: int,
    entry_date: Optional[date],
    share_name: str,
    category: str,
    per_unit_price: Decimal,
    allotted: int,
    buy_sell: str,
    charge: Decimal | None = None,
) -> dict:
    """
    Update an existing record (1-based, header excluded) and recompute totals/profit/cumulative.

    Note: recomputation keeps Excel consistent after edits.
    """
    with workbook_for_update(FILE_PATH, _file_lock, _ensure_workbook_exists) as workbook:
        if record_id <= 0:
            raise ValueError("record_id must be a positive integer.")

        entry_date = entry_date or date.today()
        timestamp = _current_timestamp()
        share_name = share_name.strip().upper()
        category = category.strip().lower()
        if category not in {"ipo", "sip", "buy", "sell", "dividend"}:
            raise ValueError("Category must be one of: ipo, sip, buy, sell, dividend.")

        if category == "dividend":
            buy_sell = (buy_sell or "").strip().lower()
            if buy_sell not in {"cash", "bonus"}:
                raise ValueError("Dividend type must be 'cash' or 'bonus'.")
            if buy_sell == "cash" and allotted != 0:
                raise ValueError("Cash dividend must have 0 allotted shares.")
            if buy_sell == "bonus" and allotted <= 0:
                raise ValueError("Bonus dividend must have greater than 0 allotted shares.")
        else:
            if allotted < 0:
                raise ValueError("Allotted cannot be negative.")
            if category not in {"ipo", "sip"} and allotted <= 0:
                raise ValueError("Allotted must be greater than 0 for buy/sell entries.")
            if category == "sip":
                buy_sell = (buy_sell or "installment").strip().lower()
                if buy_sell == "sip":
                    buy_sell = "installment"
                if buy_sell not in {"installment", "redeem"}:
                    raise ValueError("SIP type must be 'installment' or 'redeem'.")
                if per_unit_price <= 0:
                    raise ValueError("SIP investment amount must be greater than 0.")

        if per_unit_price < 0:
            raise ValueError("Per unit price cannot be negative.")
        if charge is not None and Decimal(str(charge)) < 0:
            raise ValueError("Charge cannot be negative.")

        try:
            unit_price = per_unit_price if isinstance(per_unit_price, Decimal) else Decimal(str(per_unit_price))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValueError("Per unit price must be a valid number.") from exc

        sheet = workbook[SHEET_NAME]

        excel_row = record_id + 1  # +1 for header row
        if excel_row < 2 or excel_row > sheet.max_row:
            workbook.close()
            raise ValueError("record_id is out of range.")

        previous_category = str(sheet.cell(row=excel_row, column=3).value or "").strip().lower()
        previous_allotted = _to_int(sheet.cell(row=excel_row, column=6).value)
        charge_dec = (
            Decimal(str(charge)) if charge is not None
            else Decimal(str(_to_float(sheet.cell(row=excel_row, column=5).value)))
            if category == "ipo" and previous_category == "ipo"
            else Decimal("5") if category == "ipo"
            else Decimal("0")
        )

        sheet.cell(row=excel_row, column=1).value = entry_date.isoformat()
        sheet.cell(row=excel_row, column=2).value = share_name
        sheet.cell(row=excel_row, column=3).value = category
        # Store as string to avoid client-side floating drift and keep what the user entered.
        sheet.cell(row=excel_row, column=4).value = str(unit_price)
        sheet.cell(row=excel_row, column=6).value = previous_allotted if category == "sip" and previous_category == "sip" else int(allotted)
        sheet.cell(row=excel_row, column=7).value = str(buy_sell or category).strip().lower()
        sheet.cell(row=excel_row, column=5).value = float(charge_dec)
        if category == "sip":
            total_amount = unit_price - charge_dec if buy_sell == "redeem" else unit_price + charge_dec
            if total_amount < 0:
                raise ValueError("Charge cannot exceed the SIP redemption amount.")
            sheet.cell(row=excel_row, column=8).value = str(total_amount)
        if not sheet.cell(row=excel_row, column=11).value:
            sheet.cell(row=excel_row, column=11).value = timestamp
        sheet.cell(row=excel_row, column=12).value = timestamp
        sheet.cell(row=excel_row, column=13).value = get_device_label()

        _recompute_sheet(sheet)
        refresh_sheet_metadata(sheet, "share", touched_row=excel_row, identity_scope="share_transactions.xlsx#share")
        return {
            "updated_id": int(record_id),
            "date": entry_date.isoformat(),
            "share_name": share_name,
            "category": category,
            "per_unit_price": str(unit_price),
            "allotted": _to_int(sheet.cell(row=excel_row, column=6).value),
            "buy_sell": str(buy_sell or category).strip().lower(),
            "timestamp": timestamp,
            "created_timestamp": str(sheet.cell(row=excel_row, column=11).value or timestamp),
            "last_updated_timestamp": timestamp,
            "updated_device": get_device_label(),
            "row_id": str(sheet.cell(excel_row, 14).value or ""),
            "file": str(FILE_PATH),
        }
