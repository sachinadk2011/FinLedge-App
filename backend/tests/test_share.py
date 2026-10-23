"""
test_share.py — Module: Share Portfolio
Tests: add (ipo/buy/sell/dividend), list, update allotment, delete, edge cases.

API shapes:
  POST /share/add              → {"message": ..., "data": {record_id, ...}}
  GET  /share/data             → {"records": [...], "summary": {...}}
  PUT  /share/update-allotment → {"message": ..., "data": {...}}
  DEL  /share/delete/id        → {"message": ...}

Share payload contracts (from models.py union type):
  IPO:      category, date, share_name, per_unit_price, asba_charge, allotted, buy_sell="buy"
  Buy:      category, date, share_name, per_unit_price, quantity, buy_sell
  Sell:     category, date, share_name, per_unit_price, quantity, buy_sell="sell"
  Dividend: category, date, share_name, dividend_type ("cash"|"bonus"), per_unit_price, quantity
  SIP:      category, date, share_name, per_unit_price, installment_amount, buy_sell
"""
import pytest
from fastapi.testclient import TestClient


def get_records(client) -> list:
    r = client.get("/share/data")
    assert r.status_code == 200
    return r.json()["records"]


def add_share(client, payload: dict) -> dict:
    r = client.post("/share/add", json=payload)
    assert r.status_code == 200, r.text
    return r.json()["data"]


# ---------------------------------------------------------------------------
# 1. Add — all category types
# ---------------------------------------------------------------------------

class TestShareAdd:
    def test_add_ipo(self, client):
        data = add_share(client, {
            "category": "ipo",
            "date": "2025-03-01",
            "share_name": "NHPC LTD",
            "per_unit_price": 100.0,
            "asba_charge": 20.0,
            "allotted": 0,
            "buy_sell": "buy",
        })
        assert data["category"] == "ipo"
        assert data["share_name"] == "NHPC LTD"

    def test_add_secondary_buy(self, client):
        data = add_share(client, {
            "category": "buy",
            "date": "2025-03-15",
            "share_name": "NHPC LTD",
            "per_unit_price": 120.0,
            "allotted": 10,
            "quantity": 10,
            "buy_sell": "buy",
        })
        assert data["category"] == "buy"
        # total_amount should be price × qty
        assert float(data["total_amount"]) == pytest.approx(120.0 * 10, rel=0.01)

    def test_add_sell(self, client):
        data = add_share(client, {
            "category": "sell",
            "date": "2025-04-01",
            "share_name": "NHPC LTD",
            "per_unit_price": 150.0,
            "allotted": 5,
            "quantity": 5,
            "buy_sell": "sell",
        })
        assert data["category"] == "sell"

    def test_add_cash_dividend(self, client):
        # Cash dividend: needs 'amount' (total cash payout), buy_sell='cash'
        data = add_share(client, {
            "category": "dividend",
            "date": "2025-04-10",
            "share_name": "NHPC LTD",
            "buy_sell": "cash",
            "amount": 1500.0,     # total cash dividend amount
        })
        assert data["category"] == "dividend"

    def test_add_bonus_dividend(self, client):
        # Bonus dividend: needs 'bonus_shares' (extra shares issued), buy_sell='bonus'
        data = add_share(client, {
            "category": "dividend",
            "date": "2025-05-01",
            "share_name": "NHPC LTD",
            "buy_sell": "bonus",
            "bonus_shares": 5,
        })
        assert data["category"] == "dividend"

    def test_invalid_category_rejected(self, client):
        r = client.post("/share/add", json={
            "category": "unknown_cat",
            "date": "2025-03-01",
            "share_name": "TEST",
            "per_unit_price": 100.0,
            "quantity": 10,
            "buy_sell": "buy",
        })
        assert r.status_code == 422

    def test_negative_price_rejected(self, client):
        r = client.post("/share/add", json={
            "category": "buy",
            "date": "2025-03-01",
            "share_name": "TEST",
            "per_unit_price": -10.0,
            "quantity": 5,
            "buy_sell": "buy",
        })
        assert r.status_code in (400, 422)

    def test_zero_quantity_rejected(self, client):
        r = client.post("/share/add", json={
            "category": "buy",
            "date": "2025-03-01",
            "share_name": "TEST",
            "per_unit_price": 100.0,
            "quantity": 0,
            "buy_sell": "buy",
        })
        assert r.status_code in (400, 422)


# ---------------------------------------------------------------------------
# 2. List
# ---------------------------------------------------------------------------

class TestShareList:
    def test_list_has_records_and_summary(self, client):
        j = client.get("/share/data").json()
        assert "records" in j
        assert "summary" in j

    def test_records_not_empty(self, client):
        assert len(get_records(client)) > 0

    def test_records_have_required_fields(self, client):
        rec = get_records(client)[0]
        for field in ("id", "date", "share_name", "category",
                      "per_unit_price", "allotted", "buy_sell", "total_amount"):
            assert field in rec, f"Missing field: {field}"

    def test_cumulative_profit_present(self, client):
        for rec in get_records(client):
            assert "cumulative_profit" in rec


# ---------------------------------------------------------------------------
# 3. Update allotment
# ---------------------------------------------------------------------------

class TestShareAllotment:
    def test_update_ipo_allotment(self, client):
        # Add a fresh IPO
        data = add_share(client, {
            "category": "ipo",
            "date": "2025-05-01",
            "share_name": "ALLOT TEST",
            "per_unit_price": 100.0,
            "asba_charge": 10.0,
            "allotted": 0,
            "buy_sell": "buy",
        })
        rec_id = data["id"]
        r = client.put("/share/update-allotment", json={
            "record_id": rec_id,
            "share_name": "ALLOT TEST",
            "allotted": 20,
        })
        assert r.status_code == 200
        assert r.json()["data"]["allotted"] == 20

    def test_update_invalid_id_rejected(self, client):
        r = client.put("/share/update-allotment", json={"record_id": 999999, "allotted": 5})
        assert r.status_code in (400, 422)


# ---------------------------------------------------------------------------
# 4. Delete
# ---------------------------------------------------------------------------

class TestShareDelete:
    def test_delete_existing_record(self, client):
        data = add_share(client, {
            "category": "buy",
            "date": "2025-06-01",
            "share_name": "DELETE TEST",
            "per_unit_price": 90.0,
            "allotted": 3,
            "quantity": 3,
            "buy_sell": "buy",
        })
        rec_id = data["id"]
        r = client.delete(f"/share/delete/{rec_id}")
        assert r.status_code == 200
        ids = {rec["id"] for rec in get_records(client)}
        assert rec_id not in ids

    def test_delete_invalid_id_rejected(self, client):
        r = client.delete("/share/delete/999999")
        assert r.status_code in (400, 422)
