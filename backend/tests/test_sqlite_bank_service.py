from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from backend.db.core import connect_database, migrate_database
from backend.services.bank import SQLiteBankService, summarize_bank_records


def _service(path: Path) -> tuple[SQLiteBankService, object]:
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return SQLiteBankService(connection, device="desktop-test"), connection


def test_sqlite_bank_service_add_update_summary_and_tombstone(tmp_path: Path):
    service, connection = _service(tmp_path / "sqlite-bank.db")
    try:
        income = service.add(
            entry_date=date(2026, 11, 1),
            category="Interest Earned",
            amount=Decimal("10.125"),
            description="  interest  ",
        )
        charge = service.add(
            entry_date=date(2026, 11, 2),
            category="Interest Tax",
            amount=Decimal("-2.005"),
        )

        assert income["amount"] == Decimal("10.13")
        assert income["description"] == "interest"
        assert charge["amount"] == Decimal("-2.01")
        assert charge["cumulative_amount"] == Decimal("8.12")
        assert service.summarize()["total_income"] == Decimal("10.13")
        assert service.summarize()["total_expenses"] == Decimal("2.01")
        workbook_summary = summarize_bank_records(service.list_records())
        sqlite_summary = service.summarize()
        assert Decimal(str(workbook_summary["total_income"])) == sqlite_summary["total_income"]
        assert Decimal(str(workbook_summary["total_expenses"])) == sqlite_summary["total_expenses"]
        assert Decimal(str(workbook_summary["net_balance"])) == sqlite_summary["net_balance"]
        assert {
            category: Decimal(str(total))
            for category, total in workbook_summary["category_totals"].items()
        } == sqlite_summary["category_totals"]

        updated = service.update(
            row_id=charge["row_id"],
            entry_date=date(2026, 11, 3),
            category="Interest Tax",
            amount=Decimal("-3.50"),
            description="revised",
        )
        assert updated["row_id"] == charge["row_id"]
        assert updated["sequence_no"] == charge["sequence_no"]
        assert updated["created_timestamp"] == charge["created_timestamp"]
        assert updated["amount"] == Decimal("-3.50")
        assert updated["cumulative_amount"] == Decimal("6.63")

        with pytest.raises(ValueError, match="must have a negative"):
            service.update(
                row_id=charge["row_id"],
                entry_date=date(2026, 11, 3),
                category="Interest Tax",
                amount=Decimal("3.50"),
            )
        assert service.list_records()[1]["amount"] == Decimal("-3.50")

        assert service.delete(row_id=income["row_id"]) == {"deleted_id": income["row_id"]}
        assert [row["row_id"] for row in service.list_records()] == [charge["row_id"]]
        tombstone = connection.execute(
            "SELECT entity_type, sequence_no FROM deleted_records WHERE row_id=?",
            (income["row_id"],),
        ).fetchone()
        assert tuple(tombstone) == ("bank", income["sequence_no"])
    finally:
        connection.close()


def test_sqlite_bank_service_rejects_float_and_missing_rows(tmp_path: Path):
    service, connection = _service(tmp_path / "sqlite-bank-errors.db")
    try:
        with pytest.raises(TypeError, match="binary float"):
            service.add(
                entry_date=date(2026, 11, 1),
                category="Interest Earned",
                amount=1.25,  # type: ignore[arg-type]
            )
        with pytest.raises(ValueError, match="not found"):
            service.delete(row_id="00000000-0000-0000-0000-000000000001")
        connection.read_only_reason = "Database uses a newer schema"
        with pytest.raises(RuntimeError, match="newer schema"):
            service.add(
                entry_date=date(2026, 11, 1),
                category="Interest Earned",
                amount=Decimal("1.25"),
            )
    finally:
        connection.close()
