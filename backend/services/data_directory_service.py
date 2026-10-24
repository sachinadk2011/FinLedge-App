"""Safe one-time copying of legacy desktop workbooks into the shared data folder."""

from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from openpyxl import load_workbook

REPORT_NAME = ".finledge-data-migration.json"
WORKBOOKS = {
    "bank_transactions.xlsx": ("bank_transactions.xlsx", "bank.xlsx"),
    "share_transactions.xlsx": ("share_transactions.xlsx", "share.xlsx"),
    "personal_finance_bank_flow.xlsx": ("personal_finance_bank_flow.xlsx",),
    "personal_finance_cash_flow.xlsx": ("personal_finance_cash_flow.xlsx",),
    "personal_finance_transfer.xlsx": ("personal_finance_transfer.xlsx",),
}


def _validate_workbook(path: Path) -> None:
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        for sheet in workbook.worksheets:
            for _ in sheet.iter_rows(values_only=True):
                pass
    finally:
        workbook.close()


def migrate_legacy_workbooks(data_dir: Path, legacy_dirs: list[Path]) -> dict:
    """Copy and validate legacy files without changing sources or existing targets."""
    data_dir = Path(data_dir).expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    report_path = data_dir / REPORT_NAME
    if report_path.exists():
        try:
            prior = json.loads(report_path.read_text(encoding="utf-8"))
            if prior.get("complete"):
                if prior.get("status") == "new_install" and any(data_dir.glob("*.xlsx")):
                    return {**prior, "status": "existing_data", "alreadyCompleted": True}
                return {**prior, "alreadyCompleted": True}
        except (OSError, ValueError):
            pass

    existing = [p.name for p in data_dir.glob("*.xlsx") if p.is_file()]
    result = {
        "completedAt": datetime.now(timezone.utc).isoformat(),
        "complete": True,
        "status": "existing_data" if existing else "migrated_legacy_data",
        "destination": str(data_dir),
        "existingWorkbooks": existing,
        "files": [],
    }
    if existing:
        report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        return result

    staged: list[tuple[Path, Path]] = []
    created_targets: list[Path] = []
    created_backup_dir: Path | None = None
    try:
        staging = data_dir / ".migration-staging"
        staging.mkdir(exist_ok=True)
        for name, candidates in WORKBOOKS.items():
            source = next(
                (Path(root) / candidate for root in legacy_dirs for candidate in candidates
                 if (Path(root) / candidate).is_file()),
                None,
            )
            if source is None:
                continue
            staged_file = staging / name
            shutil.copy2(source, staged_file)
            _validate_workbook(staged_file)
            staged.append((source, staged_file))
            result["files"].append({"name": name, "source": str(source), "status": "validated"})

        for source, staged_file in staged:
            target = data_dir / staged_file.name
            if target.exists():
                raise FileExistsError(f"Destination changed during migration: {target.name}")
            os.replace(staged_file, target)
            created_targets.append(target)
            next(item for item in result["files"] if item["name"] == staged_file.name)["status"] = "copied"
        for legacy_dir in legacy_dirs:
            source_backups = Path(legacy_dir) / "backups"
            target_backups = data_dir / "backups"
            if source_backups.is_dir() and not target_backups.exists():
                staged_backups = staging / "backups"
                shutil.copytree(source_backups, staged_backups)
                for backup_file in staged_backups.rglob("*.xlsx"):
                    _validate_workbook(backup_file)
                os.replace(staged_backups, target_backups)
                created_backup_dir = target_backups
                result["backups"] = {"source": str(source_backups), "status": "copied_and_validated"}
                break
        shutil.rmtree(staging)
        if not result["files"] and "backups" not in result:
            result["status"] = "new_install"
    except Exception as exc:
        for target in created_targets:
            if target.exists():
                target.unlink()
        if created_backup_dir and created_backup_dir.exists():
            shutil.rmtree(created_backup_dir)
        shutil.rmtree(data_dir / ".migration-staging", ignore_errors=True)
        result.update({"complete": False, "status": "failed", "error": str(exc)})
        report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        raise RuntimeError(f"Could not safely prepare the FinLedge data folder: {exc}") from exc

    report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result
