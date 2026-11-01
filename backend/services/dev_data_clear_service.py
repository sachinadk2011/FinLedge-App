"""Guarded transaction-row clearing for explicit Development/Testing runs."""

import logging
import os
from pathlib import Path

from .excel_utils import preserve_automatic_backup_history, snapshot_before_write, workbook_for_update
from .workbook_merge import append_tombstone, refresh_sheet_metadata

logger = logging.getLogger(__name__)
ALLOWED_MODES = {"development", "testing"}


def explicit_clear_mode() -> str | None:
    mode = str(os.getenv("FINLEDGE_MODE") or "").strip().lower()
    return mode if mode in ALLOWED_MODES else None


def clear_tool_status() -> dict:
    mode = explicit_clear_mode()
    return {"enabled": mode is not None, "mode": mode or ""}


def clear_module_rows(data_type: str, *, confirmed: bool = False) -> dict:
    mode = explicit_clear_mode()
    if mode is None:
        raise PermissionError("Module data clearing is available only in an explicitly identified Development or Testing environment.")
    if confirmed is not True:
        raise ValueError("Confirm the selected module data clear before proceeding.")

    from . import bank_service, personal_finance_service, personal_finance_transfers, share_service
    from .settings_data.config import get_data_type_config

    clear_sip_only = data_type == "share-sip"
    config_type = "share" if clear_sip_only else data_type
    config = get_data_type_config(config_type)
    path = Path(config["path"])
    sheet_name = str(config["sheet_name"])
    headers = list(config["headers"])

    if config_type == "bank":
        lock, ensure, kind = bank_service._file_lock, bank_service._ensure_workbook_exists, "bank"
    elif config_type == "share":
        lock, ensure, kind = share_service._file_lock, share_service._ensure_workbook_exists, "share"
    elif config_type in {"pf-bank", "pf-cash"}:
        flow = "bank" if config_type == "pf-bank" else "cash"
        lock, ensure, kind = personal_finance_service._file_lock, lambda: personal_finance_service._ensure_workbook_exists(flow), "personal_finance"
    else:
        lock = personal_finance_service._file_lock
        ensure = personal_finance_transfers._ensure_transfer_workbook_exists
        kind = "transfer"

    removed = 0
    # Clearing test rows is reversible: preserve the complete pre-clear snapshot,
    # and do not prune any existing automatic backups as part of this action.
    with preserve_automatic_backup_history():
        with workbook_for_update(path, lock, ensure, snapshotter=snapshot_before_write) as workbook:
            if sheet_name not in workbook.sheetnames:
                raise ValueError(f"The {config['label']} worksheet was not found.")
            sheet = workbook[sheet_name]
            header_indexes = {str(sheet.cell(1, column).value or "").strip().casefold(): column for column in range(1, sheet.max_column + 1)}
            row_id_column = header_indexes.get("row id")
            category_column = header_indexes.get("category")
            selected_rows = []
            for row_number in range(2, sheet.max_row + 1):
                if clear_sip_only and str(sheet.cell(row_number, category_column).value or "").strip().lower() != "sip":
                    continue
                selected_rows.append(row_number)

            for row_number in selected_rows:
                if row_id_column:
                    row_id = str(sheet.cell(row_number, row_id_column).value or "").strip()
                    if row_id:
                        append_tombstone(workbook, row_id)
            for row_number in reversed(selected_rows):
                sheet.delete_rows(row_number, 1)
            removed = len(selected_rows)

            if config_type == "share":
                share_service._recompute_sheet(sheet)
                scope = "share_transactions.xlsx#share"
            elif config_type == "bank":
                bank_service._recompute_bank_sheet(sheet)
                scope = "bank_transactions.xlsx#bank"
            elif config_type == "pf-transfer":
                scope = "personal_finance_transfer.xlsx#transfer flow"
            else:
                scope = f"{path.name.casefold()}#{sheet_name.casefold()}"
            refresh_sheet_metadata(sheet, kind, identity_scope=scope)

    logger.warning("Development/test data clear: type=%s rows=%s mode=%s workbook=%s", data_type, removed, mode, path)
    return {"data_type": data_type, "label": "SIP" if clear_sip_only else config["label"], "removed_rows": removed, "file": str(path)}
