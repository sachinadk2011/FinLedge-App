from openpyxl import Workbook, load_workbook
import pytest
from pathlib import Path
from datetime import date
from decimal import Decimal

from backend.services.data_migration_service import migrate_share_workbook
from backend.services.share_service import HEADERS, _recompute_sheet
from backend.services.share_lot_calculations import apply_weighted_average_transaction
from backend.services.share_summary import summarize_share_records
from backend.services import share_service


def test_weighted_average_required_example():
    holdings = {}
    apply_weighted_average_transaction(holdings, "cmf2", "buy", 600, acquisition_cost=6000)
    assert holdings["cmf2"] == {"quantity": 600.0, "cost": 6000.0}

    first_sale = apply_weighted_average_transaction(holdings, "cmf2", "sell", 200, sale_proceeds=2000)
    assert first_sale == pytest.approx(0)
    assert holdings["cmf2"] == {"quantity": 400.0, "cost": 4000.0}

    apply_weighted_average_transaction(holdings, "cmf2", "buy", 100, acquisition_cost=1100)
    assert holdings["cmf2"] == {"quantity": 500.0, "cost": 5100.0}

    final_sale = apply_weighted_average_transaction(holdings, "cmf2", "sell", 200, sale_proceeds=2090)
    assert final_sale == pytest.approx(50)
    assert holdings["cmf2"] == {"quantity": 300.0, "cost": 3060.0}


def test_bonus_shares_increase_quantity_without_adding_cost():
    holdings = {"cmf2": {"quantity": 400.0, "cost": 4000.0}}
    apply_weighted_average_transaction(holdings, "cmf2", "dividend", 10)
    assert holdings["cmf2"] == {"quantity": 410.0, "cost": 4000.0}
    assert holdings["cmf2"]["cost"] / holdings["cmf2"]["quantity"] == pytest.approx(9.75609756)


def test_sheet_replay_recalculates_sale_cost_after_history_change():
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Share"
    sheet.append(HEADERS)
    rows = [
        ["2025-01-01", "CMF2", "buy", "10", 0, 600, "buy", "6000", 0, 0, "a", "a", "desktop-dev", "id-1", "hash-1"],
        ["2025-01-02", "CMF2", "sell", "10.45", 0, 200, "sell", "2090", 0, 0, "b", "b", "desktop-dev", "id-2", "hash-2"],
        ["2025-01-03", "CMF2", "buy", "11", 0, 100, "buy", "1100", 0, 0, "c", "c", "desktop-dev", "id-3", "hash-3"],
        ["2025-01-04", "CMF2", "sell", "10.45", 0, 200, "sell", "2090", 0, 0, "d", "d", "desktop-dev", "id-4", "hash-4"],
    ]
    for row in rows:
        sheet.append(row)

    _recompute_sheet(sheet)

    assert float(sheet.cell(5, 9).value) == pytest.approx(50)
    assert float(sheet.cell(5, 10).value) == pytest.approx(140)
    # The first sale was processed before the later purchase, at a cost of NPR 2,000.
    assert float(sheet.cell(3, 9).value) == pytest.approx(90)
    # The final holding after replay is 300 shares with NPR 3,060 cost basis.
    assert sheet.max_row == 5
    workbook.close()


def test_sale_before_available_quantity_is_rejected():
    holdings = {}
    with pytest.raises(ValueError, match="Not enough available quantity"):
        apply_weighted_average_transaction(holdings, "cmf2", "sell", 1, sale_proceeds=10)


