from __future__ import annotations

from pathlib import Path

import pytest

from backend.db.core import connect_database, migrate_database, transaction
from backend.db.repositories import DividendRepository, ShareRepository
from backend.db.share import (
    SHARE_CALCULATION_VERSION,
    ShareReplayError,
    calculate_share_replay,
    normalize_share_name,
    rebuild_share_holdings,
)


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def _master(connection, *, name="cmf2"):
    with transaction(connection):
        return ShareRepository(connection).ensure_share(
            share_id="10000000-0000-0000-0000-000000000001", name=name
        )


def test_share_name_normalization_and_master_identity(tmp_path: Path):
    assert normalize_share_name("  nabil\t  bank ") == "NABIL BANK"
    with pytest.raises(ValueError, match="blank"):
        normalize_share_name(" \t ")

    connection = _database(tmp_path / "share-identity.db")
    try:
        first = _master(connection, name="  nabil   bank ")
        second = _master(connection, name="NABIL BANK")
        assert first["share_id"] == second["share_id"]
        assert first["name"] == "NABIL BANK"
    finally:
        connection.close()


def test_weighted_average_replay_bonus_dividend_and_materialized_rebuild(tmp_path: Path):
    connection = _database(tmp_path / "share-replay.db")
    try:
        master = _master(connection)
        share_id = master["share_id"]
        share = ShareRepository(connection)
        dividend = DividendRepository(connection)
        with transaction(connection):
            share.create({
                "row_id": "20000000-0000-0000-0000-000000000001", "txn_date": "2025-01-01",
                "share_id": share_id, "transaction_type": "buy", "per_unit_price_scaled": 100_000,
                "quantity": 600, "charge_scaled": 0,
            }, device="desktop-test")
            share.create({
                "row_id": "20000000-0000-0000-0000-000000000002", "txn_date": "2025-01-02",
                "share_id": share_id, "transaction_type": "sell", "per_unit_price_scaled": 100_000,
                "quantity": 200, "charge_scaled": 0,
            }, device="desktop-test")
            share.create({
                "row_id": "20000000-0000-0000-0000-000000000003", "txn_date": "2025-01-03",
                "share_id": share_id, "transaction_type": "buy", "per_unit_price_scaled": 110_000,
                "quantity": 100, "charge_scaled": 0,
            }, device="desktop-test")
            share.create({
                "row_id": "20000000-0000-0000-0000-000000000004", "txn_date": "2025-01-04",
                "share_id": share_id, "transaction_type": "sell", "per_unit_price_scaled": 104_500,
                "quantity": 200, "charge_scaled": 0,
            }, device="desktop-test")
            dividend.create({
                "row_id": "30000000-0000-0000-0000-000000000001", "txn_date": "2025-01-05",
                "share_id": share_id, "event_type": "bonus", "quantity": 100,
                "cash_amount_scaled": None,
            }, device="desktop-test")
            dividend.create({
                "row_id": "30000000-0000-0000-0000-000000000002", "txn_date": "2025-01-06",
                "share_id": share_id, "event_type": "cash", "quantity": None,
                "cash_amount_scaled": 1_000_000,
            }, device="desktop-test")

        replay = calculate_share_replay(connection)
        assert replay.events["20000000-0000-0000-0000-000000000004"]["profit_loss_scaled"] == 500_000
        assert replay.events["30000000-0000-0000-0000-000000000002"]["cumulative_profit_scaled"] == 1_500_000
        expected = replay.holdings[share_id]
        assert expected == {
            "share_id": share_id,
            "quantity": 400,
            "total_cost_scaled": 30_600_000,
            "average_cost_scaled": 76_500,
            "realized_profit_loss_scaled": 500_000,
            "cash_dividends_scaled": 1_000_000,
            "bonus_units": 100,
            "last_event_sequence_no": 6,
        }

        with pytest.raises(RuntimeError, match="caller-owned transaction"):
            rebuild_share_holdings(connection, device="desktop-test")
        with transaction(connection):
            rebuilt = rebuild_share_holdings(
                connection, device="desktop-test", timestamp="2025-01-07T00:00:00.000000Z"
            )
        assert rebuilt.holdings == replay.holdings
        stored = connection.execute("SELECT * FROM share_holdings WHERE share_id=?", (share_id,)).fetchone()
        for key, value in expected.items():
            assert stored[key] == value
        assert stored["calculation_version"] == SHARE_CALCULATION_VERSION
        assert stored["summary_updated_timestamp"] == "2025-01-07T00:00:00.000000Z"
    finally:
        connection.close()


def test_share_replay_rejects_oversell_and_dividend_without_holding(tmp_path: Path):
    connection = _database(tmp_path / "share-invalid.db")
    try:
        master = _master(connection)
        share_id = master["share_id"]
        share = ShareRepository(connection)
        dividend = DividendRepository(connection)
        with transaction(connection):
            share.create({
                "row_id": "40000000-0000-0000-0000-000000000001", "txn_date": "2025-01-01",
                "share_id": share_id, "transaction_type": "buy", "per_unit_price_scaled": 100_000,
                "quantity": 2, "charge_scaled": 0,
            }, device="desktop-test")
            share.create({
                "row_id": "40000000-0000-0000-0000-000000000002", "txn_date": "2025-01-02",
                "share_id": share_id, "transaction_type": "sell", "per_unit_price_scaled": 100_000,
                "quantity": 3, "charge_scaled": 0,
            }, device="desktop-test")
        with pytest.raises(ShareReplayError) as oversell:
            calculate_share_replay(connection)
        assert oversell.value.code == "insufficient_quantity"
        assert oversell.value.row_id == "40000000-0000-0000-0000-000000000002"
        assert str(oversell.value) == "Not enough available quantity to sell for this share."

        with transaction(connection):
            connection.execute("DELETE FROM share_transactions WHERE row_id=?", ("40000000-0000-0000-0000-000000000002",))
            connection.execute("DELETE FROM share_transactions WHERE row_id=?", ("40000000-0000-0000-0000-000000000001",))
            dividend.create({
                "row_id": "50000000-0000-0000-0000-000000000001", "txn_date": "2025-01-03",
                "share_id": share_id, "event_type": "bonus", "quantity": 1,
                "cash_amount_scaled": None,
            }, device="desktop-test")
        with pytest.raises(ShareReplayError) as no_holding:
            calculate_share_replay(connection)
        assert no_holding.value.code == "no_holding_at_event_date"
        assert no_holding.value.row_id == "50000000-0000-0000-0000-000000000001"
    finally:
        connection.close()
