from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from openpyxl import Workbook, load_workbook

from .path_utils import get_data_dir

DATA_DIR = get_data_dir()
BANK_FLOW_FILE_PATH = DATA_DIR / "personal_finance_bank_flow.xlsx"
CASH_FLOW_FILE_PATH = DATA_DIR / "personal_finance_cash_flow.xlsx"
FILE_PATH = BANK_FLOW_FILE_PATH
SHEET_NAME = "Personal Finance"
HEADERS = ["Date", "Flow Type", "Direction", "Category", "Amount", "Signed Amount", "Description", "Source", "Timestamp"]


def _to_float(value: object) -> float:
    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _current_timestamp() -> str:
    return datetime.now().isoformat(timespec="seconds")


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

    if not file_path.exists():
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = sheet_name
        sheet.append(HEADERS)
        workbook.save(file_path)
        return

    workbook = load_workbook(file_path)

    created_sheet = False
    if sheet_name not in workbook.sheetnames:
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
        sheet.insert_rows(1)

    for idx, header in enumerate(HEADERS, start=1):
        if sheet.cell(row=1, column=idx).value in (None, ""):
            sheet.cell(row=1, column=idx).value = header

    workbook.save(file_path)


def _signed_amount(direction: str, amount: Decimal | float) -> float:
    value = float(amount)
    return value if direction == "income" else -value


def append_personal_finance_record(
    entry_date: Optional[date],
    flow_type: str,
    direction: str,
    category: str,
    amount: Decimal | float,
    description: Optional[str] = None,
    source: str = "manual",
) -> dict:
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
        ]
    )
    workbook.save(file_path)

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
        "file": str(file_path),
    }


def _read_personal_finance_records_for_flow(flow_type: str) -> list[dict]:
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

        records.append(
            {
                "id": row_idx - 1,
                "display_id": f"{flow_type[:1].upper()}-{row_idx - 1}",
                "date": str(row[0] or ""),
                "flow_type": flow_type,
                "direction": direction,
                "category": str(row[3] or ""),
                "amount": amount,
                "signed_amount": signed_amount,
                "description": str(row[6] or "") if len(row) > 6 else "",
                "source": str(row[7] or "manual") if len(row) > 7 else "manual",
                "timestamp": str(row[8] or "") if len(row) > 8 else "",
            }
        )

    return records


def read_personal_finance_records(flow_type: Optional[str] = None) -> list[dict]:
    if flow_type and str(flow_type).strip().lower() != "combined":
        return _read_personal_finance_records_for_flow(flow_type)

    records = _read_personal_finance_records_for_flow("bank") + _read_personal_finance_records_for_flow("cash")
    return sorted(
        records,
        key=lambda record: (
            str(record.get("timestamp") or ""),
            str(record.get("date") or ""),
            str(record.get("display_id") or ""),
        ),
    )


def _empty_flow_summary() -> dict:
    return {
        "total_income": 0.0,
        "total_expenses": 0.0,
        "net": 0.0,
        "income_breakdown": {},
        "expense_breakdown": {},
    }


def summarize_personal_finance_records(records: list[dict]) -> dict:
    flow_summaries = {
        "bank": _empty_flow_summary(),
        "cash": _empty_flow_summary(),
    }

    for record in records:
        flow_type = str(record.get("flow_type") or "").strip().lower()
        if flow_type not in flow_summaries:
            continue

        direction = str(record.get("direction") or "").strip().lower()
        category = str(record.get("category") or "").strip() or "Uncategorized"
        amount = abs(_to_float(record.get("amount")))
        summary = flow_summaries[flow_type]

        if direction == "income":
            summary["total_income"] += amount
            summary["income_breakdown"][category] = summary["income_breakdown"].get(category, 0.0) + amount
        else:
            summary["total_expenses"] += amount
            summary["expense_breakdown"][category] = summary["expense_breakdown"].get(category, 0.0) + amount

    for summary in flow_summaries.values():
        summary["net"] = summary["total_income"] - summary["total_expenses"]

    combined = {
        "overall_income": flow_summaries["bank"]["total_income"] + flow_summaries["cash"]["total_income"],
        "overall_expenses": flow_summaries["bank"]["total_expenses"] + flow_summaries["cash"]["total_expenses"],
        "bank": flow_summaries["bank"],
        "cash": flow_summaries["cash"],
    }
    combined["overall_net"] = combined["overall_income"] - combined["overall_expenses"]

    return {
        "bank": flow_summaries["bank"],
        "cash": flow_summaries["cash"],
        "combined": combined,
    }


def delete_personal_finance_record(record_id: int, flow_type: str) -> dict:
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
    if source == "share-sync":
        raise ValueError("Share-synced Personal Finance records are read-only.")

    sheet.delete_rows(excel_row, 1)
    workbook.save(file_path)
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
    if existing_source == "share-sync":
        raise ValueError("Share-synced Personal Finance records are read-only.")

    if record_flow_type != flow_type:
        sheet.delete_rows(excel_row, 1)
        workbook.save(file_path)
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
    sheet.cell(row=excel_row, column=9).value = timestamp

    workbook.save(file_path)
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
        "file": str(file_path),
    }
