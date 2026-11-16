from __future__ import annotations

from pathlib import Path

import pytest

from backend.db.core import connect_database, migrate_database, transaction
from backend.db.sip import (
    SIP_CALCULATION_VERSION,
    SipReplayError,
    calculate_sip_replay,
    rebuild_sip_plan_summaries,
)
from backend.db.repositories import SipRepository


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def test_sip_replay_calculates_units_principal_redemption_and_versioned_summary(tmp_path: Path):
    connection = _database(tmp_path / "sip-replay.db")
    plan_id = "10000000-0000-0000-0000-000000000001"
    try:
        with transaction(connection):
            repo = SipRepository(connection)
            repo.create({
                "row_id": "20000000-0000-0000-0000-000000000001", "txn_date": "2025-01-01",
                "investment_name": "FUND A", "sip_plan_id": plan_id,
                "transaction_type": "sip_installment", "amount_scaled": 10_000_000,
                "charge_scaled": 50_000, "units": None,
            }, device="desktop-test")
            repo.create({
                "row_id": "20000000-0000-0000-0000-000000000002", "txn_date": "2025-02-01",
                "investment_name": "FUND A", "sip_plan_id": plan_id,
                "transaction_type": "sip_installment", "amount_scaled": 5_000_000,
                "charge_scaled": 20_000, "units": 20,
            }, device="desktop-test")
            repo.create({
                "row_id": "20000000-0000-0000-0000-000000000003", "txn_date": "2025-03-01",
                "investment_name": "FUND A", "sip_plan_id": plan_id,
                "transaction_type": "sip_redemption", "amount_scaled": 16_000_000,
                "charge_scaled": 30_000, "units": None,
            }, device="desktop-test")

        replay = calculate_sip_replay(connection)
        plan = replay.plans[plan_id]
        assert plan == {
            "sip_plan_id": plan_id,
            "sip_name": "FUND A",
            "start_date": "2025-01-01",
            "outstanding_principal_scaled": 0,
            "updated_units_total": 20,
            "pending_installment_count": 1,
            "total_redeemed_scaled": 16_000_000,
            "realized_profit_loss_scaled": 930_000,
            "plan_status": "closed",
            "last_event_sequence_no": 3,
        }
        redemption = replay.events["20000000-0000-0000-0000-000000000003"]
        assert redemption["investment_total_scaled"] == 16_000_000
        assert redemption["profit_loss_scaled"] == 930_000
        assert redemption["units"] is None

        with pytest.raises(RuntimeError, match="caller-owned transaction"):
            rebuild_sip_plan_summaries(connection, device="desktop-test")
        with transaction(connection):
            rebuild_sip_plan_summaries(
                connection, device="desktop-test", timestamp="2025-03-02T00:00:00.000000Z"
            )
        stored = connection.execute("SELECT * FROM sip_plan_summaries WHERE sip_plan_id=?", (plan_id,)).fetchone()
        for key, value in plan.items():
            assert stored[key] == value
        assert stored["calculation_version"] == SIP_CALCULATION_VERSION
        assert stored["summary_updated_timestamp"] == "2025-03-02T00:00:00.000000Z"
    finally:
        connection.close()


def test_sip_replay_rejects_events_after_redemption_and_redemption_without_installment(tmp_path: Path):
    connection = _database(tmp_path / "sip-invalid.db")
    plan_id = "30000000-0000-0000-0000-000000000001"
    try:
        with transaction(connection):
            repo = SipRepository(connection)
            repo.create({
                "row_id": "40000000-0000-0000-0000-000000000001", "txn_date": "2025-01-01",
                "investment_name": "FUND B", "sip_plan_id": plan_id,
                "transaction_type": "sip_installment", "amount_scaled": 1_000_000,
                "charge_scaled": 0, "units": None,
            }, device="desktop-test")
            repo.create({
                "row_id": "40000000-0000-0000-0000-000000000002", "txn_date": "2025-01-02",
                "investment_name": "FUND B", "sip_plan_id": plan_id,
                "transaction_type": "sip_redemption", "amount_scaled": 1_200_000,
                "charge_scaled": 0, "units": None,
            }, device="desktop-test")
        with transaction(connection):
            SipRepository(connection).create({
                "row_id": "40000000-0000-0000-0000-000000000003", "txn_date": "2025-01-03",
                "investment_name": "FUND B", "sip_plan_id": plan_id,
                "transaction_type": "sip_installment", "amount_scaled": 500_000,
                "charge_scaled": 0, "units": None,
            }, device="desktop-test")
        with pytest.raises(SipReplayError) as after_close:
            calculate_sip_replay(connection)
        assert after_close.value.code == "plan_already_closed"
        assert after_close.value.row_id == "40000000-0000-0000-0000-000000000003"

        with transaction(connection):
            connection.execute("DELETE FROM sip_transactions WHERE row_id=?", ("40000000-0000-0000-0000-000000000003",))
            connection.execute("DELETE FROM sip_transactions WHERE row_id=?", ("40000000-0000-0000-0000-000000000001",))
        with pytest.raises(SipReplayError) as no_installment:
            calculate_sip_replay(connection)
        assert no_installment.value.code == "redemption_without_principal"
        assert no_installment.value.row_id == "40000000-0000-0000-0000-000000000002"
    finally:
        connection.close()
