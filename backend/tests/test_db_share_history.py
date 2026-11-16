from __future__ import annotations

import sqlite3
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from backend.db.core import connect_database, migrate_database
from backend.db.share import list_share_history
from backend.services.share import SQLiteShareService
from backend.services.sip import SQLiteSipService


def test_unified_history_is_stable_filtered_paginated_and_keeps_source_identity(tmp_path: Path):
    connection = connect_database(tmp_path / "share-history.db", create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    share = SQLiteShareService(connection, device="desktop-test")
    sip = SQLiteSipService(connection, device="desktop-test")
    event_date = date(2025, 2, 10)
    try:
        first_buy = share.create_share_transaction(
            entry_date=event_date, share_name=" CMF2 ", transaction_type="buy",
            per_unit_price=Decimal("10"), quantity=10,
        )
        dividend = share.create_dividend_event(
            entry_date=event_date, share_name="cmf2", event_type="cash",
            cash_amount=Decimal("5"),
        )
        second_buy = share.create_share_transaction(
            entry_date=event_date, share_name="CMF2", transaction_type="buy",
            per_unit_price=Decimal("12"), quantity=2,
        )
        installment = sip.create_installment(
            entry_date=event_date, investment_name="CMF2 SIP", amount=Decimal("100"),
            units=5,
        )

        history = share.list_history()
        assert [(row["entity_type"], row["row_id"]) for row in history] == [
            ("share", first_buy["row_id"]),
            ("dividend", dividend["row_id"]),
            ("share", second_buy["row_id"]),
            ("sip", installment["row_id"]),
        ]
        assert share.list_history() == history
        assert history[-1]["amount"] == Decimal("100")
        assert history[-1]["sip_plan_id"] == installment["sip_plan_id"]
        assert share.list_history(investment_name="cmf2") == history[:3]
        assert share.list_history(limit=2, offset=1) == history[1:3]
        assert [dict(row) for row in list_share_history(connection, limit=1)] == [
            dict(connection.execute(
                "SELECT * FROM v_share_history WHERE row_id = ?", (first_buy["row_id"],)
            ).fetchone())
        ]

        source_tables = {"share": "share_transactions", "dividend": "dividend_events", "sip": "sip_transactions"}
        for row in history:
            source = connection.execute(
                f"SELECT row_id FROM {source_tables[row['entity_type']]} WHERE row_id = ?",
                (row["row_id"],),
            ).fetchone()
            assert source is not None

        with pytest.raises(ValueError, match="limit must be"):
            share.list_history(limit=0)
        with pytest.raises(ValueError, match="limit must be"):
            list_share_history(connection, offset=-1)
        with pytest.raises(sqlite3.OperationalError):
            connection.execute(
                "UPDATE v_share_history SET transaction_type='changed' WHERE row_id=?",
                (first_buy["row_id"],),
            )
    finally:
        connection.close()
