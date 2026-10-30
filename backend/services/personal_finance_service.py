import threading
from datetime import date
from decimal import Decimal
import math
from typing import Optional

from openpyxl import load_workbook

from .excel_utils import commit_workbook_write, ensure_workbook_exists, iter_sheet_rows_as_dicts, snapshot_before_write, to_float as _to_float, current_timestamp as _current_timestamp, workbook_for_update
from .path_utils import get_data_dir
from .personal_finance_summary import (
    LINKED_MODULE_SOURCES,
    SHARE_ONLY_CATEGORIES,
    summarize_personal_finance_records,
)
from .workbook_merge import append_tombstone, ensure_row_metadata, ensure_tombstone_and_conflict_sheets, get_device_label, map_row, new_row_id, refresh_sheet_metadata

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
    "Row ID",
    "Content Hash",
]

_file_lock = threading.RLock()


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
    file_path = _flow_file_path(flow_type)
    sheet_name = _flow_sheet_name(flow_type)
    def copy_legacy_rows(workbook, sheet) -> bool:
        legacy_sheet = workbook["Personal Finance"] if "Personal Finance" in workbook.sheetnames and "Personal Finance" != sheet_name else None
        if legacy_sheet is None:
            return False
        legacy_headers = [str(legacy_sheet.cell(row=1, column=idx).value or "").strip() for idx in range(1, legacy_sheet.max_column + 1)]
        existing_rows = {
            _personal_finance_row_key([sheet.cell(row=row_idx, column=idx).value for idx in range(1, len(HEADERS) + 1)])
            for row_idx in range(2, sheet.max_row + 1)
        }
        legacy_values = [
            map_row(legacy_headers, [legacy_sheet.cell(row=row_idx, column=idx).value for idx in range(1, legacy_sheet.max_column + 1)], HEADERS)
            for row_idx in range(2, legacy_sheet.max_row + 1)
        ]
        _, legacy_values = ensure_row_metadata(HEADERS, legacy_values, "personal_finance", identity_scope=f"{file_path.name.casefold()}#{sheet_name.casefold()}")
        changed = False
        for values in legacy_values:
            if not any(value is not None for value in values):
                continue
            row_flow = str(values[1] or flow_type).strip().lower()
            if row_flow != flow_type:
                continue
            values[1] = flow_type
            row_key = _personal_finance_row_key(values)
            if row_key in existing_rows:
                continue
            sheet.append(values)
            existing_rows.add(row_key)
            changed = True
        return changed

    ensure_workbook_exists(
        file_path, sheet_name, HEADERS, DATA_DIR,
        legacy_sheet_copy=copy_legacy_rows, rename_compatible_sheet=False,
    )


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
    row_id: Optional[str] = None,
    created_timestamp: Optional[str] = None,
) -> dict:
    flow_type = _normalize_flow_type(flow_type)
    file_path = _flow_file_path(flow_type)
    sheet_name = _flow_sheet_name(flow_type)
    with workbook_for_update(file_path, _file_lock, lambda: _ensure_workbook_exists(flow_type), snapshotter=snapshot_before_write) as workbook:

        entry_date = entry_date or date.today()
        timestamp = _current_timestamp()
        created_value = created_timestamp or timestamp
        signed_amount = _signed_amount(direction, amount)
        amount_float = float(amount)
        description_value = (description or "").strip()

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
                created_value,
                timestamp,
                source_ref or "",
                get_device_label(),
                row_id or new_row_id(),
                None,
            ]
        )
        refresh_sheet_metadata(sheet, "personal_finance", touched_row=sheet.max_row, identity_scope=f"{file_path.name.casefold()}#{sheet_name.casefold()}")
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
            "created_timestamp": created_value,
            "last_updated_timestamp": timestamp,
            "source_ref": source_ref or "",
            "updated_device": get_device_label(),
            "row_id": str(sheet.cell(sheet.max_row, 13).value or ""),
            "content_hash": str(sheet.cell(sheet.max_row, 14).value or ""),
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
        for row_idx, row in iter_sheet_rows_as_dicts(sheet):
            amount = _to_float(row.get("amount"))
            signed_amount = _to_float(row.get("signed amount"))
            direction = str(row.get("direction") or "").strip().lower()
            if not signed_amount and amount:
                signed_amount = _signed_amount(direction, amount)

            source = str(row.get("source") or "manual")
            # Ignore legacy copied rows from modules that now own their own records.
            if source in LINKED_MODULE_SOURCES:
                continue

            category = str(row.get("category") or "").strip()
            if category.casefold() in SHARE_ONLY_CATEGORIES:
                continue

            records.append(
                {
                    "id": row_idx - 1,
                    "display_id": f"{flow_type[:1].upper()}-{row_idx - 1}",
                    "date": str(row.get("date") or ""),
                    "flow_type": flow_type,
                    "direction": direction,
                    "category": category,
                    "amount": amount,
                    "signed_amount": signed_amount,
                    "description": str(row.get("description") or ""),
                    "source": source,
                    "timestamp": str(row.get("last updated timestamp") or row.get("created timestamp") or ""),
                    "created_timestamp": str(row.get("created timestamp") or ""),
                    "last_updated_timestamp": str(row.get("last updated timestamp") or row.get("created timestamp") or ""),
                    "source_ref": str(row.get("source ref") or ""),
                    "updated_device": str(row.get("updated device") or "legacy"),
                    "row_id": str(row.get("row id") or ""),
                    "content_hash": str(row.get("content hash") or ""),
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
    flow_type = _normalize_flow_type(flow_type)
    file_path = _flow_file_path(flow_type)
    sheet_name = _flow_sheet_name(flow_type)
    with workbook_for_update(file_path, _file_lock, lambda: _ensure_workbook_exists(flow_type), snapshotter=snapshot_before_write) as workbook:

        if record_id <= 0:
            raise ValueError("record_id must be a positive integer.")

        sheet = workbook[sheet_name]
        excel_row = record_id + 1
        if excel_row < 2 or excel_row > sheet.max_row:
            raise ValueError("record_id is out of range.")

        source = str(sheet.cell(row=excel_row, column=8).value or "manual")
        if source != "manual":
            raise ValueError("Synced Personal Expenses records are read-only.")

        row_id = str(sheet.cell(excel_row, 13).value or "")
        append_tombstone(workbook, row_id)
        sheet.delete_rows(excel_row, 1)
        refresh_sheet_metadata(sheet, "personal_finance", identity_scope=f"{file_path.name.casefold()}#{sheet_name.casefold()}")
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
            existing_values = [sheet.cell(excel_row, column).value for column in range(1, len(HEADERS) + 1)]
            workbook.close()
            # Validate all values before the first write. Keep the original row
            # until the destination append has been saved successfully.
            direction = str(direction or "").strip().lower()
            if direction not in {"income", "expense"}:
                raise ValueError("direction must be 'income' or 'expense'.")
            category = str(category or "").strip()
            if not category:
                raise ValueError("category is required.")
            entry_date = entry_date or date.today()
            amount_float = float(amount)
            if not math.isfinite(amount_float) or amount_float <= 0:
                raise ValueError("amount must be greater than zero.")
            description_value = (description or "").strip()

            appended = append_personal_finance_record(
                entry_date=entry_date,
                flow_type=flow_type,
                direction=direction,
                category=category,
                amount=amount_float,
                description=description_value,
                source=source,
                source_ref=existing_values[10] if len(existing_values) > 10 else None,
                row_id=str(existing_values[12] or "") if len(existing_values) > 12 else None,
                created_timestamp=str(existing_values[8] or "") if len(existing_values) > 8 else None,
            )
            destination_path = _flow_file_path(flow_type)
            destination_workbook = load_workbook(destination_path, read_only=True)
            try:
                moved_id = destination_workbook[_flow_sheet_name(flow_type)].max_row - 1
            finally:
                destination_workbook.close()
            source_workbook = load_workbook(file_path)
            try:
                source_sheet = source_workbook[sheet_name]
                append_tombstone(source_workbook, str(existing_values[12] or ""))
                source_sheet.delete_rows(excel_row, 1)
                refresh_sheet_metadata(source_sheet, "personal_finance", identity_scope=f"{file_path.name.casefold()}#{sheet_name.casefold()}")
                commit_workbook_write(source_workbook, file_path, snapshotter=snapshot_before_write)
            finally:
                source_workbook.close()
            return {**appended, "updated_id": moved_id, "moved_from_flow": record_flow_type}

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
        sheet.cell(row=excel_row, column=12).value = get_device_label()

        refresh_sheet_metadata(sheet, "personal_finance", touched_row=excel_row, identity_scope=f"{file_path.name.casefold()}#{sheet_name.casefold()}")

        commit_workbook_write(workbook, file_path, snapshotter=snapshot_before_write)
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
            "updated_device": get_device_label(),
            "row_id": str(sheet.cell(excel_row, 13).value or ""),
            "content_hash": str(sheet.cell(excel_row, 14).value or ""),
            "file": str(file_path),
        }
