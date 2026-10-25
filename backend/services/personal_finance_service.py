import threading
from datetime import date
from decimal import Decimal
from typing import Optional

from openpyxl import load_workbook

from .excel_utils import safe_load_workbook, snapshot_before_write, to_float as _to_float, current_timestamp as _current_timestamp
from .path_utils import get_data_dir
from .personal_finance_summary import (
    LINKED_MODULE_SOURCES,
    SHARE_ONLY_CATEGORIES,
    summarize_personal_finance_records,
)

DATA_DIR = get_data_dir()
BANK_FLOW_FILE_PATH = DATA_DIR / "personal_finance_bank_flow.xlsx"
CASH_FLOW_FILE_PATH = DATA_DIR / "personal_finance_cash_flow.xlsx"
TRANSFER_FILE_PATH = DATA_DIR / "personal_finance_transfer.xlsx"
FILE_PATH = BANK_FLOW_FILE_PATH
SHEET_NAME = "Personal Finance"
TRANSFER_SHEET_NAME = "Transfer Flow"
HEADERS = [
    "Date",
    "Flow Type",
    "Direction",
    "Category",
    "Amount",
    "Signed Amount",
    "Description",
    "Source",
    "Created Timestamp",
    "Last Updated Timestamp",
    "Source Ref",
    "Updated Device",
]

_file_lock = threading.Lock()


def _normalize_flow_type(flow_type: str) -> str:
    normalized = str(flow_type or "").strip().lower()
    if normalized not in {"bank", "cash"}:
        raise ValueError("flow_type must be 'bank' or 'cash'.")
    return normalized


def _flow_file_path(flow_type: str):
    return BANK_FLOW_FILE_PATH if _normalize_flow_type(flow_type) == "bank" else CASH_FLOW_FILE_PATH


def _flow_sheet_name(flow_type: str) -> str:
    return "Bank Flow" if _normalize_flow_type(flow_type) == "bank" else "Cash Flow"


