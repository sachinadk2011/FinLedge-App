from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from openpyxl import Workbook
import pytest

from backend.db.core import connect_database, migrate_database
from backend.db.core import transaction
from backend.db.imports import stage_personal_finance_workbook
from backend.db.repositories import add_tombstone
from backend.services.personal_finance import import_staged_personal_finance_workbook
import backend.services.personal_finance.import_service as pf_import_service


HEADERS = [
    "Date", "Flow Type", "Direction", "Category", "Amount", "Signed Amount", "Description", "Source",
    "Created Timestamp", "Last Updated Timestamp", "Source Ref", "Updated Device", "Row ID", "Content Hash",
]


def _write(path: Path, rows: list[list[object]], *, flow: str = "bank") -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Bank Flow" if flow == "bank" else "Cash Flow"
    sheet.append(HEADERS)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def _row(row_id: str | None, *, flow="bank", direction="expense", category="Food", amount=12.34, signed=-12.34):
    return [
        "2026-10-23", flow, direction, category, amount, signed, "lunch", "manual",
        "2026-10-23T09:30:00Z", "2026-10-23T09:30:00Z", None, "desktop-dev", row_id, None,
    ]


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def test_personal_finance_import_is_snapshot_gated_atomic_and_idempotent(tmp_path: Path):
    path = tmp_path / "personal_finance_bank_flow.xlsx"
    first_id, second_id = str(uuid4()), str(uuid4())
    _write(path, [
        _row(first_id),
        _row(second_id, direction="income", category="Salary", amount=100, signed=100),
    ])
    plan = stage_personal_finance_workbook(path, flow_type="bank")
    connection = _database(tmp_path / "pf-import.db")
    snapshots = []

    def snapshot():
        assert not connection.in_transaction
        snapshots.append("ok")

    try:
        result = import_staged_personal_finance_workbook(connection, plan, before_import_snapshot=snapshot)
        assert (result.imported_count, result.already_present_count) == (2, 0)
        rows = list(connection.execute("SELECT * FROM personal_finance_entries ORDER BY sequence_no"))
        assert [row["row_id"] for row in rows] == [first_id, second_id]
        assert [row["sequence_no"] for row in rows] == [1, 2]
        assert [row["signed_amount_scaled"] for row in rows] == [-123_400, 1_000_000]
        assert rows[0]["created_timestamp"] == plan.records[0].created_timestamp
        assert rows[0]["content_hash"] == plan.records[0].content_hash

        retry = import_staged_personal_finance_workbook(connection, plan, before_import_snapshot=snapshot)
        assert (retry.imported_count, retry.already_present_count) == (0, 2)
        assert connection.execute("SELECT COUNT(*) FROM personal_finance_entries").fetchone()[0] == 2
        assert snapshots == ["ok", "ok"]
    finally:
        connection.close()


def test_personal_finance_flow_workbooks_append_without_sequence_collisions(tmp_path: Path):
    bank_path = tmp_path / "personal_finance_bank_flow.xlsx"
    cash_path = tmp_path / "personal_finance_cash_flow.xlsx"
    _write(bank_path, [_row(str(uuid4())), _row(str(uuid4()), amount=20, signed=-20)])
    _write(cash_path, [_row(str(uuid4()), flow="cash", direction="income", category="Salary", amount=50, signed=50)], flow="cash")
    connection = _database(tmp_path / "pf-flows.db")
    try:
        import_staged_personal_finance_workbook(
            connection,
            stage_personal_finance_workbook(bank_path, flow_type="bank"),
            before_import_snapshot=lambda: None,
        )
        import_staged_personal_finance_workbook(
            connection,
            stage_personal_finance_workbook(cash_path, flow_type="cash"),
            before_import_snapshot=lambda: None,
        )
        rows = list(connection.execute("SELECT flow_type, sequence_no FROM personal_finance_entries ORDER BY sequence_no"))
        assert [(row["flow_type"], row["sequence_no"]) for row in rows] == [
            ("bank", 1), ("bank", 2), ("cash", 3),
        ]
    finally:
        connection.close()


