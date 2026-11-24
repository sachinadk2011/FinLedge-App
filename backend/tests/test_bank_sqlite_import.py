from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

from openpyxl import Workbook
import pytest

from backend.db.core import connect_database, migrate_database, transaction
from backend.db.imports import BankImportPlan, stage_bank_workbook
from backend.db.repositories import BankRepository
from backend.services.bank import import_staged_bank_workbook


def _write_bank_workbook(path: Path, rows: list[list[object]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Bank"
    sheet.append(["Date", "Category", "Amount", "Description", "Created Timestamp"])
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def test_bank_import_resolves_legacy_ids_and_commits_map_and_rows_atomically(tmp_path: Path):
    workbook_path = tmp_path / "bank.xlsx"
    _write_bank_workbook(workbook_path, [["2026-11-01", "Interest Earned", 15, "entry", "2026-11-01T10:00:00Z"]])
    plan = stage_bank_workbook(workbook_path)
    staged = plan.records[0]
    legacy_id = str(uuid4())
    map_path = tmp_path / "row-identity-map.json"
    map_path.write_text(json.dumps({staged.identity_key: legacy_id}), encoding="utf-8")
    connection = _database(tmp_path / "bank-import.db")
    snapshots = []

    def verify_snapshot_boundary():
        assert not connection.in_transaction
        snapshots.append("verified")

    try:
        report = import_staged_bank_workbook(
            connection,
            plan,
            before_import_snapshot=verify_snapshot_boundary,
            legacy_identity_map_path=map_path,
        )
        assert (report.imported_count, report.already_present_count) == (1, 0)
        assert (report.imported_identity_count, report.existing_identity_count) == (1, 0)
        assert report.imported_missing_rows == ()
        row = connection.execute("SELECT * FROM bank_transactions").fetchone()
        assert row["row_id"] == legacy_id
        assert row["sequence_no"] == staged.sequence_no
        assert row["created_timestamp"] == staged.created_timestamp
        assert row["content_hash"] == staged.content_hash
        assert connection.execute("SELECT COUNT(*) FROM legacy_identity_map").fetchone()[0] == 1

        retry_report = import_staged_bank_workbook(
            connection,
            plan,
            before_import_snapshot=verify_snapshot_boundary,
            legacy_identity_map_path=map_path,
        )
        assert (retry_report.imported_count, retry_report.already_present_count) == (0, 1)
        assert (retry_report.imported_identity_count, retry_report.existing_identity_count) == (0, 1)
        assert snapshots == ["verified", "verified"]
    finally:
        connection.close()


def test_bank_import_rolls_back_all_identity_and_transaction_rows_on_failure(tmp_path: Path):
    workbook_path = tmp_path / "two-bank-rows.xlsx"
    _write_bank_workbook(
        workbook_path,
        [
            ["2026-11-01", "Interest Earned", 15, "first", "2026-11-01T10:00:00Z"],
            ["2026-11-02", "Interest Earned", 25, "second", "2026-11-02T10:00:00Z"],
        ],
    )
    source_plan = stage_bank_workbook(workbook_path)
    bad_plan = BankImportPlan(
        source_name=source_plan.source_name,
        records=(source_plan.records[0], replace(source_plan.records[1], sequence_no=1)),
        issues=source_plan.issues,
    )
    connection = _database(tmp_path / "bank-import-rollback.db")
    try:
        with pytest.raises(ValueError, match="sequence_no 1 is already assigned"):
            import_staged_bank_workbook(
                connection,
                bad_plan,
                before_import_snapshot=lambda: None,
            )
        assert connection.execute("SELECT COUNT(*) FROM bank_transactions").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM legacy_identity_map").fetchone()[0] == 0
    finally:
        connection.close()


def test_bank_import_rejects_unreviewed_rows_before_snapshot_or_database_write(tmp_path: Path):
    workbook_path = tmp_path / "unknown-category.xlsx"
    _write_bank_workbook(workbook_path, [["2026-11-01", "Unlisted Type", -5, "review", "2026-11-01T10:00:00Z"]])
    plan = stage_bank_workbook(workbook_path)
    connection = _database(tmp_path / "bank-import-review.db")
    snapshot_calls = []
    try:
        with pytest.raises(ValueError, match="Resolve all Bank import review issues"):
            import_staged_bank_workbook(
                connection,
                plan,
                before_import_snapshot=lambda: snapshot_calls.append(True),
            )
        assert snapshot_calls == []
        assert connection.execute("SELECT COUNT(*) FROM bank_transactions").fetchone()[0] == 0
    finally:
        connection.close()


def test_bank_import_preserves_legacy_income_without_adding_it_to_the_category_enum(tmp_path: Path):
    workbook_path = tmp_path / "legacy-income.xlsx"
    _write_bank_workbook(
        workbook_path,
        [["2026-11-01", "Income", 35, "old workbook category", "2026-11-01T10:00:00Z"]],
    )
    plan = stage_bank_workbook(workbook_path)
    connection = _database(tmp_path / "legacy-income.db")
    try:
        report = import_staged_bank_workbook(
            connection,
            plan,
            before_import_snapshot=lambda: None,
        )
        assert report.imported_count == 1
        row = connection.execute("SELECT category, amount_scaled FROM bank_transactions").fetchone()
        assert (row["category"], row["amount_scaled"]) == ("Income", 350_000)
        assert BankRepository(connection).summarize()["total_income"] == 35
    finally:
        connection.close()


def test_bank_import_requires_snapshot_callback_and_rejects_active_transaction(tmp_path: Path):
    workbook_path = tmp_path / "one-bank-row.xlsx"
    _write_bank_workbook(workbook_path, [["2026-11-01", "Interest Earned", 15, "entry", "2026-11-01T10:00:00Z"]])
    plan = stage_bank_workbook(workbook_path)
    connection = _database(tmp_path / "bank-import-preconditions.db")
    try:
        with pytest.raises(TypeError, match="snapshot callback is required"):
            import_staged_bank_workbook(connection, plan, before_import_snapshot=None)
        with transaction(connection):
            with pytest.raises(RuntimeError, match="own its transaction boundary"):
                import_staged_bank_workbook(connection, plan, before_import_snapshot=lambda: None)
        assert connection.execute("SELECT COUNT(*) FROM bank_transactions").fetchone()[0] == 0
    finally:
        connection.close()
