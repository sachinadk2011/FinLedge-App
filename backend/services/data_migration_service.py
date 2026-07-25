"""Non-destructive FinLedge data migrations run before the API becomes ready."""

from __future__ import annotations

import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import Workbook, load_workbook

from .excel_utils import to_float as _amount
from .path_utils import get_data_dir

MIGRATION_VERSION = "v1.2.0"
SHEET_NAME = "Bank"
HEADERS = [
    "Date",
    "Category",
    "Amount",
    "Cumulative Amount",
    "Description",
    "Created Timestamp",
    "Last Updated Timestamp",
]
LEGACY_CATEGORIES = {"income", "service cost", "investment cost", "operation cost"}
RETIRED_CATEGORIES = {"atm charge", "sms charge"}


def _normalized(value: object) -> str:
    return str(value or "").strip().lower()


def _map_legacy_category(category: object, description: object) -> tuple[str, int, str]:
    original = _normalized(category)
    text = _normalized(description)
    compact_text = text.replace(" ", "")
    if original == "atm charge":
        return "Debit Card Charge", -1, "retired ATM Charge moved to Debit Card Charge"
    if original == "sms charge":
        return "Mobile Banking Charge", -1, "retired SMS Charge moved to Mobile Banking Charge"
    if original not in LEGACY_CATEGORIES:
        return str(category or "").strip(), 0, "already compatible"
    if original == "income" and ("interest" in text or "int" in text):
        return "Interest Earned", 1, "Income with interest/int"
    if original == "service cost" and "tax" in text:
        return "Interest Tax", -1, "Service Cost with tax"
    if original == "service cost" and "mobile banking" in text and "renew" in text:
        return "Mobile Banking Charge", -1, "Service Cost with mobile banking and renew"
    if original == "service cost" and "bank" in text and "renew" in text:
        return "Mobile Banking Charge", -1, "Service Cost with bank and renew"
    if original == "service cost" and "mobile" in text:
        return "Mobile Banking Charge", -1, "Service Cost with mobile"
    if original == "service cost" and "card" in text and "install" in text:
        return "Debit Card Charge", -1, "Service Cost with card and installment"
    if original == "investment cost" and "demat" in text and "meroshare" in compact_text and "renew" in text:
        return "Demat & MeroShare Renewal", -1, "Investment Cost with Demat, MeroShare, and renew"
    if original == "investment cost" and "meroshare" in compact_text and "renew" in text:
        return "MeroShare Renewal", -1, "Investment Cost with MeroShare and renew"
    if original == "investment cost" and "demat" in text and "renew" in text:
        return "Demat Renewal", -1, "Investment Cost with demat and renew"
    if original == "investment cost" and "broker" in text and "renew" in text:
        return "Broker Renewal", -1, "Investment Cost with broker and renew"
    return "Other Charges", -1, "legacy category did not match a specific v1.2.0 rule"


def _needs_migration(source_path: Path) -> bool:
    workbook = load_workbook(source_path, read_only=True, data_only=True)
    try:
        sheet = workbook[SHEET_NAME] if SHEET_NAME in workbook.sheetnames else workbook.active
        first_row = next(sheet.iter_rows(min_row=1, max_row=1, max_col=len(HEADERS), values_only=True), ())
        headers = list(first_row)
        if headers != HEADERS:
            return True
        return any(
            _normalized(row[1] if len(row) > 1 else "") in LEGACY_CATEGORIES | RETIRED_CATEGORIES
            for row in sheet.iter_rows(min_row=2, values_only=True)
        )
    finally:
        workbook.close()


