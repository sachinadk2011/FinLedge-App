import threading
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from openpyxl import Workbook, load_workbook

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

    if modified:
        workbook.save(file_path)
    workbook.close()


def _ensure_transfer_workbook_exists() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    workbook = safe_load_workbook(TRANSFER_FILE_PATH, TRANSFER_SHEET_NAME, HEADERS)
    modified = False

    created_sheet = False
    if TRANSFER_SHEET_NAME not in workbook.sheetnames:
        modified = True
        sheet = workbook.active if workbook.sheetnames else workbook.create_sheet(title=TRANSFER_SHEET_NAME)
        if sheet.max_row <= 1:
            sheet.title = TRANSFER_SHEET_NAME
        else:
            sheet = workbook.create_sheet(title=TRANSFER_SHEET_NAME)
        created_sheet = True
    else:
        sheet = workbook[TRANSFER_SHEET_NAME]

    first_cell = str(sheet.cell(row=1, column=1).value or "").strip().lower()
    if first_cell != "date" and not created_sheet:
        modified = True
        sheet.insert_rows(1)

    for idx, header in enumerate(HEADERS, start=1):
        if sheet.cell(row=1, column=idx).value in (None, ""):
            modified = True
            sheet.cell(row=1, column=idx).value = header

    if modified:
        workbook.save(TRANSFER_FILE_PATH)
    workbook.close()


def _signed_amount(direction: str, amount: Decimal | float) -> float:
    value = float(amount)
    return value if direction == "income" else -value


def create_transfer_record(
    entry_date: Optional[date],
    direction: str,
    amount: Decimal | float,
    description: Optional[str] = None,
) -> dict:
    """
    Create a single transfer record in personal_finance_transfer.xlsx.

    direction must be 'bank_to_cash' or 'cash_to_bank'.
    Validates that the transfer amount does not exceed the available income
    on the originating side before writing.
    """
    direction = str(direction or "").strip().lower()
    if direction not in {"bank_to_cash", "cash_to_bank"}:
        raise ValueError("direction must be 'bank_to_cash' or 'cash_to_bank'.")

    amount_float = abs(float(amount))
    if amount_float <= 0:
        raise ValueError("Transfer amount must be greater than zero.")

    # --- Income validation (read current state BEFORE acquiring write lock) ---
    origin_flow = "bank" if direction == "bank_to_cash" else "cash"
    origin_records = read_personal_finance_records(flow_type=origin_flow)
    origin_summary = summarize_personal_finance_records(origin_records)
    available_income = origin_summary[origin_flow]["total_income"]
    if amount_float > available_income:
        side_label = "Bank" if origin_flow == "bank" else "Cash"
        raise ValueError(f"Exceeds your {side_label} income.")
    # -------------------------------------------------------------------------

    with _file_lock:
        _ensure_transfer_workbook_exists()

        entry_date = entry_date or date.today()
        timestamp = _current_timestamp()
        description_value = (description or "").strip()
        short_id = uuid.uuid4().hex[:8]
        transfer_ref = f"transfer:{entry_date.isoformat()}:{short_id}"

        workbook = load_workbook(TRANSFER_FILE_PATH)
        sheet = workbook[TRANSFER_SHEET_NAME]
        sheet.append(
            [
                entry_date.isoformat(),
                direction,       # "bank_to_cash" or "cash_to_bank"
                "transfer",      # direction column — marks this as a transfer
                "Transfer",      # category
                amount_float,
                amount_float,    # signed_amount stored as positive; sign applied at read time
                description_value,
                "transfer",      # source
                timestamp,
                timestamp,
                transfer_ref,
                "desktop",
            ]
        )
        snapshot_before_write(TRANSFER_FILE_PATH)
        workbook.save(TRANSFER_FILE_PATH)
        workbook.close()

        return {
            "date": entry_date.isoformat(),
            "direction": direction,
            "category": "Transfer",
            "amount": amount_float,
            "description": description_value or None,
            "source": "transfer",
            "transfer_ref": transfer_ref,
            "timestamp": timestamp,
            "created_timestamp": timestamp,
            "last_updated_timestamp": timestamp,
            "updated_device": "desktop",
            "file": str(TRANSFER_FILE_PATH),
        }

