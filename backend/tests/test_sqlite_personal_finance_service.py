from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from backend.db.core import connect_database, migrate_database, transaction
from backend.db.repositories import TransferRepository
from backend.services.personal_finance import (
    SQLitePersonalFinanceService,
    summarize_personal_finance_records,
)


def _service(path: Path) -> tuple[SQLitePersonalFinanceService, object]:
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return SQLitePersonalFinanceService(connection, device="desktop-test"), connection


def test_sqlite_personal_finance_flow_separation_transfers_and_exact_summary(tmp_path: Path):
    service, connection = _service(tmp_path / "sqlite-pf.db")
    try:
        bank_income = service.add(
            entry_date=date(2026, 11, 1), flow_type="bank", direction="income",
            category="Salary", amount=Decimal("1000.00"), description="  monthly  ",
        )
        cash_expense = service.add(
            entry_date=date(2026, 11, 2), flow_type="cash", direction="expense",
            category="Food", amount=Decimal("100.00"),
        )
        with transaction(connection):
            TransferRepository(connection).create(
                {
                    "txn_date": "2026-11-03",
                    "direction": "bank_to_cash",
                    "amount_scaled": 2_000_000,
                    "transfer_ref": "transfer:2026-11-03:12345678",
                    "description": "cash withdrawal",
                },
                device="desktop-test",
            )
            TransferRepository(connection).create(
                {
                    "txn_date": "2026-11-04",
                    "direction": "cash_to_bank",
                    "amount_scaled": 500_000,
                    "transfer_ref": "transfer:2026-11-04:87654321",
                    "description": "bank deposit",
                },
                device="desktop-test",
            )

        bank_records = service.list_records("bank")
        cash_records = service.list_records("cash")
        combined_records = service.list_records("combined")
        bank_transfer = next(row for row in bank_records if row["source"] == "transfer" and row["transfer_direction"] == "bank_to_cash")
        cash_transfer = next(row for row in cash_records if row["source"] == "transfer" and row["transfer_direction"] == "bank_to_cash")
        assert bank_transfer["signed_amount"] == Decimal("-200")
        assert cash_transfer["signed_amount"] == Decimal("200")
        assert bank_transfer["description"] == "Withdrawn to Cash: cash withdrawal"
        assert cash_transfer["description"] == "Received from Bank: cash withdrawal"
        assert bank_transfer.get("row_id") is None
        assert bank_transfer["read_only"] is True
        assert len([row for row in combined_records if row["source"] == "transfer"]) == 2
        assert bank_income["signed_amount"] == Decimal("1000")
        assert cash_expense["signed_amount"] == Decimal("-100")
        assert bank_income["description"] == "monthly"

        summary = service.summarize()
        current_summary = summarize_personal_finance_records(
            bank_records + cash_records
        )
        for flow in ("bank", "cash"):
            for key in ("income", "expenses", "transfer_out", "transfer_in", "total_income", "total_expenses", "net"):
                assert summary[flow][key] == Decimal(str(current_summary[flow][key]))
            assert {
                category: Decimal(str(amount))
                for category, amount in current_summary[flow]["income_breakdown"].items()
            } == summary[flow]["income_breakdown"]
            assert {
                category: Decimal(str(amount))
                for category, amount in current_summary[flow]["expense_breakdown"].items()
            } == summary[flow]["expense_breakdown"]

        read_only_link = {
            "id": "sync:share:1", "row_id": "must-not-be-exposed", "flow_type": "bank",
            "direction": "income", "category": "Investment Income", "amount": Decimal("999"),
            "signed_amount": Decimal("999"), "source": "share-sync",
        }
        displayed = service.list_records("bank", read_only_records=[read_only_link])
        link_projection = next(row for row in displayed if row["source"] == "share-sync")
        assert "row_id" not in link_projection
        assert link_projection["read_only"] is True
        assert service.summarize(read_only_records=[read_only_link])["bank"]["total_income"] == Decimal("850")
        assert connection.execute("SELECT COUNT(*) FROM personal_finance_entries").fetchone()[0] == 2

        updated = service.update(
            row_id=bank_income["row_id"], entry_date=date(2026, 11, 4), flow_type="cash",
            direction="expense", category="Food", amount=Decimal("50.00"),
        )
        assert updated["row_id"] == bank_income["row_id"]
        assert updated["sequence_no"] == bank_income["sequence_no"]
        assert updated["created_timestamp"] == bank_income["created_timestamp"]
        assert updated["signed_amount"] == Decimal("-50")
        assert connection.execute(
            "SELECT signed_amount_scaled FROM personal_finance_entries WHERE row_id=?",
            (bank_income["row_id"],),
        ).fetchone()[0] == -500_000

        service.delete(row_id=cash_expense["row_id"])
        tombstone = connection.execute(
            "SELECT entity_type FROM deleted_records WHERE row_id=?", (cash_expense["row_id"],)
        ).fetchone()
        assert tombstone[0] == "personal_finance"
    finally:
        connection.close()


def test_sqlite_personal_finance_rejects_category_mismatch_float_and_unknown_flow(tmp_path: Path):
    service, connection = _service(tmp_path / "sqlite-pf-invalid.db")
    try:
        with pytest.raises(ValueError, match="matching Personal Finance category"):
            service.add(
                entry_date=date(2026, 11, 1), flow_type="bank", direction="expense",
                category="Salary", amount=Decimal("1.00"),
            )
        with pytest.raises(TypeError, match="Binary float"):
            service.add(
                entry_date=date(2026, 11, 1), flow_type="bank", direction="income",
                category="Salary", amount=1.25,  # type: ignore[arg-type]
            )
        with pytest.raises(ValueError, match="flow_type must"):
            service.list_records("everywhere")
    finally:
        connection.close()