def _ensure_workbook_exists(flow_type: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    file_path = _flow_file_path(flow_type)
    sheet_name = _flow_sheet_name(flow_type)

    workbook = safe_load_workbook(file_path, sheet_name, HEADERS)
    modified = False

    created_sheet = False
    if sheet_name not in workbook.sheetnames:
        modified = True
        sheet = workbook.active if workbook.sheetnames else workbook.create_sheet(title=sheet_name)
        if sheet.max_row <= 1:
            sheet.title = sheet_name
        else:
            sheet = workbook.create_sheet(title=sheet_name)
        created_sheet = True
    else:
        sheet = workbook[sheet_name]

    first_cell = str(sheet.cell(row=1, column=1).value or "").strip().lower()
    if first_cell != "date" and not created_sheet:
        modified = True
        sheet.insert_rows(1)

    for idx, header in enumerate(HEADERS, start=1):
        if sheet.cell(row=1, column=idx).value in (None, ""):
            modified = True
            sheet.cell(row=1, column=idx).value = header

    # Earlier Settings imports wrote these flow files to a generic "Personal
    # Finance" sheet, while dashboard reads use "Bank Flow" / "Cash Flow".
    # Preserve and copy those rows into the active sheet so existing imports
    # become visible without removing the original sheet.
    legacy_sheet = workbook["Personal Finance"] if "Personal Finance" in workbook.sheetnames and "Personal Finance" != sheet_name else None
    if legacy_sheet is not None:
        legacy_headers = [str(legacy_sheet.cell(row=1, column=idx).value or "").strip().casefold() for idx in range(1, len(HEADERS) + 1)]
        expected_headers = [header.casefold() for header in HEADERS]
        if legacy_headers == expected_headers:
            expected_flow = flow_type
            existing_rows = {
                _personal_finance_row_key([sheet.cell(row=row_idx, column=idx).value for idx in range(1, len(HEADERS) + 1)])
                for row_idx in range(2, sheet.max_row + 1)
            }
            for row_idx in range(2, legacy_sheet.max_row + 1):
                values = [legacy_sheet.cell(row=row_idx, column=idx).value for idx in range(1, len(HEADERS) + 1)]
                if not any(value is not None for value in values):
                    continue
                row_flow = str(values[1] or expected_flow).strip().lower()
                if row_flow != expected_flow:
                    continue
                values[1] = expected_flow
                row_key = _personal_finance_row_key(values)
                if row_key in existing_rows:
                    continue
                sheet.append(values)
                existing_rows.add(row_key)
                modified = True

    try:
        if modified:
            snapshot_before_write(file_path)
            workbook.save(file_path)
    finally:
        workbook.close()


def _personal_finance_row_key(values: list) -> tuple[str, ...]:
    """Stable comparison key for de-duplicating legacy sheet migration rows."""
    return tuple(value.isoformat() if hasattr(value, "isoformat") else str(value or "") for value in values)


def _ensure_transfer_workbook_exists() -> None:
    from .personal_finance_transfers import _ensure_transfer_workbook_exists as ensure_transfer_workbook

    ensure_transfer_workbook()


def _signed_amount(direction: str, amount: Decimal | float) -> float:
    value = float(amount)
    return value if direction == "income" else -value


def create_transfer_record(
    entry_date: Optional[date],
    direction: str,
    amount: Decimal | float,
    description: Optional[str] = None,
) -> dict:
    from .personal_finance_transfers import create_transfer_record as create_transfer

    return create_transfer(entry_date, direction, amount, description)


def read_transfer_records() -> list[dict]:
    from .personal_finance_transfers import read_transfer_records as read_transfers

    return read_transfers()


def update_transfer_record(
    transfer_id: int,
    entry_date: Optional[date],
    direction: str,
    amount: Decimal | float,
    description: Optional[str] = None,
) -> dict:
    from .personal_finance_transfers import update_transfer_record as update_transfer

    return update_transfer(transfer_id, entry_date, direction, amount, description)


def _build_transfer_records_for_flow(flow_type: str) -> list[dict]:
    from .personal_finance_transfers import _build_transfer_records_for_flow as build_records

    return build_records(flow_type)


def _build_transfer_records_for_combined() -> list[dict]:
    from .personal_finance_transfers import _build_transfer_records_for_combined as build_records

    return build_records()


def append_personal_finance_record(
    entry_date: Optional[date],
    flow_type: str,
    direction: str,
    category: str,
    amount: Decimal | float,
    description: Optional[str] = None,
    source: str = "manual",
    source_ref: Optional[str] = None,
) -> dict:
    with _file_lock:
        flow_type = _normalize_flow_type(flow_type)
        _ensure_workbook_exists(flow_type)

        entry_date = entry_date or date.today()
        timestamp = _current_timestamp()
        signed_amount = _signed_amount(direction, amount)
        amount_float = float(amount)
        description_value = (description or "").strip()

        file_path = _flow_file_path(flow_type)
        sheet_name = _flow_sheet_name(flow_type)
        workbook = load_workbook(file_path)
        sheet = workbook[sheet_name]
        sheet.append(
            [
                entry_date.isoformat(),
                flow_type,
                direction,
                category,
                amount_float,
                signed_amount,
                description_value,
                source,
                timestamp,
                timestamp,
                source_ref or "",
                "desktop",
            ]
        )
        snapshot_before_write(file_path)
        workbook.save(file_path)
        workbook.close()

        return {
            "date": entry_date.isoformat(),
            "flow_type": flow_type,
            "direction": direction,
            "category": category,
            "amount": amount_float,
            "signed_amount": signed_amount,
            "description": description_value or None,
            "source": source,
            "timestamp": timestamp,
            "created_timestamp": timestamp,
            "last_updated_timestamp": timestamp,
            "source_ref": source_ref or "",
            "updated_device": "desktop",
            "file": str(file_path),
        }


def _read_personal_finance_records_for_flow(flow_type: str) -> list[dict]:
    with _file_lock:
        flow_type = _normalize_flow_type(flow_type)
        _ensure_workbook_exists(flow_type)

        file_path = _flow_file_path(flow_type)
        sheet_name = _flow_sheet_name(flow_type)
        workbook = load_workbook(file_path, data_only=True)
        sheet = workbook[sheet_name]

        records: list[dict] = []
        for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if not row or all(value is None for value in row):
                continue

            amount = _to_float(row[4] if len(row) > 4 else 0)
            signed_amount = _to_float(row[5] if len(row) > 5 else 0)
            direction = str(row[2] or "").strip().lower()
            if not signed_amount and amount:
                signed_amount = _signed_amount(direction, amount)

            source = str(row[7] or "manual") if len(row) > 7 else "manual"
            # Ignore legacy copied rows from modules that now own their own records.
            if source in LINKED_MODULE_SOURCES:
                continue

            category = str(row[3] or "").strip()
            if category.casefold() in SHARE_ONLY_CATEGORIES:
                continue

            records.append(
                {
                    "id": row_idx - 1,
                    "display_id": f"{flow_type[:1].upper()}-{row_idx - 1}",
                    "date": str(row[0] or ""),
                    "flow_type": flow_type,
                    "direction": direction,
                    "category": category,
                    "amount": amount,
                    "signed_amount": signed_amount,
                    "description": str(row[6] or "") if len(row) > 6 else "",
                    "source": source,
                    "timestamp": str(row[9] or row[8] or "") if len(row) > 9 else str(row[8] or "") if len(row) > 8 else "",
                    "created_timestamp": str(row[8] or "") if len(row) > 8 else "",
                    "last_updated_timestamp": str(row[9] or row[8] or "") if len(row) > 9 else str(row[8] or "") if len(row) > 8 else "",
                    "source_ref": str(row[10] or "") if len(row) > 10 else str(row[9] or "") if len(row) > 9 else "",
                    "updated_device": str(row[11] or "legacy") if len(row) > 11 else "legacy",
                }
            )

        workbook.close()
        return records


def read_personal_finance_records(flow_type: Optional[str] = None) -> list[dict]:
    normalized_flow = str(flow_type or "combined").strip().lower()

    # Base records without transfers
    bank_base = _read_personal_finance_records_for_flow("bank")
    cash_base = _read_personal_finance_records_for_flow("cash")

    if normalized_flow == "bank":
        records = bank_base + _build_transfer_records_for_flow("bank")
    elif normalized_flow == "cash":
        records = cash_base + _build_transfer_records_for_flow("cash")
    else:
        # Combined: each transfer appears once (originating side only)
        records = bank_base + cash_base + _build_transfer_records_for_combined()

    return sorted(
        records,
        key=lambda record: (
            str(record.get("timestamp") or ""),
            str(record.get("date") or ""),
            str(record.get("display_id") or ""),
        ),
    )



def delete_personal_finance_record(record_id: int, flow_type: str) -> dict:
    with _file_lock:
        flow_type = _normalize_flow_type(flow_type)
        _ensure_workbook_exists(flow_type)

        if record_id <= 0:
            raise ValueError("record_id must be a positive integer.")

        file_path = _flow_file_path(flow_type)
        sheet_name = _flow_sheet_name(flow_type)
        workbook = load_workbook(file_path)
        sheet = workbook[sheet_name]
        excel_row = record_id + 1
        if excel_row < 2 or excel_row > sheet.max_row:
            raise ValueError("record_id is out of range.")

        source = str(sheet.cell(row=excel_row, column=8).value or "manual")
        if source != "manual":
            raise ValueError("Synced Personal Expenses records are read-only.")

        sheet.delete_rows(excel_row, 1)
        snapshot_before_write(file_path)
        workbook.save(file_path)
        workbook.close()
        return {"deleted_id": int(record_id), "flow_type": flow_type}


def update_personal_finance_record(
    record_id: int,
    record_flow_type: str,
    entry_date: Optional[date],
    flow_type: str,
    direction: str,
    category: str,
    amount: Decimal | float,
    description: Optional[str] = None,
    source: str = "manual",
) -> dict:
    with _file_lock:
        record_flow_type = _normalize_flow_type(record_flow_type)
        flow_type = _normalize_flow_type(flow_type)
        _ensure_workbook_exists(record_flow_type)

        if record_id <= 0:
            raise ValueError("record_id must be a positive integer.")

        file_path = _flow_file_path(record_flow_type)
        sheet_name = _flow_sheet_name(record_flow_type)
        workbook = load_workbook(file_path)
        sheet = workbook[sheet_name]
        excel_row = record_id + 1
        if excel_row < 2 or excel_row > sheet.max_row:
            raise ValueError("record_id is out of range.")

        existing_source = str(sheet.cell(row=excel_row, column=8).value or "manual")
        if existing_source != "manual":
            raise ValueError("Synced Personal Expenses records are read-only.")

        if record_flow_type != flow_type:
            sheet.delete_rows(excel_row, 1)
            snapshot_before_write(file_path)
            workbook.save(file_path)
            workbook.close()
            return append_personal_finance_record(
                entry_date=entry_date,
                flow_type=flow_type,
                direction=direction,
                category=category,
                amount=amount,
                description=description,
                source=source,
            )

        entry_date = entry_date or date.today()
        timestamp = _current_timestamp()
        signed_amount = _signed_amount(direction, amount)
        amount_float = float(amount)
        description_value = (description or "").strip()

        sheet.cell(row=excel_row, column=1).value = entry_date.isoformat()
        sheet.cell(row=excel_row, column=2).value = flow_type
        sheet.cell(row=excel_row, column=3).value = direction
        sheet.cell(row=excel_row, column=4).value = category
        sheet.cell(row=excel_row, column=5).value = amount_float
        sheet.cell(row=excel_row, column=6).value = signed_amount
        sheet.cell(row=excel_row, column=7).value = description_value
        sheet.cell(row=excel_row, column=8).value = source
        if not sheet.cell(row=excel_row, column=9).value:
            sheet.cell(row=excel_row, column=9).value = timestamp
        sheet.cell(row=excel_row, column=10).value = timestamp
        sheet.cell(row=excel_row, column=11).value = ""
        sheet.cell(row=excel_row, column=12).value = "desktop"

        snapshot_before_write(file_path)
        workbook.save(file_path)
        workbook.close()
        return {
            "updated_id": int(record_id),
            "date": entry_date.isoformat(),
            "flow_type": flow_type,
            "direction": direction,
            "category": category,
            "amount": amount_float,
            "signed_amount": signed_amount,
            "description": description_value or None,
            "source": source,
            "timestamp": timestamp,
            "created_timestamp": str(sheet.cell(row=excel_row, column=9).value or timestamp),
            "last_updated_timestamp": timestamp,
            "source_ref": "",
            "updated_device": "desktop",
            "file": str(file_path),
        }
