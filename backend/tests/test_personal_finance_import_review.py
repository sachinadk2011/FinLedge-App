from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
import pytest

from backend.db.core import connect_database, migrate_database, transaction
from backend.db.imports import stage_personal_finance_workbook
from backend.db.repositories import PersonalFinanceRepository, add_tombstone
from backend.services.personal_finance import (
    classify_personal_finance_import,
    import_staged_personal_finance_workbook,
    resolve_personal_finance_import_conflict,
)
import backend.services.common.import_conflicts as import_conflict_helpers


HEADERS = [
    "Date", "Flow Type", "Direction", "Category", "Amount", "Signed Amount", "Description", "Source",
    "Created Timestamp", "Last Updated Timestamp", "Source Ref", "Updated Device", "Row ID", "Content Hash",
]


def _write(path: Path, rows: list[list[object]], *, flow="bank") -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Bank Flow" if flow == "bank" else "Cash Flow"
    sheet.append(HEADERS)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def _row(row_id: str, *, amount=12.34, description="lunch", flow="bank", direction="expense", category="Food"):
    signed = amount if direction == "income" else -amount
    return [
        "2026-10-23", flow, direction, category, amount, signed, description, "manual",
        "2026-10-23T09:30:00Z", "2026-10-23T09:30:00Z", None, "desktop-dev", row_id, None,
    ]


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def _seed(connection, tmp_path: Path, row_id: str, *, amount=12.34, description="lunch"):
    path = tmp_path / f"seed-{row_id[:4]}.xlsx"
    _write(path, [_row(row_id, amount=amount, description=description)])
    plan = stage_personal_finance_workbook(path, flow_type="bank")
    import_staged_personal_finance_workbook(connection, plan, before_import_snapshot=lambda: None)
    return plan


def test_personal_finance_merge_classifies_all_row_states_without_writing(tmp_path: Path):
    connection = _database(tmp_path / "pf-review.db")
    existing_id = "11111111-1111-4111-8111-111111111111"
    duplicate_id = "22222222-2222-4222-8222-222222222222"
    conflict_id = "33333333-3333-4333-8333-333333333333"
    _seed(connection, tmp_path, existing_id)
    _seed(connection, tmp_path, conflict_id, amount=20)

    source = tmp_path / "review.xlsx"
    _write(source, [
        _row(existing_id),
        _row(conflict_id, amount=25),
        _row(duplicate_id),
        _row("44444444-4444-4444-8444-444444444444", amount=30, description="new"),
    ])
    before = connection.execute("SELECT COUNT(*) FROM personal_finance_entries").fetchone()[0]

    review = classify_personal_finance_import(
        connection,
        stage_personal_finance_workbook(source, flow_type="bank"),
    )

    assert [row.classification for row in review.rows] == [
        "already_present", "conflict", "possible_duplicate", "add",
    ]
    assert review.rows[2].possible_duplicates[0]["row_id"] == existing_id
    assert connection.execute("SELECT COUNT(*) FROM personal_finance_entries").fetchone()[0] == before
    assert connection.execute("SELECT COUNT(*) FROM record_conflicts").fetchone()[0] == 0
    connection.close()


def test_personal_finance_merge_uses_existing_legacy_identity_mapping(tmp_path: Path):
    connection = _database(tmp_path / "pf-legacy-review.db")
    path = tmp_path / "legacy.xlsx"
    _write(path, [_row(None)])
    plan = stage_personal_finance_workbook(path, flow_type="bank")
    import_staged_personal_finance_workbook(connection, plan, before_import_snapshot=lambda: None)

    review = classify_personal_finance_import(connection, plan).rows[0]

    assert review.classification == "already_present"
    assert review.resolved_row_id == connection.execute(
        "SELECT row_id FROM legacy_identity_map WHERE identity_key=?", (plan.records[0].identity_key,)
    ).fetchone()[0]
    connection.close()


def test_personal_finance_merge_blocks_newer_tombstone_and_cross_entity_ids(tmp_path: Path):
    connection = _database(tmp_path / "pf-tombstones.db")
    tombstoned_id = "55555555-5555-4555-8555-555555555555"
    with transaction(connection):
        add_tombstone(
            connection,
            row_id=tombstoned_id,
            entity_type="personal_finance",
            deleted_by_device="desktop-test",
            deleted_timestamp="2026-10-24T00:00:00.000000Z",
        )
    source = tmp_path / "tombstone-review.xlsx"
    _write(source, [_row(tombstoned_id)])
    plan = stage_personal_finance_workbook(source, flow_type="bank")

    tombstone_review = classify_personal_finance_import(connection, plan).rows[0]
    assert tombstone_review.classification == "conflict"
    assert "newer deletion" in tombstone_review.review_message
    with pytest.raises(ValueError, match="Deletion conflicts"):
        resolve_personal_finance_import_conflict(
            connection,
            tombstone_review,
            decision="keep_incoming",
            device="desktop-test",
            before_import_snapshot=lambda: None,
        )

    bank_id = "66666666-6666-4666-8666-666666666666"
    bank_path = tmp_path / "bank-owner.xlsx"
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Bank"
    sheet.append(["Date", "Category", "Amount", "Description", "Created Timestamp", "Updated Device", "Row ID"])
    sheet.append(["2026-10-23", "Interest Earned", 5, "bank", "2026-10-23T09:30:00Z", "desktop-dev", bank_id])
    workbook.save(bank_path)
    workbook.close()
    from backend.db.imports import stage_bank_workbook
    from backend.db.repositories import BankRepository

    bank_plan = stage_bank_workbook(bank_path)
    from backend.services.bank import import_staged_bank_workbook

    import_staged_bank_workbook(connection, bank_plan, before_import_snapshot=lambda: None)
    cross_path = tmp_path / "cross-entity.xlsx"
    _write(cross_path, [_row(bank_id)])
    cross_review = classify_personal_finance_import(
        connection,
        stage_personal_finance_workbook(cross_path, flow_type="bank"),
    ).rows[0]
    assert cross_review.classification == "invalid"
    assert "bank entity" in cross_review.review_message
    assert BankRepository(connection).get(bank_id) is not None
    connection.close()


