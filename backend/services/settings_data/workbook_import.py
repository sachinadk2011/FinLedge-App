"""Excel workbook validation, row mapping, import, and live-data checks."""

import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from openpyxl import Workbook, load_workbook

from ..excel_utils import get_backup_directory, readable_backup_timestamp
from .config import DATA_DIR, get_data_type_config
from .normalization import (
    _BANK_INCOME_CATEGORIES, _COLUMN_ALIASES, _migrate_bank_category,
    _migrate_pf_category, _migrate_pf_direction, _migrate_share_category,
)

def _to_float(value: object) -> float:
    try:
        return float(str(value).replace(",", "").strip()) if value not in (None, "") else 0.0
    except (TypeError, ValueError):
        return 0.0

def _apply_aliases(headers: list[str]) -> list[str]:
    """Normalise column headers: apply aliases so old names map to current canonical names."""
    result = []
    for h in headers:
        lower = h.strip().lower()
        result.append(_COLUMN_ALIASES.get(lower, h.strip()))
    return result

def _read_workbook_rows(
    source_path: Path,
    sheet_name: str,
) -> tuple[list[str], list[list[Any]]]:
    """Return (header_row, data_rows) from the workbook. Active sheet used if sheet_name not found."""
    wb = load_workbook(source_path, read_only=True, data_only=True)
    try:
        ws = wb[sheet_name] if sheet_name in wb.sheetnames else wb.active
        rows = list(ws.iter_rows(values_only=True))
    finally:
        wb.close()

    if not rows:
        return [], []

    raw_headers = [str(c).strip() if c is not None else "" for c in rows[0]]
    headers = _apply_aliases(raw_headers)
    data = [list(r) for r in rows[1:] if any(v is not None for v in r)]
    return headers, data

def _validate_required_headers(actual_headers: list[str], required_headers: list[str]) -> list[str]:
    """Return list of missing required headers (empty = OK). Case-insensitive."""
    actual_lower = {h.lower() for h in actual_headers}
    return [
        header for header in required_headers
        if _apply_aliases([header])[0].lower() not in actual_lower
    ]

def _remap_bank_rows(
    rows: list[list[Any]],
    actual_headers: list[str],
    full_headers: list[str],
    import_ts: str,
    initial_cumulative: float = 0.0,
) -> list[list[Any]]:
    """
    Map bank import rows into the canonical Bank HEADERS order.
    - Category is migrated from old v1.1.0 names to the current v1.2.0 category set.
    - Amount sign is corrected if the category migration requires it (income = +, charge = -).
    - Cumulative Amount is recalculated as a fresh running sum.
    - Description defaults to "".
    - Audit timestamps record the actual import time.
    """
    idx = {h.lower(): i for i, h in enumerate(actual_headers)}
    running_cumulative = initial_cumulative
    result = []

    for row in rows:
        def get(col: str, default: Any = None) -> Any:
            i = idx.get(col.lower())
            return row[i] if i is not None else default

        date_val = get("Date", "")
        raw_category = str(get("Category", "") or "").strip()
        amount = _to_float(get("Amount", 0))
        description = str(get("Description", "") or "").strip()

        # Migrate category and fix amount sign if needed
        category, sign = _migrate_bank_category(raw_category, description)
        if sign == 1:
            amount = abs(amount)   # income must be positive
        elif sign == -1:
            amount = -abs(amount)  # charge must be negative
        # sign == 0 means already a valid category — keep amount as-is

        # Recalculate running cumulative from the (now-signed) amount
        running_cumulative = round(running_cumulative + amount, 10)

        created_ts = get("Created Timestamp") or get("Last Updated Timestamp") or import_ts
        updated_ts = get("Last Updated Timestamp") or created_ts

        remapped = []
        for col in full_headers:
            col_l = col.lower()
            if col_l == "date":
                remapped.append(str(date_val).strip()[:10] if date_val else "")
            elif col_l == "category":
                remapped.append(category)
            elif col_l == "amount":
                remapped.append(amount)
            elif col_l == "cumulative amount":
                remapped.append(round(running_cumulative, 2))
            elif col_l == "description":
                remapped.append(description)
            elif col_l == "created timestamp":
                remapped.append(created_ts)
            elif col_l == "last updated timestamp":
                remapped.append(updated_ts)
            elif col_l == "updated device":
                remapped.append("desktop")
            else:
                remapped.append(None)
        result.append(remapped)

    return result

