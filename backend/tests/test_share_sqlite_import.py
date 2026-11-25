from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
import pytest

from backend.db.core import connect_database, migrate_database
from backend.db.imports.share import import_staged_share_workbook, stage_share_workbook


HEADERS = [
    "Date", "Share Name", "Category", "Per Unit Price", "Charge", "Allotted", "Buy/Sell",
    "SIP Units", "Created Timestamp", "Last Updated Timestamp", "Updated Device", "Row ID", "Content Hash",
]


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def _workbook(path: Path, rows: list[list[object]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Share"
    sheet.append(HEADERS)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def _row(day, name, category, price, charge, quantity, side, units=None):
    return [day, name, category, price, charge, quantity, side, units, None, None, "legacy", None, None]


def test_share_import_commits_all_events_rebuilds_summaries_and_retries_idempotently(tmp_path: Path):
    path = tmp_path / "share_transactions.xlsx"
    _workbook(path, [
        _row("2025-01-01", "CMF2", "ipo", 10, None, 10, "ipo"),
        _row("2025-01-02", "CMF2", "sell", 12, 1, 2, "sell"),
        _row("2025-01-03", "Index Fund", "sip", 1000, 0, 0, "installment", 10),
        _row("2025-02-01", "Index Fund", "sip", 1100, 0, 0, "redeem"),
    ])
    plan = stage_share_workbook(path)
    connection = _database(tmp_path / "share-import.db")
    snapshots = []
    try:
        first = import_staged_share_workbook(
            connection, plan, device="desktop-test", before_import_snapshot=lambda: snapshots.append("snapshot")
        )
        assert first.imported_count == 4
        assert first.already_present_count == 0
        assert first.imported_identity_count == 0
        assert len(first.imported_missing_rows) == 0
        assert connection.execute("SELECT COUNT(*) FROM legacy_identity_map").fetchone()[0] == 4
        assert connection.execute("SELECT COUNT(*) FROM share_transactions").fetchone()[0] == 2
        assert connection.execute("SELECT COUNT(*) FROM dividend_events").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM sip_transactions").fetchone()[0] == 2
        holding = connection.execute("SELECT quantity, total_cost_scaled FROM share_holdings").fetchone()
        assert tuple(holding) == (8, 840_000)
        sip = connection.execute("SELECT plan_status, outstanding_principal_scaled FROM sip_plan_summaries").fetchone()
        assert tuple(sip) == ("closed", 0)

        retry = import_staged_share_workbook(
            connection, plan, device="desktop-test", before_import_snapshot=lambda: snapshots.append("snapshot")
        )
        assert retry.imported_count == 0
        assert retry.already_present_count == 4
        assert len(snapshots) == 2
    finally:
        connection.close()


def test_share_import_replay_failure_rolls_back_events_summaries_and_identity_map(tmp_path: Path):
    path = tmp_path / "share_transactions.xlsx"
    _workbook(path, [
        _row("2025-01-01", "CMF2", "buy", 10, 0, 2, "buy"),
        _row("2025-01-02", "CMF2", "sell", 10, 0, 3, "sell"),
    ])
    plan = stage_share_workbook(path)
    connection = _database(tmp_path / "share-import-rollback.db")
    try:
        with pytest.raises(ValueError, match="Not enough available quantity"):
            import_staged_share_workbook(
                connection, plan, device="desktop-test", before_import_snapshot=lambda: None
            )
        assert connection.execute("SELECT COUNT(*) FROM shares").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM share_transactions").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM legacy_identity_map").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM share_holdings").fetchone()[0] == 0
    finally:
        connection.close()


def test_share_import_requires_snapshot_before_any_write(tmp_path: Path):
    path = tmp_path / "share_transactions.xlsx"
    _workbook(path, [_row("2025-01-01", "CMF2", "buy", 10, 0, 1, "buy")])
    plan = stage_share_workbook(path)
    connection = _database(tmp_path / "share-import-snapshot.db")
    try:
        def fail_snapshot():
            raise OSError("snapshot failed")

        with pytest.raises(OSError, match="snapshot failed"):
            import_staged_share_workbook(connection, plan, device="desktop-test", before_import_snapshot=fail_snapshot)
        assert connection.execute("SELECT COUNT(*) FROM share_transactions").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM shares").fetchone()[0] == 0
    finally:
        connection.close()
