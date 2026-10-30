import threading
from datetime import date, datetime
from typing import Optional

from openpyxl import load_workbook

from ..models import BankCategory
from .excel_utils import ensure_workbook_exists, iter_sheet_rows_as_dicts, snapshot_before_write, to_float as _to_float, current_timestamp_us as _current_timestamp, workbook_for_update
from .path_utils import get_data_dir
from .workbook_merge import append_tombstone, get_device_label, new_row_id, refresh_sheet_metadata

DATA_DIR = get_data_dir()
FILE_PATH = DATA_DIR / "bank_transactions.xlsx"
SHEET_NAME = "Bank"
HEADERS = [
    "Date",
    "Category",
    "Amount",
    "Cumulative Amount",
    "Description",
    "Created Timestamp",
    "Last Updated Timestamp",
    "Updated Device",
    "Row ID",
    "Content Hash",
]
# Derive category list from the Pydantic enum — single source of truth.
BANK_SERVICE_CATEGORIES = [c.value for c in BankCategory]
BANK_INCOME_CATEGORIES = {BankCategory.interest_earned.value.casefold(), "income"}

_file_lock = threading.Lock()


def _is_income_category(category: str) -> bool:
    return category.strip().lower() in BANK_INCOME_CATEGORIES


def _ensure_workbook_exists() -> None:
    ensure_workbook_exists(FILE_PATH, SHEET_NAME, HEADERS, DATA_DIR)


def append_bank_record(entry_date: Optional[date], category: str, amount: float, description: Optional[str] = None) -> dict:
    with workbook_for_update(FILE_PATH, _file_lock, _ensure_workbook_exists, snapshotter=snapshot_before_write) as workbook:
        entry_date = entry_date or date.today()
        timestamp = _current_timestamp()
        sheet = workbook[SHEET_NAME]

        previous_cumulative = _to_float(sheet.cell(row=sheet.max_row, column=4).value) if sheet.max_row > 1 else 0.0
        cumulative_amount = previous_cumulative + float(amount)

        sheet.append(
            [
                entry_date.isoformat(),
                category,
                float(amount),
                cumulative_amount,
                (description or "").strip(),
                timestamp,
                timestamp,
                get_device_label(),
                new_row_id(),
                None,
            ]
        )
        refresh_sheet_metadata(sheet, "bank", touched_row=sheet.max_row, identity_scope="bank_transactions.xlsx#bank")
        return {
            "date": entry_date.isoformat(),
            "category": category,
            "amount": float(amount),
            "cumulative_amount": cumulative_amount,
            "description": (description or "").strip() or None,
            "created_timestamp": timestamp,
            "last_updated_timestamp": timestamp,
            "updated_device": get_device_label(),
            "row_id": str(sheet.cell(sheet.max_row, 9).value or ""),
            "content_hash": str(sheet.cell(sheet.max_row, 10).value or ""),
            "file": str(FILE_PATH),
        }


def read_bank_records() -> list[dict]:
    with _file_lock:
        _ensure_workbook_exists()

        workbook = load_workbook(FILE_PATH, data_only=True)
        sheet = workbook[SHEET_NAME]

        records: list[dict] = []
        for row_idx, row in iter_sheet_rows_as_dicts(sheet):
            created = row.get("created timestamp")
            records.append(
                {
                    # Stable ID that matches the Excel row index (header excluded).
                    "id": row_idx - 1,
                    "date": str(row.get("date") or ""),
                    "category": str(row.get("category") or ""),
                    "amount": _to_float(row.get("amount")),
                    "cumulative_amount": _to_float(row.get("cumulative amount")),
                    "description": str(row.get("description") or ""),
                    "created_timestamp": str(created or ""),
                    "last_updated_timestamp": str(row.get("last updated timestamp") or created or ""),
                    "updated_device": str(row.get("updated device") or "legacy"),
                    "row_id": str(row.get("row id") or ""),
                    "content_hash": str(row.get("content hash") or ""),
                }
            )

        workbook.close()
        return records