def _remap_share_rows(
    rows: list[list[Any]],
    actual_headers: list[str],
    full_headers: list[str],
    import_ts: str,
) -> list[list[Any]]:
    """
    Map share import rows into canonical Share HEADERS order.
    - Category is normalised to current lowercase key (ipo/sip/buy/sell/dividend).
    - Profit/Loss and Cumulative Profit are preserved from the file if present,
      otherwise set to None.
    - ASBA Charge defaults to 0.
    - Total Amount: calculated as Per Unit Price × Allotted if not supplied.
    - Audit timestamps record the actual import time.
    - Sync Ref defaults to None.
    """
    idx = {h.lower(): i for i, h in enumerate(actual_headers)}
    result = []

    for row in rows:
        def get(col: str, default: Any = None) -> Any:
            i = idx.get(col.lower())
            return row[i] if i is not None else default

        date_val = get("Date", "")
        share_name = str(get("Share Name", "") or "").strip()
        raw_category = str(get("Category", "") or "").strip()
        # Migrate category to current canonical value
        category = _migrate_share_category(raw_category)
        per_unit = _to_float(get("Per Unit Price", 0))
        asba = _to_float(get("ASBA Charge", 0))
        allotted = _to_float(get("Allotted", 0))
        buy_sell = str(get("Buy/Sell", "") or "").strip()

        # Total Amount: use existing value, calculate from price×qty if absent
        raw_total = get("Total Amount")
        total_amount = _to_float(raw_total) if raw_total is not None else round(per_unit * allotted, 2)

        profit_loss = get("Profit/Loss")
        cumulative_profit = get("Cumulative Profit")

        row_ts = get("Created Timestamp") or get("Last Updated Timestamp") or import_ts
        updated_ts = get("Last Updated Timestamp") or row_ts
        sync_ref = get("Sync Ref", None)

        remapped = []
        for col in full_headers:
            col_l = col.lower()
            if col_l == "date":
                remapped.append(str(date_val).strip()[:10] if date_val else "")
            elif col_l == "share name":
                remapped.append(share_name)
            elif col_l == "category":
                remapped.append(category)
            elif col_l == "per unit price":
                remapped.append(per_unit)
            elif col_l == "asba charge":
                remapped.append(asba)
            elif col_l == "allotted":
                remapped.append(int(allotted) if allotted == int(allotted) else allotted)
            elif col_l == "buy/sell":
                remapped.append(buy_sell)
            elif col_l == "total amount":
                remapped.append(total_amount)
            elif col_l == "profit/loss":
                remapped.append(_to_float(profit_loss) if profit_loss is not None else None)
            elif col_l == "cumulative profit":
                remapped.append(_to_float(cumulative_profit) if cumulative_profit is not None else None)
            elif col_l == "created timestamp":
                remapped.append(row_ts)
            elif col_l == "last updated timestamp":
                remapped.append(updated_ts)
            elif col_l == "updated device":
                remapped.append("desktop")
            elif col_l == "sync ref":
                remapped.append(sync_ref)
            else:
                remapped.append(None)
        result.append(remapped)

    return result

