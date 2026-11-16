from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

from backend.db.core import connect_database, migrate_database
from backend.services.sip import SQLiteSipService


def _service(path: Path) -> tuple[object, SQLiteSipService]:
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection, SQLiteSipService(connection, device="desktop-test")


def test_pending_unit_suggestions_are_limited_to_first_installment_per_plan(tmp_path: Path):
    connection, service = _service(tmp_path / "pending-units.db")
    try:
        first = service.create_installment(
            entry_date=date(2026, 1, 1), investment_name="Alpha SIP", amount=Decimal("100")
        )
        second = service.create_installment(
            entry_date=date(2026, 2, 1), investment_name="Alpha SIP", amount=Decimal("100")
        )
        other = service.create_installment(
            entry_date=date(2026, 1, 15), investment_name="Beta SIP", amount=Decimal("50")
        )

        suggestions = service.list_pending_unit_suggestions()

        assert [item["row_id"] for item in suggestions] == [first["row_id"], other["row_id"]]
        assert second["row_id"] not in {item["row_id"] for item in suggestions}
        assert all(item["transaction_type"] == "sip_installment" for item in suggestions)
    finally:
        connection.close()


def test_redemption_is_never_a_pending_unit_suggestion(tmp_path: Path):
    connection, service = _service(tmp_path / "pending-redemption.db")
    try:
        installment = service.create_installment(
            entry_date=date(2026, 1, 1), investment_name="Closed SIP", amount=Decimal("100")
        )
        service.redeem_plan(
            sip_plan_id=installment["sip_plan_id"],
            entry_date=date(2026, 2, 1),
            amount_received=Decimal("110"),
        )

        suggestions = service.list_pending_unit_suggestions()

        assert [item["row_id"] for item in suggestions] == [installment["row_id"]]
        assert all(item["transaction_type"] != "sip_redemption" for item in suggestions)
    finally:
        connection.close()


def test_entered_units_remove_first_installment_from_suggestions(tmp_path: Path):
    connection, service = _service(tmp_path / "pending-entered.db")
    try:
        first = service.create_installment(
            entry_date=date(2026, 1, 1), investment_name="Updated SIP", amount=Decimal("100")
        )
        service.create_installment(
            entry_date=date(2026, 2, 1), investment_name="Updated SIP", amount=Decimal("100")
        )
        service.update_installment(
            row_id=first["row_id"], entry_date=date(2026, 1, 1), amount=Decimal("100"),
            charge=Decimal(0), units=10,
        )

        assert service.list_pending_unit_suggestions() == []
    finally:
        connection.close()