def test_personal_finance_conflict_decisions_archive_loser_and_update_signed_amount(tmp_path: Path):
    connection = _database(tmp_path / "pf-resolve.db")
    row_id = "77777777-7777-4777-8777-777777777777"
    seed = _seed(connection, tmp_path, row_id, amount=10)
    before = dict(connection.execute("SELECT * FROM personal_finance_entries WHERE row_id=?", (row_id,)).fetchone())
    incoming_path = tmp_path / "incoming-pf.xlsx"
    _write(incoming_path, [_row(row_id, amount=18, direction="income", category="Salary")])
    incoming_plan = stage_personal_finance_workbook(incoming_path, flow_type="bank")
    review = classify_personal_finance_import(connection, incoming_plan).rows[0]
    snapshot_calls = []

    report = resolve_personal_finance_import_conflict(
        connection,
        review,
        decision="keep_incoming",
        device="desktop-test",
        before_import_snapshot=lambda: snapshot_calls.append(connection.in_transaction),
    )

    after = dict(connection.execute("SELECT * FROM personal_finance_entries WHERE row_id=?", (row_id,)).fetchone())
    audit = connection.execute("SELECT * FROM record_conflicts WHERE conflict_id=?", (report.conflict_id,)).fetchone()
    assert snapshot_calls == [False]
    assert after["amount_scaled"] == 180_000
    assert after["signed_amount_scaled"] == 180_000
    assert after["sequence_no"] == before["sequence_no"]
    assert after["created_timestamp"] == before["created_timestamp"]
    assert after["updated_device"] == "desktop-test"
    assert report.resolution == "kept_incoming" and report.row_updated
    assert audit["resolution"] == "kept_incoming" and audit["resolved_timestamp"]
    assert '"amount_scaled":100000' in audit["losing_values_json"]
    assert seed.records[0].row_id == row_id
    connection.close()


def test_personal_finance_conflict_keep_local_stale_review_and_atomic_rollback(tmp_path: Path, monkeypatch):
    connection = _database(tmp_path / "pf-keep-local.db")
    row_id = "88888888-8888-4888-8888-888888888888"
    _seed(connection, tmp_path, row_id, amount=10)
    incoming_path = tmp_path / "incoming-local.xlsx"
    _write(incoming_path, [_row(row_id, amount=14)])
    review = classify_personal_finance_import(
        connection,
        stage_personal_finance_workbook(incoming_path, flow_type="bank"),
    ).rows[0]
    before = dict(connection.execute("SELECT * FROM personal_finance_entries WHERE row_id=?", (row_id,)).fetchone())
    report = resolve_personal_finance_import_conflict(
        connection,
        review,
        decision="keep_local",
        device="desktop-test",
        before_import_snapshot=lambda: None,
    )
    after = dict(connection.execute("SELECT * FROM personal_finance_entries WHERE row_id=?", (row_id,)).fetchone())
    assert after == before
    assert report.resolution == "kept_local" and not report.row_updated

    _seed(connection, tmp_path, "99999999-9999-4999-8999-999999999999", amount=20)
    stale_path = tmp_path / "stale-incoming.xlsx"
    stale_id = "99999999-9999-4999-8999-999999999999"
    _write(stale_path, [_row(stale_id, amount=25)])
    stale_review = classify_personal_finance_import(
        connection,
        stage_personal_finance_workbook(stale_path, flow_type="bank"),
    ).rows[0]
    with transaction(connection):
        repository = PersonalFinanceRepository(connection)
        repository.update(
            stale_id,
            {"amount_scaled": 210_000},
            device="desktop-test",
        )
    with pytest.raises(ValueError, match="changed after review"):
        resolve_personal_finance_import_conflict(
            connection,
            stale_review,
            decision="keep_incoming",
            device="desktop-test",
            before_import_snapshot=lambda: None,
        )

    rollback_path = tmp_path / "rollback-incoming.xlsx"
    rollback_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    _seed(connection, tmp_path, rollback_id, amount=8)
    _write(rollback_path, [_row(rollback_id, amount=9)])
    rollback_review = classify_personal_finance_import(
        connection,
        stage_personal_finance_workbook(rollback_path, flow_type="bank"),
    ).rows[0]
    original_resolve = import_conflict_helpers.resolve_conflict

    def fail_audit(*_args, **_kwargs):
        raise RuntimeError("simulated conflict audit failure")

    monkeypatch.setattr(import_conflict_helpers, "resolve_conflict", fail_audit)
    with pytest.raises(RuntimeError, match="audit failure"):
        resolve_personal_finance_import_conflict(
            connection,
            rollback_review,
            decision="keep_incoming",
            device="desktop-test",
            before_import_snapshot=lambda: None,
        )
    rollback_row = connection.execute("SELECT amount_scaled FROM personal_finance_entries WHERE row_id=?", (rollback_id,)).fetchone()
    assert rollback_row["amount_scaled"] == 80_000
    assert connection.execute("SELECT COUNT(*) FROM record_conflicts WHERE row_id=?", (rollback_id,)).fetchone()[0] == 0
    monkeypatch.setattr(import_conflict_helpers, "resolve_conflict", original_resolve)
    connection.close()
