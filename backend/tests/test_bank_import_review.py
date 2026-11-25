from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
import pytest

from backend.db.core import connect_database, migrate_database
from backend.db.core import transaction
from backend.db.imports import stage_bank_workbook
from backend.db.repositories import BankRepository, add_tombstone
import backend.services.common.import_conflicts as import_conflict_helpers
from backend.services.bank import (
    classify_bank_import,
    import_staged_bank_workbook,
    resolve_bank_import_conflict,
)


def _write(path: Path, rows: list[list[object]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Bank"
    sheet.append(["Date", "Category", "Amount", "Description", "Created Timestamp", "Updated Device", "Row ID"])
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def _record(row_id: str, *, amount: int = 100, description: str = "Rent", category: str = "Interest Earned"):
    return ["2026-11-01", category, amount, description, "2026-11-01T10:00:00Z", "desktop-dev", row_id]


def test_bank_merge_classifies_add_already_present_conflict_and_possible_duplicate(tmp_path: Path):
    connection = _database(tmp_path / "review.db")
    seed_path = tmp_path / "seed.xlsx"
    _write(seed_path, [_record("11111111-1111-4111-8111-111111111111")])
    seed_plan = stage_bank_workbook(seed_path)
    import_staged_bank_workbook(connection, seed_plan, before_import_snapshot=lambda: None)

    add_path = tmp_path / "add.xlsx"
    _write(add_path, [_record("22222222-2222-4222-8222-222222222222", amount=250, description="New note")])
    already_path = tmp_path / "already.xlsx"
    _write(already_path, [_record("11111111-1111-4111-8111-111111111111")])
    conflict_path = tmp_path / "conflict.xlsx"
    _write(conflict_path, [_record("11111111-1111-4111-8111-111111111111", amount=120)])
    duplicate_path = tmp_path / "duplicate.xlsx"
    _write(duplicate_path, [_record("33333333-3333-4333-8333-333333333333")])

    before = connection.execute("SELECT COUNT(*) FROM bank_transactions").fetchone()[0]
    classifications = [
        classify_bank_import(connection, stage_bank_workbook(path)).rows[0]
        for path in (add_path, already_path, conflict_path, duplicate_path)
    ]

    assert [row.classification for row in classifications] == [
        "add", "already_present", "conflict", "possible_duplicate"
    ]
    assert classifications[1].existing_record["row_id"] == "11111111-1111-4111-8111-111111111111"
    assert classifications[2].existing_record["amount_scaled"] == 1_000_000
    assert classifications[3].possible_duplicates[0]["row_id"] == "11111111-1111-4111-8111-111111111111"
    assert connection.execute("SELECT COUNT(*) FROM bank_transactions").fetchone()[0] == before
    assert connection.execute("SELECT COUNT(*) FROM record_conflicts").fetchone()[0] == 0
    connection.close()


def test_bank_merge_uses_existing_legacy_identity_mapping_for_uuid_classification(tmp_path: Path):
    connection = _database(tmp_path / "legacy-review.db")
    source_path = tmp_path / "legacy.xlsx"
    _write(source_path, [["2026-11-01", "Interest Earned", 80, "legacy row", "2026-11-01T10:00:00Z", "legacy", None]])
    plan = stage_bank_workbook(source_path)
    import_staged_bank_workbook(connection, plan, before_import_snapshot=lambda: None)

    classified = classify_bank_import(connection, plan).rows[0]

    assert classified.classification == "already_present"
    assert classified.resolved_row_id == connection.execute(
        "SELECT row_id FROM legacy_identity_map WHERE identity_key = ?", (plan.records[0].identity_key,)
    ).fetchone()[0]
    connection.close()


def test_bank_merge_blocks_resurrection_after_a_newer_tombstone(tmp_path: Path):
    connection = _database(tmp_path / "tombstone-review.db")
    row_id = "44444444-4444-4444-8444-444444444444"
    with transaction(connection):
        add_tombstone(
            connection,
            row_id=row_id,
            entity_type="bank",
            deleted_by_device="desktop-test",
            deleted_timestamp="2026-11-02T00:00:00.000000Z",
        )
    source_path = tmp_path / "resurrection.xlsx"
    _write(source_path, [_record(row_id)])

    classified = classify_bank_import(connection, stage_bank_workbook(source_path)).rows[0]

    assert classified.classification == "conflict"
    assert "newer deletion" in classified.review_message
    assert connection.execute("SELECT COUNT(*) FROM bank_transactions").fetchone()[0] == 0
    with pytest.raises(ValueError, match="deletion conflicts"):
        resolve_bank_import_conflict(
            connection,
            classified,
            decision="keep_incoming",
            device="desktop-test",
            before_import_snapshot=lambda: None,
        )
    connection.close()


def test_bank_conflict_keep_local_records_incoming_loser_and_resolution(tmp_path: Path):
    connection = _database(tmp_path / "keep-local.db")
    row_id = "55555555-5555-4555-8555-555555555555"
    seed_path = tmp_path / "seed-local.xlsx"
    incoming_path = tmp_path / "incoming-local.xlsx"
    _write(seed_path, [_record(row_id, amount=100)])
    _write(incoming_path, [_record(row_id, amount=120)])
    import_staged_bank_workbook(connection, stage_bank_workbook(seed_path), before_import_snapshot=lambda: None)
    review = classify_bank_import(connection, stage_bank_workbook(incoming_path)).rows[0]
    snapshot_observations = []

    report = resolve_bank_import_conflict(
        connection,
        review,
        decision="keep_local",
        device="desktop-test",
        before_import_snapshot=lambda: snapshot_observations.append(connection.in_transaction),
    )

    saved = connection.execute("SELECT amount_scaled FROM bank_transactions WHERE row_id=?", (row_id,)).fetchone()
    conflict = connection.execute("SELECT * FROM record_conflicts WHERE conflict_id=?", (report.conflict_id,)).fetchone()
    assert snapshot_observations == [False]
    assert saved["amount_scaled"] == 1_000_000
    assert report.resolution == "kept_local" and report.row_updated is False
    assert conflict["resolution"] == "kept_local" and conflict["resolved_timestamp"]
    assert '"amount_scaled":1200000' in conflict["losing_values_json"]
    connection.close()


def test_bank_conflict_keep_incoming_updates_row_and_archives_local_version(tmp_path: Path):
    connection = _database(tmp_path / "keep-incoming.db")
    row_id = "66666666-6666-4666-8666-666666666666"
    seed_path = tmp_path / "seed-incoming.xlsx"
    incoming_path = tmp_path / "incoming.xlsx"
    _write(seed_path, [_record(row_id, amount=100)])
    _write(incoming_path, [_record(row_id, amount=120)])
    import_staged_bank_workbook(connection, stage_bank_workbook(seed_path), before_import_snapshot=lambda: None)
    before = dict(connection.execute("SELECT * FROM bank_transactions WHERE row_id=?", (row_id,)).fetchone())
    review = classify_bank_import(connection, stage_bank_workbook(incoming_path)).rows[0]

    report = resolve_bank_import_conflict(
        connection,
        review,
        decision="keep_incoming",
        device="desktop-test",
        before_import_snapshot=lambda: None,
    )

    after = dict(connection.execute("SELECT * FROM bank_transactions WHERE row_id=?", (row_id,)).fetchone())
    conflict = connection.execute("SELECT * FROM record_conflicts WHERE conflict_id=?", (report.conflict_id,)).fetchone()
    assert after["amount_scaled"] == 1_200_000
    assert after["sequence_no"] == before["sequence_no"]
    assert after["created_timestamp"] == before["created_timestamp"]
    assert after["updated_device"] == "desktop-test"
    assert after["last_updated_timestamp"] != before["last_updated_timestamp"]
    assert report.resolution == "kept_incoming" and report.row_updated is True
    assert conflict["resolution"] == "kept_incoming" and conflict["resolved_timestamp"]
    assert '"amount_scaled":1000000' in conflict["losing_values_json"]
    connection.close()


def test_bank_conflict_resolution_rejects_stale_review_without_writing(tmp_path: Path):
    connection = _database(tmp_path / "stale-review.db")
    row_id = "77777777-7777-4777-8777-777777777777"
    seed_path = tmp_path / "seed-stale.xlsx"
    incoming_path = tmp_path / "incoming-stale.xlsx"
    _write(seed_path, [_record(row_id, amount=100)])
    _write(incoming_path, [_record(row_id, amount=120)])
    import_staged_bank_workbook(connection, stage_bank_workbook(seed_path), before_import_snapshot=lambda: None)
    review = classify_bank_import(connection, stage_bank_workbook(incoming_path)).rows[0]
    with transaction(connection):
        BankRepository(connection).update(
            row_id,
            {"amount_scaled": 1_100_000},
            device="desktop-test",
        )

    with pytest.raises(ValueError, match="changed after review"):
        resolve_bank_import_conflict(
            connection,
            review,
            decision="keep_incoming",
            device="desktop-test",
            before_import_snapshot=lambda: None,
        )
    assert connection.execute("SELECT COUNT(*) FROM record_conflicts").fetchone()[0] == 0
    assert connection.execute("SELECT amount_scaled FROM bank_transactions WHERE row_id=?", (row_id,)).fetchone()[0] == 1_100_000
    connection.close()


def test_bank_conflict_resolution_rolls_back_row_and_audit_together(tmp_path: Path, monkeypatch):
    connection = _database(tmp_path / "rollback-review.db")
    row_id = "88888888-8888-4888-8888-888888888888"
    seed_path = tmp_path / "seed-rollback.xlsx"
    incoming_path = tmp_path / "incoming-rollback.xlsx"
    _write(seed_path, [_record(row_id, amount=100)])
    _write(incoming_path, [_record(row_id, amount=120)])
    import_staged_bank_workbook(connection, stage_bank_workbook(seed_path), before_import_snapshot=lambda: None)
    review = classify_bank_import(connection, stage_bank_workbook(incoming_path)).rows[0]

    def fail_resolve(*_args, **_kwargs):
        raise RuntimeError("simulated resolution write failure")

    monkeypatch.setattr(import_conflict_helpers, "resolve_conflict", fail_resolve)
    with pytest.raises(RuntimeError, match="simulated resolution"):
        resolve_bank_import_conflict(
            connection,
            review,
            decision="keep_incoming",
            device="desktop-test",
            before_import_snapshot=lambda: None,
        )

    assert connection.execute("SELECT amount_scaled FROM bank_transactions WHERE row_id=?", (row_id,)).fetchone()[0] == 1_000_000
    assert connection.execute("SELECT COUNT(*) FROM record_conflicts").fetchone()[0] == 0
    connection.close()


def test_bank_merge_retains_invalid_and_unsupported_rows_for_review(tmp_path: Path):
    connection = _database(tmp_path / "invalid-review.db")
    source_path = tmp_path / "issues.xlsx"
    _write(
        source_path,
        [
            ["2026-11-01", "Unknown Charge", -4, "unknown", "2026-11-01T10:00:00Z", "legacy", None],
            ["bad-date", "Interest Earned", 4, "invalid", "2026-11-01T10:00:00Z", "legacy", None],
        ],
    )

    review = classify_bank_import(connection, stage_bank_workbook(source_path))

    assert review.counts_by_classification["unsupported"] == 1
    assert review.counts_by_classification["invalid"] == 1
    assert connection.execute("SELECT COUNT(*) FROM bank_transactions").fetchone()[0] == 0
    connection.close()