def _remap_pf_rows(
    rows: list[list[Any]],
    actual_headers: list[str],
    full_headers: list[str],
    import_ts: str,
    flow_type_override: str = "",
) -> list[list[Any]]:
    """
    Map personal-finance import rows into canonical Personal Finance HEADERS order.
    - Direction is normalised to 'income' or 'expense' (handles credit/debit/in/out etc.).
    - Category is migrated to the closest current valid category for the direction.
    - Signed Amount is recalculated from the normalised direction.
    - Flow Type defaults to flow_type_override or 'bank'.
    - Source defaults to 'manual'.
    - Audit timestamps record the actual import time.
    """
    idx = {h.lower(): i for i, h in enumerate(actual_headers)}
    result = []

    for row in rows:
        def get(col: str, default: Any = None) -> Any:
            i = idx.get(col.lower())
            return row[i] if i is not None else default

        date_val = get("Date", "")
        flow_type = str(get("Flow Type", flow_type_override or "bank") or flow_type_override or "bank").strip().lower()
        raw_direction = str(get("Direction", "expense") or "expense").strip()
        # Normalise direction to 'income' or 'expense'
        direction = _migrate_pf_direction(raw_direction)
        raw_category = str(get("Category", "") or "").strip()
        # Migrate category to the current valid set for this direction
        category = _migrate_pf_category(raw_category, direction)
        amount = abs(_to_float(get("Amount", 0)))
        description = str(get("Description", "") or "").strip()
        source = str(get("Source", "manual") or "manual").strip()
        source_ref = get("Source Ref", None)

        # Always recalculate signed amount from the normalised direction
        signed_amount = amount if direction == "income" else -amount

        row_ts = get("Created Timestamp") or get("Last Updated Timestamp") or import_ts
        updated_ts = get("Last Updated Timestamp") or row_ts

        remapped = []
        for col in full_headers:
            col_l = col.lower()
            if col_l == "date":
                remapped.append(str(date_val).strip()[:10] if date_val else "")
            elif col_l == "flow type":
                remapped.append(flow_type)
            elif col_l == "direction":
                remapped.append(direction)
            elif col_l == "category":
                remapped.append(category)
            elif col_l == "amount":
                remapped.append(amount)
            elif col_l == "signed amount":
                remapped.append(signed_amount)
            elif col_l == "description":
                remapped.append(description)
            elif col_l == "source":
                remapped.append(source)
            elif col_l == "created timestamp":
                remapped.append(row_ts)
            elif col_l == "last updated timestamp":
                remapped.append(updated_ts)
            elif col_l == "updated device":
                remapped.append("desktop")
            elif col_l == "source ref":
                remapped.append(source_ref)
            else:
                remapped.append(None)
        result.append(remapped)

    return result

def _remap_rows(
    data_type: str,
    rows: list[list[Any]],
    actual_headers: list[str],
    full_headers: list[str],
    import_ts: str,
    initial_cumulative: float = 0.0,
    flow_type_override: str = "",
) -> list[list[Any]]:
    if data_type == "bank":
        return _remap_bank_rows(rows, actual_headers, full_headers, import_ts, initial_cumulative)
    elif data_type == "share":
        return _remap_share_rows(rows, actual_headers, full_headers, import_ts)
    elif data_type == "pf-transfer":
        return _remap_transfer_rows(rows, actual_headers, full_headers, import_ts)
    else:
        return _remap_pf_rows(rows, actual_headers, full_headers, import_ts, flow_type_override)

def _validate_import_type(data_type: str, headers: list[str], rows: list[list[Any]]) -> None:
    """Reject workbooks whose recognizable schema belongs to another module."""
    normalized = {header.strip().lower() for header in headers}
    if data_type == "bank":
        if ({"direction", "flow type", "signed amount"} & normalized):
            raise ValueError("This looks like a Personal Expenses workbook. Select Bank Flow or Cash Flow.")
        if {"share name", "buy/sell", "per unit price"} & normalized:
            raise ValueError("This looks like a Share Portfolio workbook. Select Share Portfolio.")
    if data_type in {"pf-bank", "pf-cash"}:
        if "direction" not in normalized:
            raise ValueError("This file is missing the Personal Expenses Direction column.")
        if {"share name", "buy/sell"} & normalized:
            raise ValueError("This looks like a Share Portfolio workbook.")
        flow_idx = next((i for i, value in enumerate(headers) if value.lower() == "flow type"), None)
        expected = "bank" if data_type == "pf-bank" else "cash"
        if flow_idx is not None:
            observed = {
                str(row[flow_idx]).strip().lower()
                for row in rows if flow_idx < len(row) and row[flow_idx] not in (None, "")
            }
            if observed - {expected}:
                raise ValueError(f"This file contains {', '.join(sorted(observed))} flow rows. Select the matching Personal Expenses flow.")
    if data_type == "pf-transfer":
        direction_idx = next((i for i, value in enumerate(headers) if value.lower() == "direction"), None)
        allowed = {"bank_to_cash", "cash_to_bank"}
        observed = {
            _normalize_transfer_direction(row[direction_idx])
            for row in rows if direction_idx is not None and direction_idx < len(row) and row[direction_idx] not in (None, "")
        }
        if observed - allowed:
            raise ValueError("Transfer Direction must be Bank to Cash or Cash to Bank.")
        flow_idx = next((i for i, value in enumerate(headers) if value.lower() == "flow type"), None)
        flow_types = {
            str(row[flow_idx]).strip().lower()
            for row in rows if flow_idx is not None and flow_idx < len(row) and row[flow_idx] not in (None, "")
        }
        if flow_types - {"transfer"}:
            raise ValueError("This does not look like a Bank/Cash transfer workbook.")
        if {"share name", "buy/sell", "per unit price"} & normalized:
            raise ValueError("This does not look like a Bank/Cash transfer workbook.")

