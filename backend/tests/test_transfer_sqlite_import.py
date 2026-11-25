from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

from openpyxl import Workbook
import pytest

from backend.db.core import connect_database, migrate_database
from backend.db.imports.transfer import import_staged_transfer_workbook, stage_transfer_workbook
from backend.services.personal_finance import SQLitePersonalFinanceService


HEADERS = [
    "Date", "Flow Type", "Direction", "Category", "Amount", "Signed Amount", "Description",
    "Source", "Created Timestamp", "Last Updated Timestamp", "Source Ref", "Updated Device", "Row ID", "Content Hash",
]


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def _workbook(path: Path, rows: list[list[object]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Transfer Flow"
    sheet.append(HEADERS)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def _row(day, direction, amount, source_ref=None, row_id=None, created=None):
    return [day, direction, "transfer", "Transfer", amount, -amount, "transfer test", "transfer",
            created, created, source_ref, "desktop-test", row_id, None]


def _import(connection, plan, snapshots):
    return import_staged_transfer_workbook(
        connection, plan, device="desktop-test", before_import_snapshot=lambda: snapshots.append("snapshot")
    )


def test_transfer_import_is_atomic_idempotent_and_projects_both_flow_sides(tmp_path: Path):
    path = tmp_path / "personal_finance_transfer.xlsx"
    _workbook(path, [_row("2025-01-02", "bank_to_cash", 600)])
    plan = stage_transfer_workbook(path)
    connection = _database(tmp_path / "transfer-import.db")
    snapshots = []
    try:
        finance = SQLitePersonalFinanceService(connection, device="desktop-test")
        finance.add(entry_date=date(2025, 1, 1), flow_type="bank", direction="income", category="Salary", amount=Decimal("1000"))
        report = _import(connection, plan, snapshots)
        assert report.imported_count == 1
        assert connection.execute("SELECT COUNT(*) FROM transfers").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM personal_finance_entries").fetchone()[0] == 1
        summary = finance.summarize()
        assert summary["bank"]["total_income"] == Decimal("400")
        assert summary["cash"]["total_income"] == Decimal("600")

        retry = _import(connection, plan, snapshots)
        assert retry.imported_count == 0
        assert retry.already_present_count == 1
        assert snapshots == ["snapshot", "snapshot"]
    finally:
        connection.close()


def test_transfer_import_overdraw_rolls_back_transfer_and_identity_mapping(tmp_path: Path):
    path = tmp_path / "personal_finance_transfer.xlsx"
    _workbook(path, [_row("2025-01-02", "bank_to_cash", 101)])
    connection = _database(tmp_path / "transfer-overdraw.db")
    try:
        finance = SQLitePersonalFinanceService(connection, device="desktop-test")
        finance.add(entry_date=date(2025, 1, 1), flow_type="bank", direction="income", category="Salary", amount=Decimal("100"))
        with pytest.raises(ValueError, match="overdraw Bank.*NPR 100.00"):
            _import(connection, stage_transfer_workbook(path), [])
        assert connection.execute("SELECT COUNT(*) FROM transfers").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM legacy_identity_map").fetchone()[0] == 0
    finally:
        connection.close()


def test_transfer_import_replays_date_order_and_requires_snapshot(tmp_path: Path):
    path = tmp_path / "personal_finance_transfer.xlsx"
    _workbook(path, [_row("2025-01-01", "bank_to_cash", 50)])
    connection = _database(tmp_path / "transfer-order.db")
    try:
        finance = SQLitePersonalFinanceService(connection, device="desktop-test")
        finance.add(entry_date=date(2025, 1, 2), flow_type="bank", direction="income", category="Salary", amount=Decimal("100"))
        with pytest.raises(ValueError, match="overdraw Bank.*NPR 0.00"):
            _import(connection, stage_transfer_workbook(path), [])
        assert connection.execute("SELECT COUNT(*) FROM transfers").fetchone()[0] == 0

        later_path = tmp_path / "later.xlsx"
        _workbook(later_path, [_row("2025-01-03", "bank_to_cash", 50)])
        def fail_snapshot():
            raise OSError("snapshot failed")
        with pytest.raises(OSError, match="snapshot failed"):
            import_staged_transfer_workbook(
                connection, stage_transfer_workbook(later_path), device="desktop-test",
                before_import_snapshot=fail_snapshot,
            )
        assert connection.execute("SELECT COUNT(*) FROM transfers").fetchone()[0] == 0
    finally:
        connection.close()
