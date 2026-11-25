from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
import pytest

from backend.db.imports.share import stage_share_workbook


HEADERS = [
    "Date", "Share Name", "Category", "Per Unit Price", "Charge", "Allotted", "Buy/Sell",
    "Total Amount", "Profit/Loss", "Cumulative Profit", "Created Timestamp",
    "Last Updated Timestamp", "Updated Device", "Row ID", "Content Hash",
]


def _workbook(path: Path, rows: list[list[object]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Share"
    sheet.append(HEADERS)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def test_share_staging_maps_legacy_shapes_and_plan_identity_without_mutation(tmp_path: Path):
    path = tmp_path / "share_transactions.xlsx"
    rows = [
        ["2025-01-01", " Alpha  bank ", "ipo", 10, None, 0, "ipo", 10, 0, 0, None, None, "desktop", None, None],
        ["2025-01-02", "ALPHA BANK", "buy", 10, 0, 10, "buy", 100, 0, 0, None, None, "desktop-test", None, None],
        ["2025-01-03", "ALPHA BANK", "sell", 12, 1, 2, "sell", 23, 3, 0, None, None, "desktop-test", None, None],
        ["2025-01-04", "ALPHA BANK", "dividend", 0, 0, 2, "bonus", 0, 0, 0, None, None, "desktop-test", None, None],
        ["2025-01-05", "Index Fund", "sip", 1000, 0, 0, "installment", 1000, 0, 0, None, None, "desktop-test", None, None],
        ["2025-01-06", "Index Fund", "sip", 1100, 10, 0, "redeem", 1090, 90, 0, None, None, "desktop-test", None, None],
    ]
    _workbook(path, rows)
    before = path.read_bytes()

    plan = stage_share_workbook(path)

    assert path.read_bytes() == before
    assert plan.counts_by_status == {"ready": 6, "unsupported": 0, "invalid": 0, "possible_duplicate": 0}
    ipo, buy, sell, bonus, sip_buy, sip_redeem = plan.records
    assert ipo.share_name == "ALPHA BANK" and ipo.charge_scaled == 50_000 and ipo.quantity is None
    assert buy.entity_type == "share" and buy.event_type == "buy" and buy.quantity == 10
    assert sell.charge_scaled == 10_000 and sell.content_hash and sell.entity_type == "share"
    assert bonus.entity_type == "dividend" and bonus.event_type == "bonus" and bonus.quantity == 2
    assert sip_buy.entity_type == "sip" and sip_buy.event_type == "sip_installment"
    assert sip_redeem.amount_scaled == 10_900_000 and sip_buy.sip_plan_id == sip_redeem.sip_plan_id
    assert sip_buy.content_hash and sip_redeem.content_hash


def test_share_staging_marks_redemption_without_open_plan_invalid(tmp_path: Path):
    path = tmp_path / "share_transactions.xlsx"
    _workbook(path, [
        ["2025-01-01", "Index Fund", "sip", 100, 0, 0, "redeem", 100, 0, 0, None, None, None, None, None],
    ])

    plan = stage_share_workbook(path)

    assert plan.records[0].status == "invalid"
    assert plan.records[0].issues[-1].code == "sip_redemption_without_plan"


def test_share_staging_rejects_missing_required_header_and_ambiguous_headers(tmp_path: Path):
    missing = tmp_path / "missing.xlsx"
    workbook = Workbook()
    workbook.active.title = "Share"
    workbook.active.append(["Date", "Share Name"])
    workbook.save(missing)
    workbook.close()
    with pytest.raises(ValueError, match="missing required columns"):
        stage_share_workbook(missing)

    duplicate = tmp_path / "duplicate.xlsx"
    workbook = Workbook()
    workbook.active.title = "Share"
    workbook.active.append([*HEADERS, " share name "])
    workbook.save(duplicate)
    workbook.close()
    with pytest.raises(ValueError, match="duplicate or ambiguous"):
        stage_share_workbook(duplicate)