def _normalize_transfer_direction(value: Any) -> str:
    normalized = str(value or "").strip().lower().replace("→", " to ").replace("->", " to ")
    normalized = " ".join(normalized.replace("_", " ").split())
    return {
        "bank to cash": "bank_to_cash",
        "cash to bank": "cash_to_bank",
    }.get(normalized, normalized.replace(" ", "_"))

def _remap_transfer_rows(
    rows: list[list[Any]], actual_headers: list[str], full_headers: list[str], import_ts: str,
) -> list[list[Any]]:
    idx = {header.lower(): i for i, header in enumerate(actual_headers)}
    result = []
    for row in rows:
        def get(col: str, default: Any = None) -> Any:
            position = idx.get(col.lower())
            return row[position] if position is not None and position < len(row) else default
        date_val = get("Date", "")
        direction = _normalize_transfer_direction(get("Direction", ""))
        amount = abs(_to_float(get("Amount", 0)))
        description = str(get("Description", "") or "").strip()
        created = get("Created Timestamp") or get("Last Updated Timestamp") or import_ts
        timestamp = get("Last Updated Timestamp") or created
        transfer_ref = str(get("Source Ref", "") or "").strip() or f"transfer:{str(date_val)[:10]}:{uuid.uuid4().hex[:8]}"
        mapped = []
        for column in full_headers:
            key = column.lower()
            if key == "date": mapped.append(str(date_val).strip()[:10] if date_val else "")
            elif key == "flow type": mapped.append("transfer")
            elif key == "direction": mapped.append(direction)
            elif key == "category": mapped.append("Transfer")
            elif key in {"amount", "signed amount"}: mapped.append(amount)
            elif key == "description": mapped.append(description)
            elif key == "source": mapped.append("transfer")
            elif key == "created timestamp": mapped.append(created)
            elif key == "last updated timestamp": mapped.append(timestamp)
            elif key == "source ref": mapped.append(transfer_ref)
            elif key == "updated device": mapped.append("desktop")
            else: mapped.append(None)
        result.append(mapped)
    return result

def _backup_live_file(live_path: Path) -> Path | None:
    if not live_path.exists():
        return None
    tag = readable_backup_timestamp(datetime.now(timezone.utc))
    backup_dir = get_backup_directory(live_path) / "import" / tag
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_file = backup_dir / live_path.name
    shutil.copy2(live_path, backup_file)
    return backup_file

def _count_live_rows(live_path: Path, sheet_name: str) -> int:
    if not live_path.exists():
        return 0
    try:
        wb = load_workbook(live_path, read_only=True, data_only=True)
        try:
            ws = wb[sheet_name] if sheet_name in wb.sheetnames else wb.active
            count = sum(
                1 for row in ws.iter_rows(min_row=2, values_only=True)
                if any(v is not None for v in row)
            )
        finally:
            wb.close()
        return count
    except Exception:
        return 0

def _read_live_rows(live_path: Path, sheet_name: str, data_type: str = "") -> tuple[list[list[Any]], float]:
    """Read existing live data rows (in canonical column order).
    Also returns the last cumulative amount (bank only, column index 3)."""
    if not live_path.exists():
        return [], 0.0
    _, rows = _read_workbook_rows(live_path, sheet_name)
    last_cumulative = 0.0
    if rows and data_type == "bank":
        try:
            last_cumulative = float(rows[-1][3] or 0)
        except (IndexError, TypeError, ValueError):
            last_cumulative = 0.0
    return rows, last_cumulative

