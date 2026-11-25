from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from backend.db.core import connect_database, migrate_database
from backend.db.share import calculate_share_replay
from backend.services.share import SQLiteShareService


def _service(path: Path) -> tuple[SQLiteShareService, object]:
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return SQLiteShareService(connection, device="desktop-test"), connection


def test_sqlite_share_service_weighted_average_updates_and_rebuilds_atomically(tmp_path: Path):
    service, connection = _service(tmp_path / "sqlite-share.db")
    try:
        first = service.create_share_transaction(
            entry_date=date(2025, 1, 1), share_name="  cmf2  ", transaction_type="buy",
            per_unit_price=Decimal("10"), quantity=600,
        )
        service.create_share_transaction(
            entry_date=date(2025, 1, 2), share_name="CMF2", transaction_type="sell",
            per_unit_price=Decimal("10"), quantity=200,
        )
        second_buy = service.create_share_transaction(
            entry_date=date(2025, 1, 3), share_name="CMF2", transaction_type="buy",
            per_unit_price=Decimal("11"), quantity=100,
        )
        final_sale = service.create_share_transaction(
            entry_date=date(2025, 1, 4), share_name="CMF2", transaction_type="sell",
            per_unit_price=Decimal("10.45"), quantity=200,
        )
        bonus = service.create_dividend_event(
            entry_date=date(2025, 1, 5), share_name="CMF2", event_type="bonus", bonus_quantity=100,
        )
        cash = service.create_dividend_event(
            entry_date=date(2025, 1, 6), share_name="CMF2", event_type="cash",
            cash_amount=Decimal("100"),
        )

        assert final_sale["profit_loss_scaled"] == 500_000
        assert final_sale["holding_quantity"] == 300
        assert final_sale["holding_cost_scaled"] == 30_600_000
        assert bonus["holding_quantity"] == 400
        assert bonus["holding_cost_scaled"] == 30_600_000
        assert cash["profit_loss_scaled"] == 1_000_000
        assert cash["cumulative_profit_scaled"] == 1_500_000

        updated = service.update_share_transaction(
            row_id=second_buy["row_id"], entry_date=date(2025, 1, 3),
            per_unit_price=Decimal("12"), quantity=100,
        )
        assert updated["row_id"] == second_buy["row_id"]
        assert updated["profit_loss_scaled"] == 0
        latest_sale = connection.execute(
            "SELECT row_id FROM share_transactions WHERE transaction_type='sell' ORDER BY txn_date DESC LIMIT 1"
        ).fetchone()["row_id"]
        replayed_sale = calculate_share_replay(connection).events[latest_sale]
        assert replayed_sale["profit_loss_scaled"] == 100_000
        assert replayed_sale["holding_cost_scaled"] == 31_200_000

        deleted = service.delete_share_transaction(row_id=second_buy["row_id"])
        assert deleted["deleted_id"] == second_buy["row_id"]
        latest = service.rebuild_holdings()
        assert next(iter(latest.values()))["quantity"] == 300  # later bonus remains valid after 200 shares remain
        tombstone = connection.execute(
            "SELECT entity_type FROM deleted_records WHERE row_id=?", (second_buy["row_id"],)
        ).fetchone()
        assert tombstone[0] == "share"
        assert connection.execute("SELECT COUNT(*) FROM share_holdings").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM shares").fetchone()[0] == 1
        assert first["share_name"] == "CMF2"
    finally:
        connection.close()


