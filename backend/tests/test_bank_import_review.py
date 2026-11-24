from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook

from backend.db.core import connect_database, migrate_database
from backend.db.imports import stage_bank_workbook
from backend.db.repositories import add_tombstone
from backend.db.core import transaction
from backend.services.bank import classify_bank_import, import_staged_bank_workbook


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
