from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
import pytest

from backend.db.core import connect_database, migrate_database
from backend.db.imports.share import import_staged_share_workbook, stage_share_workbook
from backend.services.share import classify_share_import, resolve_share_import_conflict


HEADERS = [
    "Date", "Share Name", "Category", "Per Unit Price", "Charge", "Allotted", "Buy/Sell",
    "SIP Units", "Created Timestamp", "Last Updated Timestamp", "Updated Device", "Row ID", "Content Hash",
]
ROW_A = "60000000-0000-0000-0000-000000000001"
ROW_B = "60000000-0000-0000-0000-000000000002"


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def _write(path: Path, rows: list[tuple[str, int, int, str]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Share"
    sheet.append(HEADERS)
    for row_id, price, quantity, kind in rows:
        sheet.append([
            "2025-01-01", "CMF2", kind, price, 0, quantity, kind, None,
            "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z", "desktop-test", row_id, None,
        ])
    workbook.save(path)
    workbook.close()


def _import(connection, plan):
    return import_staged_share_workbook(
        connection, plan, device="desktop-test", before_import_snapshot=lambda: None
    )


def test_share_classifier_is_read_only_and_distinguishes_conflict_and_possible_duplicate(tmp_path: Path):
    path = tmp_path / "share.xlsx"
    _write(path, [(ROW_A, 10, 10, "buy")])
    connection = _database(tmp_path / "review.db")
    try:
        original = stage_share_workbook(path)
        _import(connection, original)

        _write(path, [(ROW_A, 11, 10, "buy")])
        changed = stage_share_workbook(path)
        before = connection.execute("SELECT COUNT(*) FROM record_conflicts").fetchone()[0]
        conflict_plan = classify_share_import(connection, changed)
        assert conflict_plan.counts_by_classification["conflict"] == 1
        assert conflict_plan.rows[0].existing_record["content_hash"]
        assert connection.execute("SELECT COUNT(*) FROM record_conflicts").fetchone()[0] == before

        _write(path, [(ROW_B, 10, 10, "buy")])
        duplicate = classify_share_import(connection, stage_share_workbook(path))
        assert duplicate.counts_by_classification["possible_duplicate"] == 1
        assert duplicate.rows[0].possible_duplicates[0]["row_id"] == ROW_A
    finally:
        connection.close()


@pytest.mark.parametrize("decision, expected_price, expected_resolution", [
    ("keep_local", 100_000, "kept_local"),
    ("keep_incoming", 110_000, "kept_incoming"),
])
def test_share_conflict_decision_archives_loser_and_rebuilds_atomically(
    tmp_path: Path, decision: str, expected_price: int, expected_resolution: str,
):
    path = tmp_path / f"share-{decision}.xlsx"
    _write(path, [(ROW_A, 10, 10, "buy")])
    connection = _database(tmp_path / f"{decision}.db")
    snapshots = []
    try:
        _import(connection, stage_share_workbook(path))
        _write(path, [(ROW_A, 11, 10, "buy")])
        review = classify_share_import(connection, stage_share_workbook(path)).rows[0]

        report = resolve_share_import_conflict(
            connection, review, decision=decision, device="desktop-test",
            before_import_snapshot=lambda: snapshots.append("snapshot"),
        )

        assert report.resolution == expected_resolution
        assert report.row_updated is (decision == "keep_incoming")
        assert snapshots == ["snapshot"]
        row = connection.execute("SELECT per_unit_price_scaled FROM share_transactions WHERE row_id=?", (ROW_A,)).fetchone()
        assert row["per_unit_price_scaled"] == expected_price
        conflict = connection.execute("SELECT resolution FROM record_conflicts WHERE conflict_id=?", (report.conflict_id,)).fetchone()
        assert conflict["resolution"] == expected_resolution
        holding = connection.execute("SELECT total_cost_scaled FROM share_holdings").fetchone()
        assert holding["total_cost_scaled"] == expected_price * 10
    finally:
        connection.close()


def test_incoming_conflict_that_would_oversell_rolls_back_row_audit_and_summary(tmp_path: Path):
    path = tmp_path / "share-oversell.xlsx"
    _write(path, [(ROW_A, 10, 10, "buy"), (ROW_B, 12, 8, "sell")])
    connection = _database(tmp_path / "oversell.db")
    try:
        _import(connection, stage_share_workbook(path))
        _write(path, [(ROW_A, 10, 2, "buy"), (ROW_B, 12, 8, "sell")])
        review = classify_share_import(connection, stage_share_workbook(path)).rows[0]
        with pytest.raises(ValueError, match="Not enough available quantity"):
            resolve_share_import_conflict(
                connection, review, decision="keep_incoming", device="desktop-test",
                before_import_snapshot=lambda: None,
            )
        bought = connection.execute("SELECT quantity FROM share_transactions WHERE row_id=?", (ROW_A,)).fetchone()
        assert bought["quantity"] == 10
        assert connection.execute("SELECT COUNT(*) FROM record_conflicts").fetchone()[0] == 0
        assert connection.execute("SELECT quantity FROM share_holdings").fetchone()[0] == 2
    finally:
        connection.close()