def test_personal_finance_import_resolves_and_imports_legacy_identity_map(tmp_path: Path):
    path = tmp_path / "personal_finance_bank_flow.xlsx"
    _write(path, [_row(None)])
    plan = stage_personal_finance_workbook(path, flow_type="bank")
    row_id = str(uuid4())
    map_path = tmp_path / "row-identity-map.json"
    map_path.write_text(json.dumps({plan.records[0].identity_key: row_id}), encoding="utf-8")
    connection = _database(tmp_path / "pf-legacy-id.db")
    try:
        report = import_staged_personal_finance_workbook(
            connection,
            plan,
            before_import_snapshot=lambda: None,
            legacy_identity_map_path=map_path,
        )
        assert report.imported_identity_count == 1
        row = connection.execute("SELECT row_id FROM personal_finance_entries").fetchone()
        assert row["row_id"] == row_id

        retry = import_staged_personal_finance_workbook(
            connection,
            plan,
            before_import_snapshot=lambda: None,
            legacy_identity_map_path=map_path,
        )
        assert retry.existing_identity_count == 1
        assert retry.already_present_count == 1
    finally:
        connection.close()


def test_personal_finance_import_rolls_back_rows_and_identity_map_on_failure(tmp_path: Path, monkeypatch):
    path = tmp_path / "two-rows.xlsx"
    _write(path, [[_row(None)[index] for index in range(len(HEADERS))] for _ in range(2)])
    plan = stage_personal_finance_workbook(path, flow_type="bank")
    map_path = tmp_path / "row-identity-map.json"
    map_path.write_text("{}", encoding="utf-8")
    connection = _database(tmp_path / "pf-rollback.db")
    original = pf_import_service.PersonalFinanceRepository.import_existing
    calls = 0

    def fail_second(repository, values):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("simulated row insert failure")
        return original(repository, values)

    monkeypatch.setattr(pf_import_service.PersonalFinanceRepository, "import_existing", fail_second)
    try:
        with pytest.raises(RuntimeError, match="simulated row insert failure"):
            import_staged_personal_finance_workbook(
                connection,
                plan,
                before_import_snapshot=lambda: None,
                legacy_identity_map_path=map_path,
            )
        assert connection.execute("SELECT COUNT(*) FROM personal_finance_entries").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM legacy_identity_map").fetchone()[0] == 0
    finally:
        connection.close()


def test_personal_finance_import_rejects_changed_rows_and_newer_tombstones(tmp_path: Path):
    row_id = str(uuid4())
    original_path = tmp_path / "original.xlsx"
    changed_path = tmp_path / "changed.xlsx"
    _write(original_path, [_row(row_id, amount=12.34)])
    _write(changed_path, [_row(row_id, amount=15)])
    connection = _database(tmp_path / "pf-conflict.db")
    try:
        import_staged_personal_finance_workbook(
            connection,
            stage_personal_finance_workbook(original_path, flow_type="bank"),
            before_import_snapshot=lambda: None,
        )
        with pytest.raises(ValueError, match="different business content"):
            import_staged_personal_finance_workbook(
                connection,
                stage_personal_finance_workbook(changed_path, flow_type="bank"),
                before_import_snapshot=lambda: None,
            )
        assert connection.execute("SELECT amount_scaled FROM personal_finance_entries").fetchone()[0] == 123_400

        tombstoned_id = str(uuid4())
        with transaction(connection):
            add_tombstone(
                connection,
                row_id=tombstoned_id,
                entity_type="personal_finance",
                deleted_by_device="desktop-test",
                deleted_timestamp="2026-10-24T00:00:00.000000Z",
            )
        tombstone_path = tmp_path / "tombstone.xlsx"
        _write(tombstone_path, [_row(tombstoned_id)])
        with pytest.raises(ValueError, match="newer deletion record"):
            import_staged_personal_finance_workbook(
                connection,
                stage_personal_finance_workbook(tombstone_path, flow_type="bank"),
                before_import_snapshot=lambda: None,
            )
        assert connection.execute("SELECT COUNT(*) FROM personal_finance_entries").fetchone()[0] == 1
    finally:
        connection.close()


def test_personal_finance_import_blocks_review_issues_before_snapshot(tmp_path: Path):
    path = tmp_path / "unsupported.xlsx"
    _write(path, [_row(str(uuid4()), category="Unknown")])
    plan = stage_personal_finance_workbook(path, flow_type="bank")
    connection = _database(tmp_path / "pf-review-block.db")
    snapshots = []
    try:
        with pytest.raises(ValueError, match="Resolve all Personal Finance import review issues"):
            import_staged_personal_finance_workbook(
                connection,
                plan,
                before_import_snapshot=lambda: snapshots.append(True),
            )
        assert snapshots == []
        assert connection.execute("SELECT COUNT(*) FROM personal_finance_entries").fetchone()[0] == 0
    finally:
        connection.close()