def _read_and_map(source_path: Path) -> tuple[list[list[Any]], list[dict[str, Any]]]:
    workbook = load_workbook(source_path, data_only=True)
    try:
        sheet = workbook[SHEET_NAME] if SHEET_NAME in workbook.sheetnames else workbook.active
        rows: list[list[Any]] = []
        decisions: list[dict[str, Any]] = []
        cumulative = 0.0
        timestamp = datetime.now().isoformat(timespec="seconds")

        for source_row, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if not row or all(value is None for value in row):
                continue
            date_value = row[0] if len(row) > 0 else ""
            old_category = row[1] if len(row) > 1 else ""
            old_amount = _amount(row[2] if len(row) > 2 else 0)
            description = str(row[4] or "") if len(row) > 4 else ""
            # v1.1.0 had a single Timestamp column at index 5. New files have
            # Created Timestamp and Last Updated Timestamp at indices 5 and 6.
            created_at = str(row[5] or "") if len(row) > 5 else ""
            updated_at = str(row[6] or "") if len(row) > 6 else created_at
            new_category, sign, reason = _map_legacy_category(old_category, description)
            new_amount = abs(old_amount) * sign if sign else old_amount
            cumulative += new_amount
            rows.append([date_value, new_category, new_amount, cumulative, description, created_at or timestamp, updated_at or timestamp])
            decisions.append({
                "source_row": source_row,
                "date": str(date_value or ""),
                "original_category": str(old_category or ""),
                "original_amount": old_amount,
                "description": description,
                "migrated_category": new_category,
                "migrated_amount": new_amount,
                "decision": reason,
            })
        return rows, decisions
    finally:
        workbook.close()


def _write_and_validate(path: Path, rows: list[list[Any]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = SHEET_NAME
    sheet.append(HEADERS)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()

    validated_workbook = load_workbook(path, data_only=True)
    try:
        validated = validated_workbook[SHEET_NAME]
        actual_headers = [validated.cell(1, index).value for index in range(1, len(HEADERS) + 1)]
        actual_rows = sum(1 for row in validated.iter_rows(min_row=2, values_only=True) if any(value is not None for value in row))
        if actual_headers != HEADERS or actual_rows != len(rows):
            raise ValueError("Staged migration workbook validation failed.")
    finally:
        validated_workbook.close()


def migrate_bank_workbook(data_dir: Path, *, apply: bool) -> dict[str, Any]:
    source = data_dir / "bank_transactions.xlsx"
    if not source.exists():
        return {"status": "not-found", "source_file": str(source), "migration": MIGRATION_VERSION}

    rows, decisions = _read_and_map(source)
    mapped = [item for item in decisions if item["decision"] != "already compatible"]
    report: dict[str, Any] = {
        "migration": MIGRATION_VERSION,
        "mode": "apply" if apply else "preview",
        "source_file": str(source),
        "row_count": len(decisions),
        "mapped_row_count": len(mapped),
        "unchanged_row_count": len(decisions) - len(mapped),
        "decisions": decisions,
    }
    if not apply:
        return report

    tag = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = data_dir / "backups" / f"v1.1.0-to-{MIGRATION_VERSION}" / tag
    backup_dir.mkdir(parents=True, exist_ok=False)
    backup_file = backup_dir / source.name
    staged_workbook = data_dir / f".bank_transactions.{MIGRATION_VERSION}-{tag}.xlsx"
    staged_report = data_dir / f".bank_migration_report_{MIGRATION_VERSION}-{tag}.json"
    report_file = backup_dir / "migration-report.json"

    try:
        # Preserve raw data before any migration file is created.
        shutil.copy2(source, backup_file)
        _write_and_validate(staged_workbook, rows)
        report.update({"status": "migrated", "backup_folder": str(backup_dir), "backup_file": str(backup_file), "report_file": str(report_file)})
        staged_report.write_text(json.dumps(report, indent=2), encoding="utf-8")
        os.replace(staged_workbook, source)
        os.replace(staged_report, report_file)
        return report
    finally:
        for path in (staged_workbook, staged_report):
            if path.exists():
                path.unlink()


def run_pending_data_migrations(data_dir: Path | None = None) -> dict[str, Any]:
    target_dir = data_dir or get_data_dir()
    source = target_dir / "bank_transactions.xlsx"
    if not source.exists():
        return {"status": "not-found", "migration": MIGRATION_VERSION, "source_file": str(source)}
    if not _needs_migration(source):
        return {"status": "not-needed", "migration": MIGRATION_VERSION, "source_file": str(source)}
    return migrate_bank_workbook(target_dir, apply=True)
