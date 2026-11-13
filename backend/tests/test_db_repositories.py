from __future__ import annotations

from pathlib import Path

import pytest

from backend.db.bank_repository import BankRepository
from backend.db.connection import connect_database
from backend.db.dividend_repository import DividendRepository
from backend.db.holdings_repository import replace_rebuilt_holding
from backend.db.personal_finance_repository import PersonalFinanceRepository
from backend.db.schema import migrate_database
from backend.db.share_repository import ShareRepository
from backend.db.sip_repository import SipRepository
from backend.db.transfer_repository import TransferRepository
from backend.db.transactions import transaction


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def _base(row_id: str, sequence_no: int, *, timestamp: str = "2026-11-13T00:00:00.000000Z"):
    return {
        "row_id": row_id,
        "txn_date": "2026-11-13",
        "created_timestamp": timestamp,
        "last_updated_timestamp": timestamp,
        "updated_device": "desktop-test",
        "metadata_quality": "exact",
        "content_hash": "sha256:" + "a" * 64,
    }


def test_canonical_repositories_allocate_scoped_sequences_and_keep_immutable_identity(tmp_path: Path):
    connection = _database(tmp_path / "repos.db")
    try:
        bank = BankRepository(connection)
        with pytest.raises(RuntimeError, match="caller-owned transaction"):
            bank.create({})

        with transaction(connection):
            bank.create({**_base("00000000-0000-0000-0000-000000000001", 0), "category": "Interest", "amount_scaled": 10000})
            bank.create({**_base("00000000-0000-0000-0000-000000000002", 0), "category": "Tax", "amount_scaled": -2000})
            assert [r["sequence_no"] for r in bank.list()] == [1, 2]
            assert bank.update("00000000-0000-0000-0000-000000000001", {"amount_scaled": 9000})
            with pytest.raises(ValueError, match="immutable"):
                bank.update("00000000-0000-0000-0000-000000000001", {"sequence_no": 9})

        share = ShareRepository(connection)
        dividend = DividendRepository(connection)
        with transaction(connection):
            master = share.ensure_share(share_id="10000000-0000-0000-0000-000000000001", name="  nabil   bank ")
            assert master["name"] == "NABIL BANK"
            share.create({**_base("20000000-0000-0000-0000-000000000001", 0), "share_id": master["share_id"], "transaction_type": "buy", "per_unit_price_scaled": 10000, "quantity": 2, "charge_scaled": 0})
            dividend.create({**_base("30000000-0000-0000-0000-000000000001", 0), "share_id": master["share_id"], "event_type": "bonus", "cash_amount_scaled": None, "quantity": 1})
            assert [r["sequence_no"] for r in share.list_for_share(master["share_id"])] == [1]
            assert [r["sequence_no"] for r in dividend.list_for_share(master["share_id"])] == [2]

        sip = SipRepository(connection)
        with transaction(connection):
            sip.create({**_base("40000000-0000-0000-0000-000000000001", 0), "investment_name": "FUND", "sip_plan_id": "50000000-0000-0000-0000-000000000001", "transaction_type": "sip_installment", "amount_scaled": 10000, "charge_scaled": 0, "units": None})
            assert sip.list_for_plan("50000000-0000-0000-0000-000000000001")[0]["sequence_no"] == 1
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
            repository.create({**_base(record_id, 0), "category": "Income", "amount_scaled": 40000})
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


def test_transfer_personal_finance_and_summary_repositories_use_fixed_schema(tmp_path: Path):
    connection = _database(tmp_path / "other-repos.db")
    try:
        with transaction(connection):
            connection.execute("INSERT INTO shares VALUES (?, ?, ?)", ("90000000-0000-0000-0000-000000000001", "TEST SHARE", "2026-11-13T00:00:00.000000Z"))
            PersonalFinanceRepository(connection).create({**_base("70000000-0000-0000-0000-000000000001", 0), "flow_type": "cash", "direction": "expense", "category": "Food", "amount_scaled": 1500, "signed_amount_scaled": -1500})
            TransferRepository(connection).create({**_base("80000000-0000-0000-0000-000000000001", 0), "direction": "bank_to_cash", "amount_scaled": 10000, "transfer_ref": "transfer:2026-11-13:12345678"})
            replace_rebuilt_holding(connection, {"share_id": "90000000-0000-0000-0000-000000000001", "quantity": 0, "total_cost_scaled": 0, "average_cost_scaled": 0, "realized_profit_loss_scaled": 0, "cash_dividends_scaled": 0, "bonus_units": 0, "last_event_sequence_no": 0, "calculation_version": 1, "summary_updated_timestamp": "2026-11-13T00:00:00.000000Z", "summary_updated_device": "desktop-test"})
    finally:
        connection.close()