def read_transfer_records() -> list[dict]:
    """Read all raw transfer records from personal_finance_transfer.xlsx."""
    with _file_lock:
        _ensure_transfer_workbook_exists()
        workbook = load_workbook(TRANSFER_FILE_PATH, data_only=True)
        sheet = workbook[TRANSFER_SHEET_NAME]

        records: list[dict] = []
        for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if not row or all(value is None for value in row):
                continue
            amount = abs(_to_float(row[4] if len(row) > 4 else 0))
            records.append(
                {
                    "id": f"transfer-{row_idx - 1}",
                    "display_id": f"T-{row_idx - 1}",
                    "date": str(row[0] or ""),
                    "transfer_direction": str(row[1] or ""),   # bank_to_cash / cash_to_bank
                    "direction": "transfer",
                    "category": "Transfer",
                    "amount": amount,
                    "description": str(row[6] or "") if len(row) > 6 else "",
                    "source": "transfer",
                    "timestamp": str(row[9] or row[8] or "") if len(row) > 9 else str(row[8] or "") if len(row) > 8 else "",
                    "created_timestamp": str(row[8] or "") if len(row) > 8 else "",
                    "last_updated_timestamp": str(row[9] or row[8] or "") if len(row) > 9 else "",
                    "source_ref": str(row[10] or "") if len(row) > 10 else "",
                    "updated_device": str(row[11] or "desktop") if len(row) > 11 else "desktop",
                }
            )
        workbook.close()
        return records


def update_transfer_record(
    transfer_id: int,
    entry_date: Optional[date],
    direction: str,
    amount: Decimal | float,
    description: Optional[str] = None,
) -> dict:
    """
    Update an existing transfer record (by sequential 1-based ID).
    Re-validates that the new amount does not exceed available origin income,
    excluding the old transfer's own contribution.
    """
    direction = str(direction or "").strip().lower()
    if direction not in {"bank_to_cash", "cash_to_bank"}:
        raise ValueError("direction must be 'bank_to_cash' or 'cash_to_bank'.")

    amount_float = abs(float(amount))
    if amount_float <= 0:
        raise ValueError("Transfer amount must be greater than zero.")

    # Row in the sheet = transfer_id + 1 (row 1 is the header)
    target_row = transfer_id + 1

    with _file_lock:
        _ensure_transfer_workbook_exists()
        workbook = load_workbook(TRANSFER_FILE_PATH)
        sheet = workbook[TRANSFER_SHEET_NAME]

        max_data_row = sheet.max_row
        if target_row < 2 or target_row > max_data_row:
            workbook.close()
            raise ValueError(f"Transfer record {transfer_id} not found.")

        # Read old amount so we can exclude it from the income check
        old_amount = abs(_to_float(sheet.cell(row=target_row, column=5).value or 0))
        old_direction = str(sheet.cell(row=target_row, column=2).value or "")
        workbook.close()

    # Income check excluding old transfer (read outside lock to avoid deadlock)
    origin_flow = "bank" if direction == "bank_to_cash" else "cash"
    origin_records = read_personal_finance_records(flow_type=origin_flow)
    origin_summary = summarize_personal_finance_records(origin_records)
    available_income = origin_summary[origin_flow]["total_income"]

    # If direction unchanged, the old amount is already deducted in the summary;
    # we only need to check the *increase*, otherwise full new amount.
    same_direction = old_direction == direction
    effective_increase = (amount_float - old_amount) if same_direction else amount_float
    if effective_increase > available_income + (old_amount if same_direction else 0):
        side_label = "Bank" if origin_flow == "bank" else "Cash"
        raise ValueError(f"Exceeds your {side_label} income.")

    with _file_lock:
        workbook = load_workbook(TRANSFER_FILE_PATH)
        sheet = workbook[TRANSFER_SHEET_NAME]
        timestamp = _current_timestamp()
        entry_date_val = (entry_date or date.today()).isoformat()
        description_value = (description or "").strip()

        sheet.cell(row=target_row, column=1).value = entry_date_val
        sheet.cell(row=target_row, column=2).value = direction
        sheet.cell(row=target_row, column=5).value = amount_float
        sheet.cell(row=target_row, column=6).value = amount_float
        sheet.cell(row=target_row, column=7).value = description_value
        sheet.cell(row=target_row, column=10).value = timestamp  # last_updated_timestamp

        snapshot_before_write(TRANSFER_FILE_PATH)
        workbook.save(TRANSFER_FILE_PATH)
        workbook.close()

        return {
            "id": f"transfer-{transfer_id}",
            "date": entry_date_val,
            "direction": direction,
            "amount": amount_float,
            "description": description_value or None,
            "source": "transfer",
            "last_updated_timestamp": timestamp,
        }


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


