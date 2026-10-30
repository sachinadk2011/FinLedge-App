"""Cross-client workbook synchronization through the channel's shared folder."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import threading
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

from .excel_utils import snapshot_before_write
from .workbook_merge import get_device_label, merge_workbook_files

logger = logging.getLogger(__name__)
_worker_lock = threading.Lock()
_worker_started = False
_SHARED_LOCK_NAME = ".sync-operation.lock"
_SUCCESSFUL_DIRECTION_STATUSES = {"copied", "merged", "unchanged"}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _workbook_configs():
    from . import bank_service, personal_finance_service, share_service

    return (
        ("bank_transactions.xlsx", "Bank", bank_service.HEADERS, "bank", bank_service._file_lock),
        ("share_transactions.xlsx", "Share", share_service.HEADERS, "share", share_service._file_lock),
        ("personal_finance_bank_flow.xlsx", "Bank Flow", personal_finance_service.HEADERS, "personal_finance", personal_finance_service._file_lock),
        ("personal_finance_cash_flow.xlsx", "Cash Flow", personal_finance_service.HEADERS, "personal_finance", personal_finance_service._file_lock),
        ("personal_finance_transfer.xlsx", "Transfer Flow", personal_finance_service.HEADERS, "transfer", personal_finance_service._file_lock),
    )


def _fingerprint(path: Path) -> tuple[int, int, str] | None:
    try:
        stat = path.stat()
        digest = _sha256(path)
        return stat.st_size, stat.st_mtime_ns, digest
    except FileNotFoundError:
        return None


def _stat_fingerprint(path: Path) -> list[int] | None:
    try:
        stat = path.stat()
        return [stat.st_size, stat.st_mtime_ns]
    except FileNotFoundError:
        return None


def _process_is_alive(pid: int) -> bool:
    """Check lock-owner liveness without sending signals on Windows."""
    if pid <= 0:
        return False
    if os.name == "nt":
        import ctypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        open_process = kernel32.OpenProcess
        open_process.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
        open_process.restype = ctypes.c_void_p
        close_handle = kernel32.CloseHandle
        close_handle.argtypes = [ctypes.c_void_p]
        close_handle.restype = ctypes.c_int
        handle = open_process(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if handle:
            close_handle(handle)
            return True
        # Access denied means the process exists but cannot be inspected.
        return ctypes.get_last_error() == 5
    try:
        os.kill(pid, 0)
    except PermissionError:
        return True
    except (OSError, ValueError):
        return False
    return True


def _write_json_atomic(path: Path, value: dict) -> None:
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        temporary.write_text(json.dumps(value, sort_keys=True, separators=(",", ":")), encoding="utf-8")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _copy_snapshot(source: Path, destination: Path, lock) -> tuple[int, int, str] | None:
    with lock:
        before = _fingerprint(source)
        if before is None:
            return None
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        if _fingerprint(source) != before or _fingerprint(destination)[2] != before[2]:
            destination.unlink(missing_ok=True)
            return None
        return before


@contextmanager
def _shared_sync_lock(sync_dir: Path):
    lock_path = sync_dir / _SHARED_LOCK_NAME
    descriptor = None
    try:
        descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        # Recover only a lock whose owner is gone and whose timestamp is stale.
        try:
            current = json.loads(lock_path.read_text(encoding="utf-8"))
            age = time.time() - float(current.get("created", 0))
            pid = int(current.get("pid", 0))
            owner_alive = _process_is_alive(pid)
            if age > 120 and not owner_alive:
                lock_path.unlink(missing_ok=True)
                descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            try:
                if time.time() - lock_path.stat().st_mtime > 120:
                    lock_path.unlink(missing_ok=True)
                    descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            except OSError:
                descriptor = None
    if descriptor is None:
        yield False
        return
    try:
        os.write(descriptor, json.dumps({"pid": os.getpid(), "created": time.time()}).encode("utf-8"))
        os.close(descriptor)
        descriptor = None
        yield True
    finally:
        if descriptor is not None:
            os.close(descriptor)
        lock_path.unlink(missing_ok=True)


def _append_journal(sync_dir: Path, payload: dict) -> None:
    journal = sync_dir / "sync-journal.jsonl"
    event_payload = {key: value for key, value in payload.items() if key != "createdAt"}
    event_id = hashlib.sha256(json.dumps(event_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    try:
        last_lines = journal.read_text(encoding="utf-8").splitlines()[-50:]
        if any(json.loads(line).get("event_id") == event_id for line in last_lines):
            return
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    entry = {"event_id": event_id, **payload}
    with journal.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(entry, sort_keys=True, separators=(",", ":")) + "\n")
        stream.flush()
        os.fsync(stream.fileno())


def _merge_direction(
    *,
    target: Path,
    incoming: Path,
    target_snapshot: Path,
    incoming_snapshot: Path,
    lock,
    sync_dir: Path,
    filename: str,
    sheet_name: str,
    headers: list[str],
    kind: str,
    direction: str,
) -> dict:
    target_before = _copy_snapshot(target, target_snapshot, lock)
    incoming_lock = next((config[4] for config in _workbook_configs() if config[0] == filename), lock)
    incoming_before = _copy_snapshot(incoming, incoming_snapshot, incoming_lock)
    if incoming_before is None:
        return {"status": "source_missing"}

    if target_before is None:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(incoming_snapshot, target_snapshot)
        if _fingerprint(incoming) != incoming_before:
            target_snapshot.unlink(missing_ok=True)
            return {"status": "retry"}
        with lock:
            if target.exists() or _fingerprint(incoming) != incoming_before:
                target_snapshot.unlink(missing_ok=True)
                return {"status": "retry"}
            os.replace(target_snapshot, target)
        target_after = _fingerprint(target)
        if target_after is None or target_after[2] != incoming_before[2]:
            return {"status": "retry"}
        _append_journal(sync_dir, {
            "file": filename,
            "direction": direction,
            "device": get_device_label(),
            "added": 0,
            "updated": 0,
            "conflicts": 0,
            "createdAt": time.time(),
            "sourceFingerprint": incoming_before[2],
            "destinationFingerprint": _fingerprint(target)[2],
        })
        return {
            "status": "copied", "added": 0, "updated": 0, "conflicts": 0,
            "_sourceFingerprint": incoming_before, "_targetBeforeFingerprint": None,
            "_targetFingerprint": target_after,
        }

    if not target_snapshot.is_file():
        return {"status": "retry"}
    result = merge_workbook_files(
        incoming_snapshot,
        target_snapshot,
        sheet_name=sheet_name,
        headers=headers,
        kind=kind,
        identity_scope=f"{filename.casefold()}#{sheet_name.casefold()}",
    )
    if not result["changed"]:
        if _fingerprint(target) != target_before or _fingerprint(incoming) != incoming_before:
            return {"status": "retry"}
        return {
            "status": "unchanged", **result["report"],
            "_sourceFingerprint": incoming_before, "_targetBeforeFingerprint": target_before,
            "_targetFingerprint": target_before,
        }
    with lock:
        if _fingerprint(target) != target_before or _fingerprint(incoming) != incoming_before:
            return {"status": "retry"}
        snapshot_before_write(target)
        os.replace(target_snapshot, target)
    target_after = _fingerprint(target)
    if target_after is None:
        return {"status": "retry"}
    report = result["report"]
    _append_journal(sync_dir, {
        "file": filename,
        "direction": direction,
        "device": get_device_label(),
        "added": report["added"],
        "updated": report["updated"],
        "conflicts": report["conflicts"],
        "deleted": report["deleted"],
        "createdAt": time.time(),
        "sourceFingerprint": incoming_before[2],
        "destinationFingerprint": _fingerprint(target)[2],
    })
    return {
        "status": "merged", **report,
        "_sourceFingerprint": incoming_before, "_targetBeforeFingerprint": target_before,
        "_targetFingerprint": target_after,
    }


def synchronize_data_directories(data_dir: Path | None = None, shared_sync_dir: Path | None = None) -> dict:
    """Merge both clients into the shared copy, then distribute its latest rows."""
    local_dir = Path(data_dir or os.getenv("FINLEDGE_DATA_DIR") or "").expanduser().resolve()
    sync_dir = Path(shared_sync_dir or os.getenv("FINLEDGE_SHARED_SYNC_DIR") or local_dir.parent / "FinLedge Data Shared").expanduser().resolve()
    sync_dir.mkdir(parents=True, exist_ok=True)
    reports = []
    with _shared_sync_lock(sync_dir) as acquired:
        if not acquired:
            return {"status": "busy", "files": []}
        client_key = hashlib.sha256(str(local_dir).casefold().encode("utf-8")).hexdigest()[:16]
        state_path = sync_dir / f".sync-state-{client_key}.json"
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
            if not isinstance(state, dict):
                state = {}
        except (OSError, ValueError):
            state = {}
        for index, (filename, sheet_name, headers, kind, lock) in enumerate(_workbook_configs()):
            local = local_dir / filename
            shared = sync_dir / filename
            if not local.is_file():
                reports.append({"file": filename, "status": "local_missing"})
                continue
            current_local = _stat_fingerprint(local)
            local_start_fingerprint = _fingerprint(local)
            current_shared = _stat_fingerprint(shared)
            previous = state.get(filename) or {}
            if current_local == previous.get("local") and current_shared == previous.get("shared"):
                reports.append({"file": filename, "status": "unchanged"})
                continue
            temporary_root = sync_dir / ".staging"
            temporary_root.mkdir(parents=True, exist_ok=True)
            local_snapshot = temporary_root / f"{os.getpid()}-{index}-local.xlsx"
            shared_snapshot = temporary_root / f"{os.getpid()}-{index}-shared.xlsx"
            local_target_stage = temporary_root / f"{os.getpid()}-{index}-local-target.xlsx"
            shared_target_stage = temporary_root / f"{os.getpid()}-{index}-shared-target.xlsx"
            try:
                to_shared = _merge_direction(
                    target=shared,
                    incoming=local,
                    target_snapshot=shared_target_stage,
                    incoming_snapshot=local_snapshot,
                    lock=lock,
                    sync_dir=sync_dir,
                    filename=filename,
                    sheet_name=sheet_name,
                    headers=headers,
                    kind=kind,
                    direction="local_to_shared",
                )
                from_shared = _merge_direction(
                    target=local,
                    incoming=shared,
                    target_snapshot=local_target_stage,
                    incoming_snapshot=shared_snapshot,
                    lock=lock,
                    sync_dir=sync_dir,
                    filename=filename,
                    sheet_name=sheet_name,
                    headers=headers,
                    kind=kind,
                    direction="shared_to_local",
                )
                directions_succeeded = (
                    to_shared.get("status") in _SUCCESSFUL_DIRECTION_STATUSES
                    and from_shared.get("status") in _SUCCESSFUL_DIRECTION_STATUSES
                )
                with lock:
                    checkpoint_is_current = directions_succeeded and (
                        to_shared.get("_sourceFingerprint") == local_start_fingerprint
                        and from_shared.get("_targetBeforeFingerprint") == to_shared.get("_sourceFingerprint")
                        and _fingerprint(shared) == to_shared.get("_targetFingerprint")
                        and _fingerprint(local) == from_shared.get("_targetFingerprint")
                        and from_shared.get("_sourceFingerprint") == to_shared.get("_targetFingerprint")
                    )
                    if checkpoint_is_current:
                        state[filename] = {"local": _stat_fingerprint(local), "shared": _stat_fingerprint(shared)}
                        _write_json_atomic(state_path, state)
                file_status = "complete" if checkpoint_is_current else "retry"
                public_to_shared = {key: value for key, value in to_shared.items() if not key.startswith("_")}
                public_from_shared = {key: value for key, value in from_shared.items() if not key.startswith("_")}
                reports.append({
                    "file": filename,
                    "status": file_status,
                    "to_shared": public_to_shared,
                    "from_shared": public_from_shared,
                })
            finally:
                local_snapshot.unlink(missing_ok=True)
                shared_snapshot.unlink(missing_ok=True)
                local_target_stage.unlink(missing_ok=True)
                shared_target_stage.unlink(missing_ok=True)
        try:
            (sync_dir / ".staging").rmdir()
        except OSError:
            pass
    overall_status = "complete" if all(report.get("status") in {"complete", "unchanged"} for report in reports) else "partial"
    return {"status": overall_status, "files": reports}


def start_shared_sync_worker(data_dir: Path | None = None, shared_sync_dir: Path | None = None) -> bool:
    """Start periodic background synchronization after the API is ready."""
    global _worker_started
    with _worker_lock:
        if _worker_started:
            return False
        _worker_started = True
    target = Path(data_dir or os.getenv("FINLEDGE_DATA_DIR") or "").expanduser().resolve()
    shared = Path(shared_sync_dir or os.getenv("FINLEDGE_SHARED_SYNC_DIR") or target.parent / "FinLedge Data Shared").expanduser().resolve()

    def run() -> None:
        while True:
            try:
                synchronize_data_directories(target, shared)
            except Exception:
                logger.exception("Background workbook synchronization will retry")
            time.sleep(1)

    threading.Thread(target=run, name="finledge-shared-sync", daemon=True).start()
    return True
