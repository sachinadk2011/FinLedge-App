"""Bank Replace preserves unselected data and tombstones removed rows."""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from uuid import uuid4

from openpyxl import Workbook
import pytest

from backend.db.core import connect_database, migrate_database, transaction
from backend.db.imports import stage_bank_workbook
from backend.db.repositories import TransferRepository
from backend.services.bank import import_staged_bank_workbook, replace_staged_bank_workbook


def _workbook(path: Path, rows: list[list[object]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Bank"
    sheet.append(["Date", "Category", "Amount", "Description", "Created Timestamp", "Row ID"])
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def test_bank_replace_replaces_selected_set_and_preserves_other_entities(tmp_path: Path, monkeypatch):
    old_id, kept_id, other_id = (str(uuid4()) for _ in range(3))
    initial_path = tmp_path / "initial.xlsx"
    _workbook(initial_path, [
        ["2026-11-01", "Interest Earned", 100, "remove me", "2026-11-01T10:00:00Z", old_id],
        ["2026-11-02", "Interest Earned", 20, "keep identity", "2026-11-02T10:00:00Z", kept_id],
    ])
    replacement_path = tmp_path / "replacement.xlsx"
    _workbook(replacement_path, [
        ["2026-11-03", "Interest Earned", 25, "updated same identity", "2026-11-02T10:00:00Z", kept_id],
        ["2026-11-04", "Interest Earned", 30, "new row", "2026-11-04T10:00:00Z", other_id],
    ])
    connection = _database(tmp_path / "replace.db")
    backup_root = tmp_path / "backups"
    monkeypatch.setenv("FINLEDGE_BACKUP_DIR", str(backup_root))
    try:
        import_staged_bank_workbook(
            connection,
            stage_bank_workbook(initial_path),
            before_import_snapshot=lambda: None,
        )
        with transaction(connection):
            TransferRepository(connection).create(
                {
                    "txn_date": "2026-11-02",
                    "direction": "bank_to_cash",
                    "amount_scaled": 1_000,
                    "transfer_ref": "preserve-transfer",
                },
                device="desktop-test",
            )

        report = replace_staged_bank_workbook(
            connection,
            stage_bank_workbook(replacement_path),
            device="desktop-test",
        )

        assert report.imported_count == 2
        assert report.removed_count == 1
        assert Path(report.snapshot_path).is_file()
        assert [row[0] for row in connection.execute(
            "SELECT row_id FROM bank_transactions ORDER BY sequence_no"
        )] == [kept_id, other_id]
        assert connection.execute(
            "SELECT amount_scaled FROM bank_transactions WHERE row_id=?", (kept_id,)
        ).fetchone()[0] == 250_000
        tombstone = connection.execute("SELECT entity_type FROM deleted_records WHERE row_id=?", (old_id,)).fetchone()
        assert tombstone[0] == "bank"
        assert connection.execute("SELECT count(*) FROM deleted_records WHERE row_id=?", (kept_id,)).fetchone()[0] == 0
        assert connection.execute("SELECT count(*) FROM transfers WHERE transfer_ref='preserve-transfer'").fetchone()[0] == 1
    finally:
        connection.close()


def test_bank_replace_rolls_back_all_rows_and_tombstones_when_insert_fails(tmp_path: Path):
    old_id, incoming_id = str(uuid4()), str(uuid4())
    initial_path = tmp_path / "initial.xlsx"
    _workbook(initial_path, [["2026-11-01", "Interest Earned", 100, "local", "2026-11-01T10:00:00Z", old_id]])
    source_path = tmp_path / "replacement.xlsx"
    _workbook(source_path, [["2026-11-02", "Interest Earned", 20, "incoming", "2026-11-02T10:00:00Z", incoming_id]])
    connection = _database(tmp_path / "replace-rollback.db")
    try:
        import_staged_bank_workbook(
            connection,
            stage_bank_workbook(initial_path),
            before_import_snapshot=lambda: None,
        )
        plan = stage_bank_workbook(source_path)
        invalid_record = replace(plan.records[0], category="Unsupported category")
        invalid_plan = replace(plan, records=(invalid_record,))

        with pytest.raises(ValueError, match="Unsupported Bank Services category"):
            replace_staged_bank_workbook(
                connection,
                invalid_plan,
                device="desktop-test",
                before_replace_snapshot=lambda: None,
            )

        assert [row[0] for row in connection.execute("SELECT row_id FROM bank_transactions")] == [old_id]
        assert connection.execute("SELECT count(*) FROM deleted_records").fetchone()[0] == 0
    finally:
        connection.close()


def test_bank_replace_snapshot_failure_leaves_existing_records_untouched(tmp_path: Path):
    old_id = str(uuid4())
    initial_path = tmp_path / "initial.xlsx"
    _workbook(initial_path, [["2026-11-01", "Interest Earned", 100, "local", "2026-11-01T10:00:00Z", old_id]])
    replacement_path = tmp_path / "replacement.xlsx"
    _workbook(replacement_path, [])
    connection = _database(tmp_path / "replace-snapshot-failure.db")
    try:
        import_staged_bank_workbook(
            connection,
            stage_bank_workbook(initial_path),
            before_import_snapshot=lambda: None,
        )

        def fail_snapshot():
            raise OSError("snapshot unavailable")

        with pytest.raises(OSError, match="snapshot unavailable"):
            replace_staged_bank_workbook(
                connection,
                stage_bank_workbook(replacement_path),
                device="desktop-test",
                before_replace_snapshot=fail_snapshot,
            )

        assert [row[0] for row in connection.execute("SELECT row_id FROM bank_transactions")] == [old_id]
        assert connection.execute("SELECT count(*) FROM deleted_records").fetchone()[0] == 0
    finally:
        connection.close()