def _ensure_import_workbook_ready(data_type: str) -> None:
    """Run the Personal Expenses legacy-sheet repair before checking or merging rows."""
    if data_type == "pf-bank":
        from ..personal_finance_service import _ensure_workbook_exists
        _ensure_workbook_exists("bank")
    elif data_type == "pf-cash":
        from ..personal_finance_service import _ensure_workbook_exists
        _ensure_workbook_exists("cash")

def import_data_file(
    data_type: str,
    uploaded_path: Path,
    mode: str = "replace",
) -> dict[str, Any]:
    """
    Import an Excel file for the given data_type.

    mode:
      "replace" — discard current live data and replace with the import file.
      "merge"   — keep existing live rows, append imported rows after them.

    Old column names are automatically aliased to their current equivalents.
    Derived columns (Cumulative Amount, Signed Amount, Total Amount) are
    calculated from the available data if not present in the import file.
    Missing audit timestamps use the time the import writes each row.
    """
    config = get_data_type_config(data_type)
    live_path = Path(config["path"])
    full_headers: list[str] = list(config["headers"])
    required_headers: list[str] = list(config["required_headers"])
    sheet_name: str = str(config["sheet_name"])

    if not uploaded_path.exists():
        raise ValueError("Import file was not found on the server.")

    suffix = uploaded_path.suffix.lower()
    if suffix not in {".xlsx", ".xlsm"}:
        raise ValueError("Import file must be an Excel workbook (.xlsx).")

    try:
        actual_headers, import_rows = _read_workbook_rows(uploaded_path, sheet_name)
    except Exception as exc:
        raise ValueError(f"Could not read the import workbook: {exc}") from exc

    if not actual_headers:
        raise ValueError("The import file appears to be empty — no header row found.")

    _validate_import_type(data_type, actual_headers, import_rows)

    # Validate that all truly required columns are present (aliases already applied)
    missing = _validate_required_headers(actual_headers, required_headers)
    if missing:
        raise ValueError(
            f"The import file is missing required columns: {', '.join(missing)}. "
            f"Required: {', '.join(required_headers)}"
        )

    import_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # For merge mode: load existing live rows first
    live_rows: list[list[Any]] = []
    initial_cumulative = 0.0
    flow_type_override = "bank" if data_type == "pf-bank" else ("cash" if data_type == "pf-cash" else "")

    if mode == "merge":
        _ensure_import_workbook_ready(data_type)
        live_rows, initial_cumulative = _read_live_rows(live_path, sheet_name, data_type)
    else:
        initial_cumulative = 0.0

    # For bank in replace mode: cumulative starts from 0.
    # For bank in merge mode: cumulative continues from last live row.
    remapped = _remap_rows(
        data_type,
        import_rows,
        actual_headers,
        full_headers,
        import_ts,
        initial_cumulative=initial_cumulative,
        flow_type_override=flow_type_override,
    )

    backup_file = _backup_live_file(live_path)

    tag = datetime.now().strftime("%Y%m%d-%H%M%S")
    safe_stem = Path(str(config["filename"])).stem
    staged_path = DATA_DIR / f".import-{safe_stem}-{tag}.xlsx"

    try:
        wb = Workbook()
        ws = wb.active
        ws.title = sheet_name
        ws.append(full_headers)
        for row in live_rows:
            ws.append(row)
        for row in remapped:
            ws.append(row)
        wb.save(staged_path)
        os.replace(staged_path, live_path)
    finally:
        if staged_path.exists() and staged_path != live_path:
            staged_path.unlink(missing_ok=True)

    return {
        "data_type": data_type,
        "label": config["label"],
        "filename": config["filename"],
        "file": str(live_path),
        "backup_file": str(backup_file) if backup_file else None,
        "imported_rows": len(remapped),
        "merged_rows": len(live_rows),
        "mode": mode,
    }

def check_live_has_data(data_type: str) -> bool:
    """Return True if the live file for this data_type already has at least one data row."""
    config = get_data_type_config(data_type)
    _ensure_import_workbook_ready(data_type)
    live_path = Path(config["path"])
    sheet_name = str(config["sheet_name"])
    return _count_live_rows(live_path, sheet_name) > 0
