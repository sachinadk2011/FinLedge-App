import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from openpyxl import Workbook, load_workbook

from backend.services import excel_utils


def _make_workbook(path, value="original"):
    workbook = Workbook()
    workbook.active.append(["Value"])
    workbook.active.append([value])
    workbook.save(path)
    workbook.close()


def test_snapshot_before_write_copies_live_workbook(tmp_path):
    live_file = tmp_path / "bank_transactions.xlsx"
    _make_workbook(live_file)

    snapshot = excel_utils.snapshot_before_write(live_file)

    assert snapshot is not None
    assert snapshot.parent == tmp_path / "backups" / "auto" / "bank_transactions"
    assert snapshot.exists()
    copied = load_workbook(snapshot, data_only=True)
    assert copied.active.cell(2, 1).value == "original"
    copied.close()


def test_auto_backup_recovery_returns_user_warning(tmp_path):
    live_file = tmp_path / "cash_transactions.xlsx"
    backup_dir = tmp_path / "backups" / "auto" / live_file.stem
    backup_dir.mkdir(parents=True)
    backup_file = backup_dir / "20261022T000000.000000Z.xlsx"
    _make_workbook(backup_file, "recovered")
    live_file.write_bytes(b"not an xlsx workbook")

    recovered = excel_utils.safe_load_workbook(live_file, "Cash", ["Value"])
    assert recovered.active.cell(2, 1).value == "recovered"
    recovered.close()
    warnings = excel_utils.consume_recovery_warnings()
    assert any("recovered from a backup" in warning for warning in warnings)


def test_bank_add_update_delete_each_snapshot_prior_state(tmp_path, monkeypatch):
    from backend.services import bank_service

    live_file = tmp_path / "bank_transactions.xlsx"
    workbook = Workbook()
    workbook.active.title = bank_service.SHEET_NAME
    workbook.active.append(bank_service.HEADERS)
    workbook.save(live_file)
    workbook.close()
    monkeypatch.setattr(bank_service, "FILE_PATH", live_file)
    monkeypatch.setattr(bank_service, "DATA_DIR", tmp_path)
    backup_dir = tmp_path / "backups" / "auto" / live_file.stem

    bank_service.append_bank_record(None, "Interest Earned", 10.0, "Add test")
    first_snapshot = next(backup_dir.glob("*.xlsx"))
    first = load_workbook(first_snapshot, data_only=True)
    assert first.active.max_row == 1
    first.close()

    bank_service.update_bank_record(1, None, "Interest Earned", 12.0, "Update test")
    snapshots = sorted(backup_dir.glob("*.xlsx"), key=lambda path: path.stat().st_mtime)
    assert len(snapshots) == 2
    before_update = load_workbook(snapshots[1], data_only=True)
    assert before_update.active.cell(2, 3).value == 10.0
    before_update.close()

    bank_service.delete_bank_record(1)
    snapshots = sorted(backup_dir.glob("*.xlsx"), key=lambda path: path.stat().st_mtime)
    assert len(snapshots) == 3
    before_delete = load_workbook(snapshots[2], data_only=True)
    assert before_delete.active.cell(2, 3).value == 12.0
    before_delete.close()


def test_snapshot_retention_keeps_recent_daily_monthly_and_removes_old(tmp_path):
    snapshot_dir = tmp_path / "backups" / "auto" / "share_transactions"
    snapshot_dir.mkdir(parents=True)
    now = datetime.now(timezone.utc)

    def add_snapshot(name, age):
        path = snapshot_dir / name
        path.write_bytes(b"snapshot")
        timestamp = (now - age).timestamp()
        os.utime(path, (timestamp, timestamp))
        return path

    recent_one = add_snapshot("recent-one.xlsx", timedelta(hours=2))
    recent_two = add_snapshot("recent-two.xlsx", timedelta(hours=6))
    same_day = (now - timedelta(days=3)).replace(hour=12, minute=0, second=0, microsecond=0)
    daily_one = add_snapshot("daily-one.xlsx", now - same_day)
    daily_older_same_day = add_snapshot("daily-older.xlsx", now - (same_day - timedelta(hours=2)))
    monthly_one = add_snapshot("monthly-one.xlsx", timedelta(days=60))
    old = add_snapshot("old.xlsx", timedelta(days=400))

    excel_utils._prune_auto_snapshots(snapshot_dir, now)

    assert recent_one.exists() and recent_two.exists()
    assert daily_one.exists()
    assert not daily_older_same_day.exists()
    assert monthly_one.exists()
    assert not old.exists()


def test_snapshot_failure_aborts_bank_write(tmp_path, monkeypatch):
    from backend.services import bank_service

    live_file = tmp_path / "bank_transactions.xlsx"
    headers = bank_service.HEADERS
    workbook = Workbook()
    workbook.active.title = bank_service.SHEET_NAME
    workbook.active.append(headers)
    workbook.save(live_file)
    workbook.close()
    monkeypatch.setattr(bank_service, "FILE_PATH", live_file)
    monkeypatch.setattr(bank_service, "DATA_DIR", tmp_path)

    def fail_snapshot(_path):
        raise excel_utils.SnapshotError("Snapshot failed; write aborted.")

    monkeypatch.setattr(bank_service, "snapshot_before_write", fail_snapshot)

    try:
        bank_service.append_bank_record(None, "Interest Earned", 10.0)
    except excel_utils.SnapshotError as exc:
        assert "write aborted" in str(exc)
    else:
        raise AssertionError("Expected snapshot failure to abort the workbook write")

    saved = load_workbook(live_file, data_only=True)
    assert saved.active.max_row == 1
    saved.close()


def test_concurrent_bank_writes_keep_valid_snapshots(tmp_path, monkeypatch):
    from backend.services import bank_service

    live_file = tmp_path / "bank_transactions.xlsx"
    workbook = Workbook()
    workbook.active.title = bank_service.SHEET_NAME
    workbook.active.append(bank_service.HEADERS)
    workbook.save(live_file)
    workbook.close()
    monkeypatch.setattr(bank_service, "FILE_PATH", live_file)
    monkeypatch.setattr(bank_service, "DATA_DIR", tmp_path)

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [
            executor.submit(bank_service.append_bank_record, None, "Interest Earned", i + 1.0, f"Concurrent {i}")
            for i in range(8)
        ]
        for future in futures:
            future.result()

    backup_dir = tmp_path / "backups" / "auto" / live_file.stem
    snapshots = list(backup_dir.glob("*.xlsx"))
    assert len(snapshots) == 8
    for snapshot in snapshots:
        saved = load_workbook(snapshot, data_only=True)
        assert saved.active.max_row >= 1
        saved.close()
