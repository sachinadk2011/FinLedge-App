"""Workbook storage and display shaping for Bank/Cash transfers."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from openpyxl import load_workbook

from .excel_utils import safe_load_workbook, snapshot_before_write
from .personal_finance_summary import summarize_personal_finance_records
from .personal_finance_service import (
    DATA_DIR,
    HEADERS,
    TRANSFER_FILE_PATH,
    TRANSFER_SHEET_NAME,
    _current_timestamp,
    _file_lock,
    _to_float,
    read_personal_finance_records,
)


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