def _build_transfer_records_for_flow(flow_type: str) -> list[dict]:
    """
    Read transfer records and return them shaped for the given flow_type perspective.

    bank_to_cash transfer:
      - bank side: signed_amount = -amount  (bank gives money away → income reduced)
      - cash side: signed_amount = +amount  (cash receives money  → income added)

    cash_to_bank transfer:
      - cash side: signed_amount = -amount  (cash gives money away → income reduced)
      - bank side: signed_amount = +amount  (bank receives money  → income added)
    """
    raw_transfers = read_transfer_records()
    shaped: list[dict] = []
    for rec in raw_transfers:
        transfer_direction = str(rec.get("transfer_direction") or "").strip().lower()
        amount = abs(_to_float(rec.get("amount")))
        if amount <= 0:
            continue

        # Determine signed_amount from this flow's perspective
        if transfer_direction == "bank_to_cash":
            signed = -amount if flow_type == "bank" else +amount
            label = "Withdrawn to Cash" if flow_type == "bank" else "Received from Bank"
        elif transfer_direction == "cash_to_bank":
            signed = -amount if flow_type == "cash" else +amount
            label = "Deposited to Bank" if flow_type == "cash" else "Received from Cash"
        else:
            continue  # unknown direction, skip

        desc = str(rec.get("description") or "").strip()
        shaped.append(
            {
                "id": rec["id"],
                "display_id": rec["display_id"],
                "date": rec["date"],
                "flow_type": flow_type,
                "direction": "transfer",
                "category": "Transfer",
                "amount": amount,
                "signed_amount": signed,
                "description": f"{label}{': ' + desc if desc else ''}",
                "source": "transfer",
                "transfer_direction": transfer_direction,
                "timestamp": rec.get("timestamp", ""),
                "created_timestamp": rec.get("created_timestamp", ""),
                "last_updated_timestamp": rec.get("last_updated_timestamp", ""),
                "source_ref": rec.get("source_ref", ""),
                "updated_device": rec.get("updated_device", "desktop"),
            }
        )
    return shaped


def _build_transfer_records_for_combined() -> list[dict]:
    """
    For the combined view: include each transfer exactly ONCE, shown from
    the originating side's perspective (negative signed_amount).
      bank_to_cash → shown under bank flow, label "Withdrawn to Cash"
      cash_to_bank → shown under cash flow, label "Deposited to Bank"
    """
    raw_transfers = read_transfer_records()
    shaped: list[dict] = []
    for rec in raw_transfers:
        transfer_direction = str(rec.get("transfer_direction") or "").strip().lower()
        amount = abs(_to_float(rec.get("amount")))
        if amount <= 0:
            continue

        if transfer_direction == "bank_to_cash":
            flow_type = "bank"
            label = "Withdrawn to Cash"
        elif transfer_direction == "cash_to_bank":
            flow_type = "cash"
            label = "Deposited to Bank"
        else:
            continue

        desc = str(rec.get("description") or "").strip()
        shaped.append(
            {
                "id": rec["id"],
                "display_id": rec["display_id"],
                "date": rec["date"],
                "flow_type": flow_type,
                "direction": "transfer",
                "category": "Transfer",
                "amount": amount,
                "signed_amount": -amount,  # originating side always loses
                "description": f"{label}{': ' + desc if desc else ''}",
                "source": "transfer",
                "transfer_direction": transfer_direction,
                "timestamp": rec.get("timestamp", ""),
                "created_timestamp": rec.get("created_timestamp", ""),
                "last_updated_timestamp": rec.get("last_updated_timestamp", ""),
                "source_ref": rec.get("source_ref", ""),
                "updated_device": rec.get("updated_device", "desktop"),
            }
        )
    return shaped


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
