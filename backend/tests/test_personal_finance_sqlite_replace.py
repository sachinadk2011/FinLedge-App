"""Selected-flow Replace preserves the other flow and transfer constraints."""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from openpyxl import Workbook
import pytest

from backend.db.core import connect_database, migrate_database, transaction
from backend.db.imports import stage_personal_finance_workbook
from backend.db.repositories import TransferRepository
from backend.services.personal_finance import (
    import_staged_personal_finance_workbook,
    replace_staged_personal_finance_workbook,
)


HEADERS = [
    "Date", "Flow Type", "Direction", "Category", "Amount", "Signed Amount", "Description",
    "Source", "Created Timestamp", "Last Updated Timestamp", "Source Ref", "Updated Device",
    "Row ID", "Content Hash",
]


def _row(row_id: str, *, flow: str, direction: str, category: str, amount: int, day: str):
    signed = amount if direction == "income" else -amount
    timestamp = f"{day}T09:00:00Z"
    return [
        day, flow, direction, category, amount, signed, "reviewed record", "manual",
        timestamp, timestamp, None, "desktop-dev", row_id, None,
    ]


def _workbook(path: Path, rows: list[list[object]], *, flow: str) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Bank Flow" if flow == "bank" else "Cash Flow"
    sheet.append(HEADERS)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def _seed(connection, path: Path, *, flow: str):
    return import_staged_personal_finance_workbook(
        connection,
        stage_personal_finance_workbook(path, flow_type=flow),
        before_import_snapshot=lambda: None,
    )


def _add_transfer(connection, amount_scaled: int) -> None:
    with transaction(connection):
        TransferRepository(connection).create(
            {
                "txn_date": "2026-11-03",
                "direction": "bank_to_cash",
                "amount_scaled": amount_scaled,
                "transfer_ref": f"replace-test:{uuid4()}",
            },
            device="desktop-test",
        )


def test_personal_finance_replace_is_scoped_and_replays_transfers(tmp_path: Path, monkeypatch):
    removed_id, kept_id, cash_id, new_id = (str(uuid4()) for _ in range(4))
    bank_path = tmp_path / "bank.xlsx"
    _workbook(bank_path, [
        _row(removed_id, flow="bank", direction="income", category="Salary", amount=100, day="2026-11-01"),
        _row(kept_id, flow="bank", direction="expense", category="Food", amount=10, day="2026-11-02"),
    ], flow="bank")
    cash_path = tmp_path / "cash.xlsx"
    _workbook(cash_path, [
        _row(cash_id, flow="cash", direction="expense", category="Food", amount=12, day="2026-11-02"),
    ], flow="cash")
    replacement_path = tmp_path / "bank-replacement.xlsx"
    _workbook(replacement_path, [
        _row(kept_id, flow="bank", direction="income", category="Salary", amount=80, day="2026-11-01"),
        _row(new_id, flow="bank", direction="expense", category="Food", amount=7, day="2026-11-04"),
    ], flow="bank")
    connection = _database(tmp_path / "personal-finance-replace.db")
    monkeypatch.setenv("FINLEDGE_BACKUP_DIR", str(tmp_path / "backups"))
    try:
        _seed(connection, bank_path, flow="bank")
        _seed(connection, cash_path, flow="cash")
        _add_transfer(connection, 600_000)

        report = replace_staged_personal_finance_workbook(
            connection,
            stage_personal_finance_workbook(replacement_path, flow_type="bank"),
            device="desktop-test",
        )

        assert report.flow_type == "bank"
        assert report.imported_count == 2 and report.removed_count == 1
        assert Path(report.snapshot_path).is_file()
        assert [row[0] for row in connection.execute(
            "SELECT row_id FROM personal_finance_entries WHERE flow_type='bank' ORDER BY sequence_no"
        )] == [kept_id, new_id]
        assert [row[0] for row in connection.execute(
            "SELECT row_id FROM personal_finance_entries WHERE flow_type='cash'"
        )] == [cash_id]
        assert connection.execute("SELECT count(*) FROM transfers").fetchone()[0] == 1
        assert connection.execute(
            "SELECT entity_type FROM deleted_records WHERE row_id=?", (removed_id,)
        ).fetchone()[0] == "personal_finance"
        assert connection.execute(
            "SELECT count(*) FROM deleted_records WHERE row_id=?", (kept_id,)
        ).fetchone()[0] == 0
    finally:
        connection.close()


def test_personal_finance_replace_overdraw_rolls_back_rows_and_tombstones(tmp_path: Path):
    old_id, incoming_id = str(uuid4()), str(uuid4())
    bank_path = tmp_path / "bank.xlsx"
    _workbook(bank_path, [
        _row(old_id, flow="bank", direction="income", category="Salary", amount=100, day="2026-11-01"),
    ], flow="bank")
    replacement_path = tmp_path / "replacement.xlsx"
    _workbook(replacement_path, [
        _row(incoming_id, flow="bank", direction="income", category="Salary", amount=20, day="2026-11-01"),
    ], flow="bank")
    connection = _database(tmp_path / "personal-finance-overdraw.db")
    try:
        _seed(connection, bank_path, flow="bank")
        _add_transfer(connection, 600_000)

        with pytest.raises(ValueError, match="only NPR 20.00 is available"):
            replace_staged_personal_finance_workbook(
                connection,
                stage_personal_finance_workbook(replacement_path, flow_type="bank"),
                device="desktop-test",
                before_replace_snapshot=lambda: None,
            )

        assert [row[0] for row in connection.execute(
            "SELECT row_id FROM personal_finance_entries WHERE flow_type='bank'"
        )] == [old_id]
        assert connection.execute("SELECT count(*) FROM deleted_records").fetchone()[0] == 0
    finally:
        connection.close()


def test_personal_finance_replace_cannot_reuse_uuid_from_unselected_flow(tmp_path: Path):
    bank_id, cash_id = str(uuid4()), str(uuid4())
    bank_path = tmp_path / "bank.xlsx"
    _workbook(bank_path, [
        _row(bank_id, flow="bank", direction="income", category="Salary", amount=100, day="2026-11-01"),
    ], flow="bank")
    cash_path = tmp_path / "cash.xlsx"
    _workbook(cash_path, [
        _row(cash_id, flow="cash", direction="expense", category="Food", amount=12, day="2026-11-02"),
    ], flow="cash")
    replacement_path = tmp_path / "bank-replacement.xlsx"
    _workbook(replacement_path, [
        _row(cash_id, flow="bank", direction="income", category="Salary", amount=80, day="2026-11-01"),
    ], flow="bank")
    connection = _database(tmp_path / "personal-finance-identity.db")
    try:
        _seed(connection, bank_path, flow="bank")
        _seed(connection, cash_path, flow="cash")

        with pytest.raises(ValueError, match="belongs to the other flow"):
            replace_staged_personal_finance_workbook(
                connection,
                stage_personal_finance_workbook(replacement_path, flow_type="bank"),
                device="desktop-test",
                before_replace_snapshot=lambda: None,
            )

        assert [row[0] for row in connection.execute(
            "SELECT row_id FROM personal_finance_entries WHERE flow_type='bank'"
        )] == [bank_id]
        assert [row[0] for row in connection.execute(
            "SELECT row_id FROM personal_finance_entries WHERE flow_type='cash'"
        )] == [cash_id]
        assert connection.execute("SELECT count(*) FROM deleted_records").fetchone()[0] == 0
    finally:
        connection.close()
