"""Safe one-time copying of legacy desktop workbooks into the shared data folder."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from openpyxl import load_workbook

REPORT_NAME = ".finledge-data-migration.json"
WORKBOOKS = {
    "bank_transactions.xlsx": ("bank_transactions.xlsx", "bank.xlsx"),
    "share_transactions.xlsx": ("share_transactions.xlsx", "share.xlsx"),
    "personal_finance_bank_flow.xlsx": ("personal_finance_bank_flow.xlsx",),
    "personal_finance_cash_flow.xlsx": ("personal_finance_cash_flow.xlsx",),
    "personal_finance_transfer.xlsx": ("personal_finance_transfer.xlsx",),
}
REQUIRED_HEADER_GROUPS = {
    "bank_transactions.xlsx": (("date",), ("category", "particulars", "type"), ("amount", "total amount")),
    "share_transactions.xlsx": (("date",), ("share name", "company", "stock name"), ("category", "transaction type", "type")),
    "personal_finance_bank_flow.xlsx": (("date",), ("category",), ("amount", "total amount")),
    "personal_finance_cash_flow.xlsx": (("date",), ("category",), ("amount", "total amount")),
    "personal_finance_transfer.xlsx": (("date",), ("amount", "total amount"), ("direction", "flow type", "type")),
}


def _migration_timestamp() -> str:
    return datetime.now().astimezone().strftime("%Y-%m-%d - %I-%M-%S %p - Data Folder Migration")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _validate_workbook(path: Path, canonical: str | None = None) -> None:
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        if not workbook.worksheets:
            raise ValueError("Workbook has no worksheets")
        expected = REQUIRED_HEADER_GROUPS.get(canonical, (("date",),))
        has_valid_header = False
        for sheet in workbook.worksheets:
            first_row = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), ())
            normalized = {str(value or "").strip().casefold() for value in first_row}
            if all(any(alias in normalized for alias in group) for group in expected):
                has_valid_header = True
            for _ in sheet.iter_rows(values_only=True):
                pass
        if not has_valid_header:
            raise ValueError("Workbook is missing required FinLedge columns")
    finally:
        workbook.close()


def _row_signatures(path: Path) -> set[tuple[str, ...]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    signatures: set[tuple[str, ...]] = set()
    try:
        for sheet in workbook.worksheets:
            first_row = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), ())
            if not any(str(value or "").strip().casefold() == "date" for value in first_row):
                continue
            for row in sheet.iter_rows(min_row=2, values_only=True):
                if any(value is not None for value in row):
                    signatures.add(tuple(value.isoformat() if hasattr(value, "isoformat") else str(value or "") for value in row))
    finally:
        workbook.close()
    return signatures


def _is_subset_workbook(source: Path, destination: Path) -> bool:
    try:
        return _row_signatures(source).issubset(_row_signatures(destination))
    except Exception:
        return False


def _copy_verified(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    if _sha256(source) != _sha256(destination):
        raise IOError(f"Could not verify copied workbook: {source.name}")


def _normalize_cell(value) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return "" if value is None else str(value)


def _merge_workbooks(source: Path, destination: Path, canonical: str) -> None:
    """Append missing data rows from one valid workbook without replacing existing rows."""
    source_book = load_workbook(source)
    destination_book = load_workbook(destination)
    changed = False
    try:
        expected = REQUIRED_HEADER_GROUPS[canonical]
        for source_sheet in source_book.worksheets:
            headers = [_normalize_cell(cell.value).strip() for cell in source_sheet[1]]
            normalized_headers = {header.casefold() for header in headers}
            if not all(any(alias in normalized_headers for alias in group) for group in expected):
                continue
            destination_sheet = destination_book[source_sheet.title] if source_sheet.title in destination_book.sheetnames else None
            if destination_sheet is None:
                destination_sheet = destination_book.create_sheet(source_sheet.title)
                for row in source_sheet.iter_rows():
                    destination_sheet.append([cell.value for cell in row])
                changed = True
                continue
            destination_headers = [_normalize_cell(cell.value).strip() for cell in destination_sheet[1]]
            if destination_headers != headers:
                continue
            seen = {
                tuple(_normalize_cell(cell.value) for cell in row)
                for row in destination_sheet.iter_rows(min_row=2)
                if any(cell.value is not None for cell in row)
            }
            for row in source_sheet.iter_rows(min_row=2):
                values = [cell.value for cell in row]
                if not any(value is not None for value in values):
                    continue
                signature = tuple(_normalize_cell(value) for value in values)
                if signature in seen:
                    continue
                destination_sheet.append(values)
                seen.add(signature)
                changed = True
        if changed:
            destination_book.save(destination)
    finally:
        source_book.close()
        destination_book.close()


def _unique_migration_directory(backup_dir: Path) -> Path:
    base = backup_dir / "migration" / _migration_timestamp()
    candidate = base
    suffix = 2
    while candidate.exists():
        candidate = base.with_name(f"{base.name} ({suffix})")
        suffix += 1
    candidate.mkdir(parents=True)
    return candidate


def _direct_sources(legacy_dirs: list[Path]) -> list[tuple[int, Path, str, str]]:
    sources = []
    seen: set[Path] = set()
    for root_index, root_value in enumerate(legacy_dirs):
        root = Path(root_value).expanduser().resolve()
        for canonical, aliases in WORKBOOKS.items():
            for filename in aliases:
                source = (root / filename).resolve()
                if source.is_file() and source not in seen:
                    sources.append((root_index, source, canonical, filename))
                    seen.add(source)
    return sources


def _backup_direct_sources(sources: list[tuple[int, Path, str, str]], migration_dir: Path) -> dict[Path, Path]:
    backups: dict[Path, Path] = {}
    for root_index, source, _canonical, _filename in sources:
        backup = migration_dir / "source-data" / f"source-{root_index + 1}" / source.name
        _copy_verified(source, backup)
        backups[source] = backup
    return backups


def _copy_backup_history(data_dir: Path, legacy_dirs: list[Path], backup_dir: Path) -> list[str]:
    sources = [Path(root).expanduser().resolve() / "backups" for root in legacy_dirs]
    sources.append(data_dir / "backups")
    copied: list[str] = []
    target_root = backup_dir.expanduser().resolve()
    for source_root in dict.fromkeys(sources):
        if not source_root.is_dir() or source_root.resolve() == target_root:
            continue
        for source in source_root.rglob("*"):
            if not source.is_file():
                continue
            relative = source.relative_to(source_root)
            target = target_root / relative
            if target.exists():
                if _sha256(target) == _sha256(source):
                    continue
                target = target.with_name(f"{target.stem} - legacy-{_sha256(source)[:8]}{target.suffix}")
                if target.exists():
                    continue
            _copy_verified(source, target)
            copied.append(str(target))
    return copied


def _backup_candidates(canonical: str, legacy_dirs: list[Path], backup_dir: Path, excluded: Path) -> list[Path]:
    stems = {Path(name).stem.casefold() for name in WORKBOOKS[canonical]}
    filenames = {name.casefold() for name in WORKBOOKS[canonical]}
    roots = [Path(root).expanduser().resolve() / "backups" for root in legacy_dirs]
    roots.extend([Path(backup_dir).resolve(), Path(backup_dir).resolve() / ".." / "backups"])
    candidates: set[Path] = set()
    for root in dict.fromkeys(path.resolve() for path in roots):
        if not root.is_dir():
            continue
        for path in root.rglob("*.xlsx"):
            resolved = path.resolve()
            if resolved == excluded or "corrupted" in {part.casefold() for part in resolved.parts}:
                continue
            if path.name.casefold() in filenames or path.parent.name.casefold() in stems:
                candidates.add(resolved)
    return sorted(candidates, key=lambda path: path.stat().st_mtime, reverse=True)


def migrate_legacy_workbooks(
    data_dir: Path,
    legacy_dirs: list[Path],
    backup_dir: Path | None = None,
) -> dict:
    """Validate, back up, recover, and safely centralize legacy workbook files."""
    data_dir = Path(data_dir).expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    backup_dir = Path(backup_dir or os.getenv("FINLEDGE_BACKUP_DIR") or data_dir / "backups").expanduser().resolve()
    backup_dir.mkdir(parents=True, exist_ok=True)
    legacy_dirs = list(dict.fromkeys(Path(root).expanduser().resolve() for root in legacy_dirs if Path(root).expanduser().resolve() != data_dir))
    sources = _direct_sources(legacy_dirs)
    existing_targets = [data_dir / name for name in WORKBOOKS if (data_dir / name).exists()]
    needs_migration_snapshot = bool(sources) or any(
        target.exists() and not _is_valid(target) for target in existing_targets
    )
    migration_dir = _unique_migration_directory(backup_dir) if needs_migration_snapshot else None

    result = {
        "completedAt": datetime.now().astimezone().isoformat(),
        "complete": True,
        "status": "existing_data" if existing_targets else "migrated_legacy_data",
        "destination": str(data_dir),
        "backupDirectory": str(backup_dir),
        "migrationBackup": str(migration_dir) if migration_dir else None,
        "files": [],
        "removedLegacyFiles": [],
        "retainedLegacyFiles": [],
    }
    report_path = data_dir / REPORT_NAME

    try:
        # Root backups remain outside FinLedge Data. Older backups nested inside
        # FinLedge Data or legacy AppData roots are copied beside it for recovery.
        result["copiedBackupFiles"] = _copy_backup_history(data_dir, legacy_dirs, backup_dir)

        source_backups = _backup_direct_sources(sources, migration_dir) if migration_dir else {}
        if migration_dir:
            for target in existing_targets:
                if target.exists() and not _is_valid(target):
                    _copy_verified(target, migration_dir / "destination-data" / target.name)

        for canonical, aliases in WORKBOOKS.items():
            target = data_dir / canonical
            target_valid = target.is_file() and _is_valid(target, canonical)
            file_result = {"name": canonical, "destination": str(target)}
            if target_valid:
                file_result["status"] = "already_valid"
            else:
                direct = [source for _, source, name, _ in sources if name == canonical and _is_valid(source, canonical)]
                backup_candidates = _backup_candidates(canonical, legacy_dirs, backup_dir, migration_dir or Path())
                valid_backup = next((candidate for candidate in backup_candidates if _is_valid(candidate, canonical)), None)
                selected = direct[0] if direct else valid_backup
                if selected is None:
                    if target.exists():
                        raise RuntimeError(f"{canonical} is damaged and no valid backup or legacy copy was found. The original was left untouched.")
                    file_result["status"] = "not_present"
                    result["files"].append(file_result)
                    continue

                staging = data_dir / f".migration-{Path(canonical).stem}-{uuid4().hex}.xlsx"
                try:
                    _copy_verified(selected, staging)
                    _validate_workbook(staging, canonical)
                    os.replace(staging, target)
                finally:
                    staging.unlink(missing_ok=True)
                if not _is_valid(target, canonical):
                    raise RuntimeError(f"Could not verify migrated workbook {canonical}.")
                target_valid = True
                file_result["status"] = "restored_from_backup" if selected in backup_candidates else "copied_from_legacy"
                file_result["source"] = str(selected)

            # A partially completed earlier run or a pre-existing destination can
            # coexist with newer root data. Back up the destination, merge unique
            # rows, validate both copies, and only then consider removing sources.
            for _, source, source_canonical, _filename in sources:
                if source_canonical != canonical or not _is_valid(source, canonical) or not target_valid:
                    continue
                if _is_subset_workbook(source, target):
                    continue
                if migration_dir:
                    _copy_verified(target, migration_dir / "destination-data" / target.name)
                staging = data_dir / f".merge-{Path(canonical).stem}-{uuid4().hex}.xlsx"
                try:
                    _copy_verified(target, staging)
                    _merge_workbooks(source, staging, canonical)
                    _validate_workbook(staging, canonical)
                    os.replace(staging, target)
                finally:
                    staging.unlink(missing_ok=True)
                if not _is_valid(target, canonical) or not _is_subset_workbook(source, target):
                    raise RuntimeError(f"Could not verify merged workbook {canonical}; legacy data was retained.")
                file_result["status"] = "merged_legacy_data"

            if target_valid:
                file_result["validated"] = True
                for _, source, source_canonical, _filename in sources:
                    if source_canonical != canonical:
                        continue
                    backup_copy = source_backups.get(source)
                    if backup_copy and backup_copy.is_file() and _sha256(backup_copy) == _sha256(source):
                        source_safe = not _is_valid(source) or _is_subset_workbook(source, target)
                        if source_safe:
                            source.unlink()
                            result["removedLegacyFiles"].append(str(source))
                        else:
                            result["retainedLegacyFiles"].append(str(source))
                    else:
                        result["retainedLegacyFiles"].append(str(source))
            result["files"].append(file_result)

        # Existing valid destination files were checked above. Missing modules are
        # initialized after this service returns; no legacy file is removed for them.
        if result["removedLegacyFiles"]:
            result["status"] = "migrated_legacy_data"
        elif result["retainedLegacyFiles"]:
            result["status"] = "source_data_retained_for_review"
        elif not existing_targets and not sources:
            result["status"] = "new_install"
        report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        return result
    except Exception as exc:
        result.update({"complete": False, "status": "failed", "error": str(exc)})
        try:
            report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        except OSError:
            pass
        raise RuntimeError(f"Could not safely prepare the FinLedge data folder: {exc}") from exc


def _is_valid(path: Path, canonical: str | None = None) -> bool:
    try:
        candidate = canonical or Path(path).name
        _validate_workbook(path, candidate if candidate in REQUIRED_HEADER_GROUPS else None)
        return True
    except Exception:
        return False
