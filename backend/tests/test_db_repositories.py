from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from backend.db.core import connect_database, migrate_database, transaction
from backend.db.repositories import (
    BankRepository,
    DividendRepository,
    PersonalFinanceRepository,
    RecordRepository,
    ShareRepository,
    SipRepository,
    SPECS,
    TransferRepository,
    replace_rebuilt_holding,
)


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def _base(row_id: str, sequence_no: int = 0):
    return {"row_id": row_id, "txn_date": "2026-11-13"}


def test_canonical_repositories_allocate_scoped_sequences_and_keep_immutable_identity(tmp_path: Path):
    connection = _database(tmp_path / "repos.db")
    try:
        bank = BankRepository(connection)
        with pytest.raises(RuntimeError, match="caller-owned transaction"):
            bank.create({}, device="desktop-test")

        with transaction(connection):
            bank.create({**_base("00000000-0000-0000-0000-000000000001"), "category": "Interest Earned", "amount_scaled": 10000}, device="desktop-test", timestamp="2026-11-13T00:00:00.000000Z")
            bank.create({**_base("00000000-0000-0000-0000-000000000002"), "category": "Interest Tax", "amount_scaled": -2000}, device="desktop-test", timestamp="2026-11-13T00:00:00.000000Z")
            assert [r["sequence_no"] for r in bank.list()] == [1, 2]
            before = bank.get("00000000-0000-0000-0000-000000000001")
            assert before["content_hash"].startswith("sha256:")
            assert bank.update("00000000-0000-0000-0000-000000000001", {"amount_scaled": 10000}, device="desktop-test", timestamp="2026-11-13T00:01:00.000000Z")
            unchanged = bank.get("00000000-0000-0000-0000-000000000001")
            assert unchanged["last_updated_timestamp"] == before["last_updated_timestamp"]
            assert unchanged["content_hash"] == before["content_hash"]
            connection.execute("UPDATE bank_transactions SET content_hash=? WHERE row_id=?", ("sha256:" + "b" * 64, before["row_id"]))
            assert bank.update("00000000-0000-0000-0000-000000000001", {"amount_scaled": 10000}, device="desktop-test", timestamp="2026-11-13T00:01:30.000000Z")
            repaired = bank.get("00000000-0000-0000-0000-000000000001")
            assert repaired["content_hash"] == before["content_hash"]
            assert repaired["last_updated_timestamp"] == before["last_updated_timestamp"]
            assert bank.update("00000000-0000-0000-0000-000000000001", {"amount_scaled": 9000}, device="desktop-appx", timestamp="2026-11-13T00:02:00.000000Z")
            changed = bank.get("00000000-0000-0000-0000-000000000001")
            assert changed["row_id"] == before["row_id"]
            assert changed["sequence_no"] == before["sequence_no"]
            assert changed["created_timestamp"] == before["created_timestamp"]
            assert changed["last_updated_timestamp"] == "2026-11-13T00:02:00.000000Z"
            assert changed["updated_device"] == "desktop-appx"
            assert changed["content_hash"] != before["content_hash"]
            with pytest.raises(ValueError, match="immutable"):
                bank.update("00000000-0000-0000-0000-000000000001", {"sequence_no": 9}, device="desktop-test")
        with transaction(connection):
            normalized_id = bank.create({**_base("{A0000000-0000-0000-0000-000000000003}"), "category": "Other Charges", "amount_scaled": -100}, device="desktop-test")
            assert normalized_id == "a0000000-0000-0000-0000-000000000003"

        share = ShareRepository(connection)
        dividend = DividendRepository(connection)
        with transaction(connection):
            master = share.ensure_share(share_id="10000000-0000-0000-0000-000000000001", name="  nabil   bank ")
            assert master["name"] == "NABIL BANK"
            share.create({**_base("20000000-0000-0000-0000-000000000001"), "share_id": master["share_id"], "transaction_type": "buy", "per_unit_price_scaled": 10000, "quantity": 2, "charge_scaled": 0}, device="desktop-test")
            dividend.create({**_base("30000000-0000-0000-0000-000000000001"), "share_id": master["share_id"], "event_type": "bonus", "cash_amount_scaled": None, "quantity": 1}, device="desktop-test")
            with pytest.raises(ValueError, match="immutable"):
                share.update("20000000-0000-0000-0000-000000000001", {"transaction_type": "sell"}, device="desktop-test")
            assert [r["sequence_no"] for r in share.list_for_share(master["share_id"])] == [1]
            assert [r["sequence_no"] for r in dividend.list_for_share(master["share_id"])] == [2]

        sip = SipRepository(connection)
        with transaction(connection):
            sip.create({**_base("40000000-0000-0000-0000-000000000001"), "investment_name": "FUND", "sip_plan_id": "50000000-0000-0000-0000-000000000001", "transaction_type": "sip_installment", "amount_scaled": 10000, "charge_scaled": 0, "units": None}, device="desktop-test")
            assert sip.list_for_plan("50000000-0000-0000-0000-000000000001")[0]["sequence_no"] == 1
            with pytest.raises(ValueError, match="already belongs"):
                sip.create({**_base("00000000-0000-0000-0000-000000000001")}, device="desktop-test")
            with pytest.raises(TypeError, match="integer"):
                bank.create({**_base("00000000-0000-0000-0000-000000000003"), "category": "Other Charges", "amount_scaled": 1.0}, device="desktop-test")
        assert connection.execute("SELECT value FROM app_metadata WHERE key='share_sequence_next'").fetchone()[0] == "3"
        assert connection.execute("SELECT value FROM app_metadata WHERE key='sip_sequence_next'").fetchone()[0] == "2"
    finally:
        connection.close()


