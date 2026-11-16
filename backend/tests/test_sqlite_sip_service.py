from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from backend.db.core import connect_database, migrate_database, transaction
from backend.services.sip import SQLiteSipService


def _service(path: Path) -> tuple[SQLiteSipService, object]:
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return SQLiteSipService(connection, device="desktop-test"), connection


def test_sip_service_plan_uuid_units_redemption_and_new_plan_lifecycle(tmp_path: Path):
    service, connection = _service(tmp_path / "sip-service.db")
    try:
        first = service.create_installment(
            entry_date=date(2025, 1, 1), investment_name="  fund   alpha ",
            amount=Decimal("1000"), charge=Decimal("5"), units=0,
        )
        plan_id = first["sip_plan_id"]
        assert first["investment_name"] == "FUND ALPHA"
        assert first["units"] is None
        assert first["pending_installment_count"] == 1
        assert first["outstanding_principal_scaled"] == 10_050_000

        second = service.create_installment(
            entry_date=date(2025, 2, 1), investment_name="FUND ALPHA",
            amount=Decimal("500"), charge=Decimal("2"), units=20,
        )
        assert second["sip_plan_id"] == plan_id
        assert second["updated_units_total"] == 20

        updated_first = service.update_installment(
            row_id=first["row_id"], entry_date=date(2025, 1, 1),
            amount=Decimal("1100"), charge=Decimal("5"), units=10,
        )
        assert updated_first["row_id"] == first["row_id"]
        assert updated_first["updated_units_total"] == 10
        assert updated_first["pending_installment_count"] == 0
        summary = next(row for row in service.list_plan_summaries() if row["sip_plan_id"] == plan_id)
        assert summary["updated_units_total"] == 30
        assert summary["outstanding_principal_scaled"] == 16_070_000

        redemption = service.redeem_plan(
            sip_plan_id=plan_id, entry_date=date(2025, 3, 1),
            amount_received=Decimal("1600"), charge=Decimal("3"),
        )
        assert redemption["transaction_type"] == "sip_redemption"
        assert redemption["units"] is None
        assert redemption["profit_loss_scaled"] == -70_000
        assert redemption["outstanding_principal_scaled"] == 0
        assert redemption["plan_status"] == "closed"
        assert service.list_plan_summaries()[0]["total_redeemed_scaled"] == 16_000_000

        with pytest.raises(ValueError, match="already closed"):
            service.create_installment(
                entry_date=date(2025, 3, 2), investment_name="FUND ALPHA",
                amount=Decimal("50"), sip_plan_id=plan_id,
            )

        new_plan_installment = service.create_installment(
            entry_date=date(2025, 4, 1), investment_name="FUND ALPHA",
            amount=Decimal("50"),
        )
        assert new_plan_installment["sip_plan_id"] != plan_id
        assert len(service.list_plan_summaries()) == 2
        assert {row["plan_status"] for row in service.list_plan_summaries()} == {"open", "closed"}

        deleted = service.delete_event(row_id=redemption["row_id"])
        assert deleted["deleted_id"] == redemption["row_id"]
        reopened = {row["sip_plan_id"]: row for row in service.list_plan_summaries()}[plan_id]
        assert reopened["plan_status"] == "open"
        tombstone = connection.execute(
            "SELECT entity_type FROM deleted_records WHERE row_id=?", (redemption["row_id"],)
        ).fetchone()
        assert tombstone[0] == "sip"
    finally:
        connection.close()


def test_sip_service_allows_pending_units_at_redemption_and_rolls_back_invalid_delete(tmp_path: Path):
    service, connection = _service(tmp_path / "sip-service-validation.db")
    try:
        pending = service.create_installment(
            entry_date=date(2025, 1, 1), investment_name="FUND BETA",
            amount=Decimal("100"), units=None,
        )
        redemption = service.redeem_plan(
            sip_plan_id=pending["sip_plan_id"], entry_date=date(2025, 2, 1),
            amount_received=Decimal("120"),
        )
        assert redemption["pending_installment_count"] == 1
        with transaction(connection):
            connection.execute("DELETE FROM sip_plan_summaries")
        rebuilt_missing = service.list_plan_summaries()
        assert len(rebuilt_missing) == 1
        assert rebuilt_missing[0]["sip_plan_id"] == pending["sip_plan_id"]
        with transaction(connection):
            connection.execute(
                "UPDATE sip_plan_summaries SET calculation_version=99 WHERE sip_plan_id=?",
                (pending["sip_plan_id"],),
            )
        assert service.list_plan_summaries()[0]["calculation_version"] == 1
        with pytest.raises(ValueError, match="no invested principal"):
            service.delete_event(row_id=pending["row_id"])
        assert connection.execute(
            "SELECT 1 FROM sip_transactions WHERE row_id=?", (pending["row_id"],)
        ).fetchone() is not None
        assert connection.execute(
            "SELECT 1 FROM deleted_records WHERE row_id=?", (pending["row_id"],)
        ).fetchone() is None
        with pytest.raises(ValueError, match="not found"):
            service.redeem_plan(
                sip_plan_id="00000000-0000-0000-0000-000000000001",
                entry_date=date(2025, 2, 1), amount_received=Decimal("1"),
            )
    finally:
        connection.close()
