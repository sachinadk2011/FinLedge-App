"""Background, resumable backfill for legacy workbook row metadata."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import uuid
from pathlib import Path

from .path_utils import get_data_dir

logger = logging.getLogger(__name__)
_worker_lock = threading.Lock()
_worker_started = False


def _write_progress(progress_path: Path, payload: dict) -> None:
    progress_path.parent.mkdir(parents=True, exist_ok=True)
    staged = progress_path.with_name(f".{progress_path.name}.{uuid.uuid4().hex}.tmp")
    try:
        staged.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        os.replace(staged, progress_path)
    finally:
        staged.unlink(missing_ok=True)


def backfill_metadata_once(data_dir: Path | None = None) -> dict:
    """Upgrade each workbook separately; retries resume from workbook state."""
    from . import bank_service, personal_finance_service, share_service
    from .data_migration_service import migrate_sync_metadata_workbook_locked, record_migration_state

    target = Path(data_dir or get_data_dir()).expanduser().resolve()
    shared_sync_dir = Path(os.getenv("FINLEDGE_SHARED_SYNC_DIR") or target.parent / "FinLedge Data Shared").expanduser().resolve()
    progress_path = shared_sync_dir / ".metadata-backfill-progress.json"
    try:
        progress = json.loads(progress_path.read_text(encoding="utf-8"))
        if not isinstance(progress, dict):
            progress = {}
    except (OSError, ValueError):
        progress = {}
    completed = progress.get("completed", {}) if isinstance(progress.get("completed"), dict) else {}
    configurations = (
        ("bank_transactions.xlsx", "Bank", bank_service.HEADERS, "bank"),
        ("share_transactions.xlsx", "Share", share_service.HEADERS, "share"),
        ("personal_finance_bank_flow.xlsx", "Bank Flow", personal_finance_service.HEADERS, "personal_finance"),
        ("personal_finance_cash_flow.xlsx", "Cash Flow", personal_finance_service.HEADERS, "personal_finance"),
        ("personal_finance_transfer.xlsx", "Transfer Flow", personal_finance_service.HEADERS, "transfer"),
    )
    results = []
    for filename, sheet_name, headers, kind in configurations:
        result = migrate_sync_metadata_workbook_locked(target / filename, sheet_name, headers, kind)
        if result.get("status") == "retry":
            raise RuntimeError(f"Workbook changed during metadata upgrade; retry scheduled for {filename}.")
        results.append(result)
        completed[filename] = {
            "status": result.get("status"),
            "row_count": result.get("row_count"),
            "checked_at": time.time(),
        }
        progress = {"version": 1, "completed": completed, "last_file": filename}
        _write_progress(progress_path, progress)
    from .shared_sync_service import synchronize_data_directories
    sync_report = synchronize_data_directories(target, shared_sync_dir)
    raw_cleanup_roots = os.getenv("FINLEDGE_CLEANUP_LEGACY_ROOTS", "[]")
    cleanup_roots = [Path(item).expanduser().resolve() for item in json.loads(raw_cleanup_roots)]
    cleanup_report = {"status": "not-requested", "removed": []}
    if cleanup_roots:
        from .data_directory_service import cleanup_migrated_root_sources

        migration_report_path = target / ".finledge-data-migration.json"
        migration_report = json.loads(migration_report_path.read_text(encoding="utf-8"))
        cleanup_report = cleanup_migrated_root_sources(
            target,
            cleanup_roots,
            migration_report,
            shared_sync_dir=shared_sync_dir,
        )
    record_migration_state(target)
    progress["sharedSync"] = sync_report
    progress["legacyCleanup"] = cleanup_report
    progress["completedAt"] = time.time()
    _write_progress(progress_path, progress)
    return {"status": "migrated" if any(item.get("status") == "migrated" for item in results) else "not-needed", "results": results, "sharedSync": sync_report, "legacyCleanup": cleanup_report}


def start_metadata_backfill_worker(data_dir: Path | None = None) -> bool:
    """Start a quiet daemon worker; API and user operations remain available."""
    global _worker_started
    with _worker_lock:
        if _worker_started:
            return False
        _worker_started = True

    target_dir = Path(data_dir or get_data_dir()).expanduser().resolve()

    def run() -> None:
        delay_seconds = 2
        while True:
            try:
                report = backfill_metadata_once(target_dir)
                logger.info("Background metadata backfill: %s", report.get("status", "unknown"))
                return
            except Exception:
                logger.exception("Background metadata backfill will retry")
                time.sleep(delay_seconds)
                delay_seconds = min(delay_seconds * 2, 60)

    threading.Thread(target=run, name="finledge-metadata-backfill", daemon=True).start()
    return True