def summarize_bank_records(records: list[dict]) -> dict:
    total_income = 0.0
    total_expenses = 0.0
    category_totals = {category: 0.0 for category in BANK_SERVICE_CATEGORIES}

    for record in records:
        category = str(record.get("category") or "").strip()
        amount = _to_float(record.get("amount"))
        if _is_income_category(category):
            total_income += amount
            if category in category_totals:
                category_totals[category] += amount
            elif category:
                category_totals[category] = category_totals.get(category, 0.0) + amount
        else:
            total_expenses += abs(amount)
            if category:
                category_totals[category] = category_totals.get(category, 0.0) + abs(amount)

    net_balance = total_income - total_expenses

    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_balance": net_balance,
        "category_totals": category_totals,
    }


def _recompute_bank_sheet(sheet) -> None:
    cumulative = 0.0
    for row_idx in range(2, sheet.max_row + 1):
        amount = _to_float(sheet.cell(row=row_idx, column=3).value)
        cumulative += amount
        sheet.cell(row=row_idx, column=4).value = cumulative


def delete_bank_record(record_id: int) -> dict:
    """
    Delete a record by its 1-based index in the data list (header excluded),
    then recompute cumulative amounts so the Excel stays consistent.
    """
    with workbook_for_update(FILE_PATH, _file_lock, _ensure_workbook_exists, snapshotter=snapshot_before_write) as workbook:
        if record_id <= 0:
            raise ValueError("record_id must be a positive integer.")

        sheet = workbook[SHEET_NAME]

        excel_row = record_id + 1  # +1 for header row
        if excel_row < 2 or excel_row > sheet.max_row:
            raise ValueError("record_id is out of range.")

        row_id = str(sheet.cell(excel_row, 9).value or "")
        append_tombstone(workbook, row_id)
        sheet.delete_rows(excel_row, 1)
        _recompute_bank_sheet(sheet)
        refresh_sheet_metadata(sheet, "bank", identity_scope="bank_transactions.xlsx#bank")
        return {"deleted_id": int(record_id)}


def update_bank_record(
    record_id: int,
    entry_date: Optional[date],
    category: str,
    amount: float,
    description: Optional[str] = None,
) -> dict:
    """
    Update an existing record (1-based, header excluded) and recompute cumulative amounts.
    """
    with workbook_for_update(FILE_PATH, _file_lock, _ensure_workbook_exists, snapshotter=snapshot_before_write) as workbook:
        if record_id <= 0:
            raise ValueError("record_id must be a positive integer.")

        entry_date = entry_date or date.today()
        timestamp = _current_timestamp()

        sheet = workbook[SHEET_NAME]

        excel_row = record_id + 1  # +1 for header row
        if excel_row < 2 or excel_row > sheet.max_row:
            raise ValueError("record_id is out of range.")

        sheet.cell(row=excel_row, column=1).value = entry_date.isoformat()
        sheet.cell(row=excel_row, column=2).value = category
        sheet.cell(row=excel_row, column=3).value = float(amount)
        sheet.cell(row=excel_row, column=5).value = (description or "").strip()
        # Created Timestamp remains immutable; only Last Updated Timestamp changes.
        if not sheet.cell(row=excel_row, column=6).value:
            sheet.cell(row=excel_row, column=6).value = timestamp
        sheet.cell(row=excel_row, column=7).value = timestamp
        sheet.cell(row=excel_row, column=8).value = get_device_label()

        _recompute_bank_sheet(sheet)
        refresh_sheet_metadata(sheet, "bank", touched_row=excel_row, identity_scope="bank_transactions.xlsx#bank")
        return {
            "updated_id": int(record_id),
            "date": entry_date.isoformat(),
            "category": category,
            "amount": float(amount),
            "description": (description or "").strip() or None,
            "created_timestamp": str(sheet.cell(row=excel_row, column=6).value or timestamp),
            "last_updated_timestamp": timestamp,
            "updated_device": get_device_label(),
            "row_id": str(sheet.cell(excel_row, 9).value or ""),
            "content_hash": str(sheet.cell(excel_row, 10).value or ""),
            "file": str(FILE_PATH),
        }