def test_sqlite_share_service_ipo_default_allotment_and_invalid_events_rollback(tmp_path: Path):
    service, connection = _service(tmp_path / "sqlite-share-validation.db")
    try:
        pending = service.create_share_transaction(
            entry_date=date(2025, 1, 1), share_name="NABIL BANK", transaction_type="ipo",
            per_unit_price=Decimal("100"), quantity=0,
        )
        assert pending["total_amount_scaled"] == 50_000
        assert pending["holding_quantity"] == 0
        allotted = service.update_share_transaction(
            row_id=pending["row_id"], entry_date=date(2025, 1, 1),
            per_unit_price=Decimal("100"), quantity=10,
        )
        assert allotted["row_id"] == pending["row_id"]
        assert allotted["holding_quantity"] == 10
        assert allotted["holding_cost_scaled"] == 10_050_000

        dependent_bonus = service.create_dividend_event(
            entry_date=date(2025, 1, 2), share_name="NABIL BANK", event_type="bonus", bonus_quantity=2,
        )
        with pytest.raises(ValueError, match="no shares are held"):
            service.delete_share_transaction(row_id=pending["row_id"])
        assert connection.execute(
            "SELECT 1 FROM share_transactions WHERE row_id=?", (pending["row_id"],)
        ).fetchone() is not None
        assert connection.execute(
            "SELECT 1 FROM deleted_records WHERE row_id=?", (pending["row_id"],)
        ).fetchone() is None
        with pytest.raises(ValueError, match="no shares are held"):
            service.update_share_transaction(
                row_id=pending["row_id"], entry_date=date(2025, 1, 3),
                per_unit_price=Decimal("100"), quantity=10,
            )
        assert connection.execute(
            "SELECT txn_date FROM share_transactions WHERE row_id=?", (pending["row_id"],)
        ).fetchone()[0] == "2025-01-01"

        with pytest.raises(ValueError, match="Not enough available quantity"):
            service.create_share_transaction(
                entry_date=date(2025, 1, 2), share_name="NO HOLDING", transaction_type="sell",
                per_unit_price=Decimal("10"), quantity=1,
            )
        with pytest.raises(ValueError, match="no shares are held"):
            service.create_dividend_event(
                entry_date=date(2025, 1, 2), share_name="NO DIVIDEND HOLDING",
                event_type="bonus", bonus_quantity=1,
            )
        assert connection.execute("SELECT COUNT(*) FROM shares").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM share_transactions").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM dividend_events").fetchone()[0] == 1
        assert connection.execute(
            "SELECT row_id FROM dividend_events WHERE row_id=?", (dependent_bonus["row_id"],)
        ).fetchone() is not None

        assert connection.execute("SELECT COUNT(*) FROM share_transactions").fetchone()[0] == 1
    finally:
        connection.close()


def test_sell_charge_is_separate_expense_reducing_net_proceeds_and_profit(tmp_path: Path):
    service, connection = _service(tmp_path / "sqlite-share-sell-charge.db")
    try:
        service.create_share_transaction(
            entry_date=date(2025, 1, 1), share_name="NABIL BANK", transaction_type="buy",
            per_unit_price=Decimal("10"), quantity=10,
        )
        sale = service.create_share_transaction(
            entry_date=date(2025, 1, 2), share_name="NABIL BANK", transaction_type="sell",
            per_unit_price=Decimal("12"), quantity=2, charge=Decimal("1"),
        )
        assert sale["total_amount_scaled"] == 230_000
        assert sale["profit_loss_scaled"] == 30_000
        row = connection.execute("SELECT charge_scaled FROM share_transactions WHERE row_id=?", (sale["row_id"],)).fetchone()
        assert row["charge_scaled"] == 10_000
        with pytest.raises(ValueError, match="less than gross sale proceeds"):
            service.create_share_transaction(
                entry_date=date(2025, 1, 3), share_name="NABIL BANK", transaction_type="sell",
                per_unit_price=Decimal("12"), quantity=1, charge=Decimal("12"),
            )
        assert connection.execute("SELECT COUNT(*) FROM share_transactions").fetchone()[0] == 2
    finally:
        connection.close()


def test_buy_charge_is_added_to_acquisition_cost_and_weighted_average(tmp_path: Path):
    service, connection = _service(tmp_path / "sqlite-share-buy-charge.db")
    try:
        service.create_share_transaction(
            entry_date=date(2025, 1, 1), share_name="CMF2", transaction_type="buy",
            per_unit_price=Decimal("9.76"), quantity=600,
        )
        purchase = service.create_share_transaction(
            entry_date=date(2025, 1, 2), share_name="CMF2", transaction_type="buy",
            per_unit_price=Decimal("10"), quantity=100, charge=Decimal("5"),
        )
        assert purchase["total_amount_scaled"] == 10_050_000
        assert purchase["holding_quantity"] == 700
        assert purchase["holding_cost_scaled"] == 68_610_000
        assert purchase["average_cost_scaled"] == 98_014
        row = connection.execute(
            "SELECT charge_scaled FROM share_transactions WHERE row_id=?", (purchase["row_id"],)
        ).fetchone()
        assert row["charge_scaled"] == 50_000
    finally:
        connection.close()