def test_tombstone_and_row_delete_are_one_transaction(tmp_path: Path):
    connection = _database(tmp_path / "delete.db")
    repository = BankRepository(connection)
    record_id = "60000000-0000-0000-0000-000000000001"
    try:
        with transaction(connection):
            repository.create({**_base(record_id), "category": "Interest Earned", "amount_scaled": 40000}, device="desktop-test")
        with pytest.raises(RuntimeError):
            repository.delete(record_id, deleted_by_device="desktop-test")
        assert repository.get(record_id) is not None
        with transaction(connection):
            deleted = repository.delete(record_id, deleted_by_device="desktop-test")
            assert deleted["row_id"] == record_id
            assert repository.get(record_id) is None
            assert connection.execute("SELECT entity_type FROM deleted_records WHERE row_id=?", (record_id,)).fetchone()[0] == "bank"
        with transaction(connection):
            assert repository.delete(record_id, deleted_by_device="desktop-test") is None
    finally:
        connection.close()


def test_bank_sqlite_queries_derive_sequence_cumulative_and_exact_summary(tmp_path: Path):
    connection = _database(tmp_path / "bank-calculations.db")
    repository = BankRepository(connection)
    try:
        with transaction(connection):
            repository.create({**_base("61000000-0000-0000-0000-000000000001"), "category": "Interest Earned", "amount_scaled": 12500}, device="desktop-test")
            repository.create({**_base("61000000-0000-0000-0000-000000000002"), "category": "Interest Tax", "amount_scaled": -5000}, device="desktop-test")
            with pytest.raises(ValueError, match="Unsupported Bank Services category"):
                repository.create({**_base("61000000-0000-0000-0000-000000000003"), "category": "Income", "amount_scaled": 1500}, device="desktop-test")
            RecordRepository(connection, SPECS["bank"]).create({**_base("61000000-0000-0000-0000-000000000003"), "category": "Income", "amount_scaled": 1500}, device="desktop-test")

        rows = repository.list_with_cumulative()
        assert [row["cumulative_amount_scaled"] for row in rows] == [12500, 7500, 9000]
        summary = repository.summarize()
        assert summary["total_income"] == Decimal("1.4")
        assert summary["total_expenses"] == Decimal("0.5")
        assert summary["net_balance"] == Decimal("0.9")
        assert summary["category_totals"]["Interest Earned"] == Decimal("1.25")
        assert summary["category_totals"]["Interest Tax"] == Decimal("0.5")
        assert summary["category_totals"]["Income"] == Decimal("0.15")
        assert summary["category_totals"]["Mobile Banking Charge"] == Decimal("0")
    finally:
        connection.close()


def test_bank_repository_rejects_category_sign_mismatch(tmp_path: Path):
    connection = _database(tmp_path / "bank-signs.db")
    repository = BankRepository(connection)
    try:
        with transaction(connection):
            with pytest.raises(ValueError, match="must have a positive"):
                repository.create({**_base("62000000-0000-0000-0000-000000000001"), "category": "Interest Earned", "amount_scaled": -100}, device="desktop-test")
            with pytest.raises(ValueError, match="must have a negative"):
                repository.create({**_base("62000000-0000-0000-0000-000000000002"), "category": "Interest Tax", "amount_scaled": 100}, device="desktop-test")
    finally:
        connection.close()


def test_transfer_personal_finance_and_summary_repositories_use_fixed_schema(tmp_path: Path):
    connection = _database(tmp_path / "other-repos.db")
    try:
        with transaction(connection):
            connection.execute("INSERT INTO shares VALUES (?, ?, ?)", ("90000000-0000-0000-0000-000000000001", "TEST SHARE", "2026-11-13T00:00:00.000000Z"))
            PersonalFinanceRepository(connection).create({**_base("70000000-0000-0000-0000-000000000001"), "flow_type": "cash", "direction": "expense", "category": "Food", "amount_scaled": 1500}, device="desktop-test")
            TransferRepository(connection).create({**_base("80000000-0000-0000-0000-000000000001"), "direction": "bank_to_cash", "amount_scaled": 10000, "transfer_ref": "transfer:2026-11-13:12345678"}, device="desktop-test")
            replace_rebuilt_holding(connection, {"share_id": "90000000-0000-0000-0000-000000000001", "quantity": 0, "total_cost_scaled": 0, "average_cost_scaled": 0, "realized_profit_loss_scaled": 0, "cash_dividends_scaled": 0, "bonus_units": 0, "last_event_sequence_no": 0, "calculation_version": 1, "summary_updated_timestamp": "2026-11-13T00:00:00.000000Z", "summary_updated_device": "desktop-test"})
    finally:
        connection.close()
