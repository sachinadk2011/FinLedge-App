from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

from openpyxl import Workbook
import pytest

from backend.db.core import connect_database, migrate_database
from backend.db.imports.transfer import import_staged_transfer_workbook, stage_transfer_workbook
from backend.services.personal_finance import (
    SQLitePersonalFinanceService,
    classify_transfer_import,
    resolve_transfer_import_conflict,
)


HEADERS = [
    "Date", "Flow Type", "Direction", "Category", "Amount", "Signed Amount", "Description",
    "Source", "Created Timestamp", "Last Updated Timestamp", "Source Ref", "Updated Device", "Row ID", "Content Hash",
]
ROW_ID = "70000000-0000-0000-0000-000000000001"
TRANSFER_REF = "transfer:2025-01-02:fixed001"


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def _write(path: Path, amount: int) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Transfer Flow"
    sheet.append(HEADERS)
    sheet.append([
        "2025-01-02", "bank_to_cash", "transfer", "Transfer", amount, -amount, "test transfer",
        "transfer", "2025-01-02T00:00:00Z", "2025-01-02T00:00:00Z", TRANSFER_REF,
        "desktop-test", ROW_ID, None,
    ])
    workbook.save(path)
    workbook.close()


def _import(connection, plan):
    return import_staged_transfer_workbook(
        connection, plan, device="desktop-test", before_import_snapshot=lambda: None
    )


def test_transfer_review_is_read_only_and_detects_changed_content_conflict(tmp_path: Path):
    path = tmp_path / "transfer.xlsx"
    _write(path, 50)
    connection = _database(tmp_path / "transfer-review.db")
    try:
        finance = SQLitePersonalFinanceService(connection, device="desktop-test")
        finance.add(entry_date=date(2025, 1, 1), flow_type="bank", direction="income", category="Salary", amount=Decimal("100"))
        _import(connection, stage_transfer_workbook(path))

        _write(path, 75)
        plan = stage_transfer_workbook(path)
        before = connection.execute("SELECT COUNT(*) FROM record_conflicts").fetchone()[0]
        review = classify_transfer_import(connection, plan)

        assert review.counts_by_classification["conflict"] == 1
        assert review.rows[0].resolved_row_id == ROW_ID
        assert connection.execute("SELECT COUNT(*) FROM record_conflicts").fetchone()[0] == before
    finally:
        connection.close()


@pytest.mark.parametrize("decision, expected_amount, expected_resolution", [
    ("keep_local", 500_000, "kept_local"),
    ("keep_incoming", 750_000, "kept_incoming"),
])
def test_transfer_conflict_decision_archives_loser_atomically(
    tmp_path: Path, decision: str, expected_amount: int, expected_resolution: str,
):
    path = tmp_path / f"{decision}.xlsx"
    _write(path, 50)
    connection = _database(tmp_path / f"{decision}.db")
    try:
        finance = SQLitePersonalFinanceService(connection, device="desktop-test")
        finance.add(entry_date=date(2025, 1, 1), flow_type="bank", direction="income", category="Salary", amount=Decimal("100"))
        _import(connection, stage_transfer_workbook(path))
        _write(path, 75)
        review = classify_transfer_import(connection, stage_transfer_workbook(path)).rows[0]

        report = resolve_transfer_import_conflict(
            connection, review, decision=decision, device="desktop-test", before_import_snapshot=lambda: None
        )

        assert report.resolution == expected_resolution
        assert report.row_updated is (decision == "keep_incoming")
        row = connection.execute("SELECT amount_scaled FROM transfers WHERE row_id=?", (ROW_ID,)).fetchone()
        assert row["amount_scaled"] == expected_amount
        conflict = connection.execute("SELECT resolution FROM record_conflicts WHERE conflict_id=?", (report.conflict_id,)).fetchone()
        assert conflict["resolution"] == expected_resolution
    finally:
        connection.close()


def test_incoming_transfer_conflict_that_overdraws_rolls_back_update_and_audit(tmp_path: Path):
    path = tmp_path / "transfer-overdraw-conflict.xlsx"
    _write(path, 50)
    connection = _database(tmp_path / "transfer-overdraw-conflict.db")
    try:
        finance = SQLitePersonalFinanceService(connection, device="desktop-test")
        finance.add(entry_date=date(2025, 1, 1), flow_type="bank", direction="income", category="Salary", amount=Decimal("100"))
        _import(connection, stage_transfer_workbook(path))
        _write(path, 101)
        review = classify_transfer_import(connection, stage_transfer_workbook(path)).rows[0]
        with pytest.raises(ValueError, match="overdraw Bank.*NPR 100.00"):
            resolve_transfer_import_conflict(
                connection, review, decision="keep_incoming", device="desktop-test",
                before_import_snapshot=lambda: None,
            )
        row = connection.execute("SELECT amount_scaled FROM transfers WHERE row_id=?", (ROW_ID,)).fetchone()
        assert row["amount_scaled"] == 500_000
        assert connection.execute("SELECT COUNT(*) FROM record_conflicts").fetchone()[0] == 0
    finally:
        connection.close()