def test_share_summary_keeps_period_cash_metrics_separate_from_closing_cost():
    records = [
        {"date": "2025-01-01", "id": 1, "share_name": "CMF2", "category": "buy", "allotted": 600, "buy_sell": "buy", "total_amount": 6000, "profit_loss": 0, "holding_cost": 6000},
        {"date": "2025-01-02", "id": 2, "share_name": "CMF2", "category": "sell", "allotted": 200, "buy_sell": "sell", "total_amount": 2000, "profit_loss": 0, "holding_cost": 4000},
        {"date": "2025-01-03", "id": 3, "share_name": "CMF2", "category": "buy", "allotted": 100, "buy_sell": "buy", "total_amount": 1100, "profit_loss": 0, "holding_cost": 5100},
        {"date": "2025-01-04", "id": 4, "share_name": "CMF2", "category": "sell", "allotted": 200, "buy_sell": "sell", "total_amount": 2090, "profit_loss": 50, "holding_cost": 3060},
        {"date": "2025-01-05", "id": 5, "share_name": "CMF2", "category": "dividend", "allotted": 10, "buy_sell": "bonus", "total_amount": 0, "profit_loss": 0, "holding_cost": 3060},
        {"date": "2025-01-06", "id": 6, "share_name": "CMF2", "category": "dividend", "allotted": 0, "buy_sell": "cash", "total_amount": 100, "profit_loss": 100, "holding_cost": 3060},
        {"date": "2025-01-07", "id": 7, "share_name": "ABC", "category": "sip", "allotted": 0, "buy_sell": "installment", "total_amount": 500, "profit_loss": 0, "holding_cost": 0},
        {"date": "2025-01-08", "id": 8, "share_name": "ABC", "category": "sip", "allotted": 0, "buy_sell": "redeem", "total_amount": 200, "profit_loss": 0, "holding_cost": 0},
    ]

    summary = summarize_share_records(records)

    assert summary["total_share_investment"] == pytest.approx(7100)
    assert summary["total_sell_proceeds"] == pytest.approx(4090)
    assert summary["cash_dividends_received"] == pytest.approx(100)
    assert summary["bonus_shares_received"] == 10
    assert summary["realized_trading_profit_loss"] == pytest.approx(50)
    assert summary["share_holding_cost"] == pytest.approx(3060)
    assert summary["share_net_cash_result"] == pytest.approx(-2910)
    assert summary["sip_unrecovered_capital"] == pytest.approx(300)
    assert summary["sip_net_cash_result"] == pytest.approx(-300)
    assert summary["grand_total_investment"] == pytest.approx(7600)
    assert summary["grand_holding_cost"] == pytest.approx(3360)
    assert summary["grand_total_received"] == pytest.approx(4390)
    assert summary["grand_net_cash_result"] == pytest.approx(-3210)


def test_share_summary_closing_position_stops_at_selected_end_date():
    all_records = [
        {"date": "2025-01-01", "id": 1, "share_name": "CMF2", "category": "buy", "buy_sell": "buy", "total_amount": 6000, "holding_cost": 6000},
        {"date": "2025-01-15", "id": 2, "share_name": "CMF2", "category": "sell", "buy_sell": "sell", "total_amount": 2000, "profit_loss": 100, "holding_cost": 4000},
        {"date": "2025-01-15", "id": 3, "share_name": "FUND", "category": "sip", "buy_sell": "installment", "total_amount": 500},
        {"date": "2025-01-15", "id": 4, "share_name": "FUND", "category": "sip", "buy_sell": "redeem", "total_amount": 200},
        {"date": "2025-02-01", "id": 5, "share_name": "CMF2", "category": "buy", "buy_sell": "buy", "total_amount": 3000, "holding_cost": 7000},
        {"date": "2025-02-01", "id": 6, "share_name": "FUND", "category": "sip", "buy_sell": "installment", "total_amount": 700},
    ]

    summary = summarize_share_records([all_records[1]], all_records, "2025-01-31")

    assert summary["total_sell_proceeds"] == pytest.approx(2000)
    assert summary["realized_trading_profit_loss"] == pytest.approx(100)
    assert summary["share_holding_cost"] == pytest.approx(4000)
    assert summary["sip_unrecovered_capital"] == pytest.approx(300)


def test_expected_all_time_accounting_totals_with_synthetic_records(tmp_path, monkeypatch):
    monkeypatch.setattr(share_service, "FILE_PATH", tmp_path / "share_transactions.xlsx")
    monkeypatch.setattr(share_service, "DATA_DIR", tmp_path)
    share_service.append_share_record(date(2026, 1, 1), "CORE", "buy", Decimal("100"), 100, "buy", Decimal("0"))
    share_service.append_share_record(date(2026, 1, 2), "CORE", "sell", Decimal("100"), 30, "sell", Decimal("0"))
    share_service.append_share_record(date(2026, 1, 3), "CORE", "dividend", Decimal("992.86"), 0, "cash")
    share_service.append_share_record(date(2026, 1, 4), "FUND", "sip", Decimal("5100"), 0, "installment", Decimal("0"))
    share_service.append_share_record(date(2026, 1, 5), "FUND", "sip", Decimal("3057.14"), 0, "redeem", Decimal("0"))

    records = share_service.read_share_records()
    summary = share_service.summarize_share_records(records, records, "2026-12-31")
    assert summary["grand_total_investment"] == pytest.approx(15100.00)
    assert summary["grand_total_received"] == pytest.approx(7050.00)
    assert summary["grand_net_cash_result"] == pytest.approx(-8050.00)
    assert summary["grand_holding_cost"] == pytest.approx(9042.86)


def test_share_service_add_edit_delete_replays_weighted_average(tmp_path, monkeypatch):
    monkeypatch.setattr(share_service, "FILE_PATH", tmp_path / "share_transactions.xlsx")
    monkeypatch.setattr(share_service, "DATA_DIR", tmp_path)

    share_service.append_share_record(date(2025, 1, 1), "CMF2", "buy", Decimal("10"), 600, "buy", Decimal("0"))
    share_service.append_share_record(date(2025, 1, 2), "CMF2", "sell", Decimal("10"), 200, "sell", Decimal("0"))
    share_service.append_share_record(date(2025, 1, 3), "CMF2", "buy", Decimal("11"), 100, "buy", Decimal("0"))
    share_service.append_share_record(date(2025, 1, 4), "CMF2", "sell", Decimal("10.45"), 200, "sell", Decimal("0"))

    records = share_service.read_share_records()
    assert [record["profit_loss"] for record in records] == pytest.approx([0, 0, 0, 50])
    assert records[-1]["holding_quantity"] == 300
    assert records[-1]["holding_cost"] == pytest.approx(3060)

    share_service.update_share_record(
        record_id=3,
        entry_date=date(2025, 1, 3),
        share_name="CMF2",
        category="buy",
        per_unit_price=Decimal("12"),
        allotted=100,
        buy_sell="buy",
        charge=Decimal("0"),
    )
    updated_records = share_service.read_share_records()
    assert updated_records[-1]["profit_loss"] == pytest.approx(10)
    assert updated_records[-1]["holding_cost"] == pytest.approx(3120)

    share_service.delete_share_record(record_id=3)
    remaining_records = share_service.read_share_records()
    assert len(remaining_records) == 3
    assert remaining_records[-1]["profit_loss"] == pytest.approx(90)
    assert remaining_records[-1]["holding_quantity"] == 200
    assert remaining_records[-1]["holding_cost"] == pytest.approx(2000)


def _write_legacy_share_workbook(path: Path, headers: list[str], row: list):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Share"
    sheet.append(headers)
    sheet.append(row)
    workbook.save(path)
    workbook.close()


def test_legacy_asba_charge_header_migrates_without_losing_row_metadata(tmp_path, monkeypatch):
    monkeypatch.setenv("FINLEDGE_BACKUP_DIR", str(tmp_path / "backups"))
    path = tmp_path / "share_transactions.xlsx"
    headers = [
        "Date", "Share Name", "Category", "Per Unit Price", "ASBA Charge", "Allotted",
        "Buy/Sell", "Total Amount", "Profit/Loss", "Cumulative Profit", "Created Timestamp",
        "Last Updated Timestamp", "Updated Device", "Row ID", "Content Hash",
    ]
    _write_legacy_share_workbook(path, headers, [
        "2025-01-01", "CMF2", "ipo", "10", 7, 100, "buy", 1007, 0, 0,
        "created", "updated", "desktop-dev", "stable-row-id", "stable-content-hash",
    ])

    result = migrate_share_workbook(tmp_path)

    workbook = load_workbook(path, data_only=True)
    try:
        sheet = workbook["Share"]
        assert result["status"] == "migrated"
        assert sheet.cell(1, 5).value == "Charge"
        assert sheet.cell(2, 5).value == 7
        assert sheet.cell(2, 14).value == "stable-row-id"
        assert sheet.cell(2, 15).value == "stable-content-hash"
    finally:
        workbook.close()


def test_conflicting_charge_columns_block_migration_without_overwriting(tmp_path, monkeypatch):
    monkeypatch.setenv("FINLEDGE_BACKUP_DIR", str(tmp_path / "backups"))
    path = tmp_path / "share_transactions.xlsx"
    headers = [
        "Date", "Share Name", "Category", "Per Unit Price", "Charge", "ASBA Charge", "Allotted",
        "Buy/Sell", "Total Amount", "Profit/Loss", "Cumulative Profit", "Created Timestamp",
        "Last Updated Timestamp", "Updated Device", "Row ID", "Content Hash",
    ]
    row = [
        "2025-01-01", "CMF2", "ipo", "10", 7, 5, 100, "buy", 1007, 0, 0,
        "created", "updated", "desktop-dev", "stable-row-id", "stable-content-hash",
    ]
    _write_legacy_share_workbook(path, headers, row)

    with pytest.raises(ValueError, match="Conflicting Charge and ASBA Charge"):
        migrate_share_workbook(tmp_path)

    workbook = load_workbook(path, data_only=True)
    try:
        sheet = workbook["Share"]
        assert sheet.cell(1, 5).value == "Charge"
        assert sheet.cell(1, 6).value == "ASBA Charge"
        assert sheet.cell(2, 5).value == 7
        assert sheet.cell(2, 6).value == 5
    finally:
        workbook.close()
