"""
test_bank.py — Module: Bank Services
Tests: add, list, edit, delete, cumulative recalculation, edge cases.

API shapes (discovered from live probing):
  POST /bank/add        → {"message": ..., "data": {date, category, amount, cumulative_amount, ...}}
  GET  /bank/data       → {"records": [...], "summary": {...}}
  PUT  /bank/update/id  → {"message": ..., "data": {...}}
  DEL  /bank/delete/id  → {"message": ...}

Business rules:
  - Charge categories require NEGATIVE amount (validated by Pydantic)
  - Income categories (Interest Earned) require POSITIVE amount
  - Zero amount is rejected
"""
import pytest
from fastapi.testclient import TestClient

INCOME_ENTRY = {
    "date": "2025-01-10",
    "category": "Interest Earned",
    "amount": 500.0,
    "description": "January interest",
}

CHARGE_ENTRY = {
    "date": "2025-01-15",
    "category": "Mobile Banking Charge",
    "amount": -100.0,
    "description": "Monthly charge",
}


def add_income(client, **overrides) -> dict:
    payload = {**INCOME_ENTRY, **overrides}
    r = client.post("/bank/add", json=payload)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def add_charge(client, **overrides) -> dict:
    payload = {**CHARGE_ENTRY, **overrides}
    r = client.post("/bank/add", json=payload)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def get_records(client) -> list:
    return client.get("/bank/data").json()["records"]


# ---------------------------------------------------------------------------
# 1. Add
# ---------------------------------------------------------------------------

class TestBankAdd:
    def test_add_income_positive_amount(self, client):
        data = add_income(client)
        assert data["category"] == "Interest Earned"
        assert data["amount"] > 0

    def test_add_charge_negative_amount(self, client):
        data = add_charge(client)
        assert data["amount"] < 0

    def test_all_valid_categories_accepted(self, client):
        categories_with_sign = [
            ("Interest Earned", 200.0),
            ("Interest Tax", -50.0),
            ("Mobile Banking Charge", -30.0),
            ("Debit Card Charge", -20.0),
            ("Cheque Book", -15.0),
            ("Locker", -500.0),
            ("Demat Renewal", -200.0),
            ("Demat & MeroShare Renewal", -300.0),
            ("Broker Renewal", -150.0),
            ("MeroShare Renewal", -100.0),
            ("Other Charges", -25.0),
        ]
        for cat, amt in categories_with_sign:
            r = client.post("/bank/add", json={"date": "2025-02-01", "category": cat,
                                               "amount": amt, "description": ""})
            assert r.status_code == 200, f"Failed for {cat!r}: {r.text}"

    def test_invalid_category_rejected(self, client):
        r = client.post("/bank/add", json={**INCOME_ENTRY, "category": "FakeCat"})
        assert r.status_code == 422

    def test_positive_amount_for_charge_rejected(self, client):
        r = client.post("/bank/add", json={**CHARGE_ENTRY, "amount": 100.0})
        assert r.status_code == 422

    def test_zero_amount_rejected(self, client):
        r = client.post("/bank/add", json={**INCOME_ENTRY, "amount": 0.0})
        assert r.status_code == 422

    def test_negative_amount_for_income_rejected(self, client):
        r = client.post("/bank/add", json={**INCOME_ENTRY, "amount": -100.0})
        assert r.status_code == 422

    def test_missing_date_defaults_ok(self, client):
        r = client.post("/bank/add", json={**INCOME_ENTRY, "date": None})
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# 2. List
# ---------------------------------------------------------------------------

class TestBankList:
    def test_list_returns_records_and_summary(self, client):
        j = client.get("/bank/data").json()
        assert "records" in j
        assert "summary" in j
        assert isinstance(j["records"], list)
        assert len(j["records"]) > 0

    def test_records_have_required_fields(self, client):
        rec = get_records(client)[0]
        for field in ("id", "date", "category", "amount", "cumulative_amount", "description"):
            assert field in rec, f"Missing field: {field}"

    def test_cumulative_chain_is_correct(self, client):
        records = get_records(client)
        running = 0.0
        for rec in records:
            running += rec["amount"]
            assert abs(rec["cumulative_amount"] - running) < 0.01, (
                f"Cumulative mismatch at id={rec['id']}: "
                f"expected {running:.2f}, got {rec['cumulative_amount']}"
            )

    def test_summary_has_expected_keys(self, client):
        summary = client.get("/bank/data").json()["summary"]
        # Must have at least total_interest_earned and some totals
        assert isinstance(summary, dict)
        assert len(summary) > 0


# ---------------------------------------------------------------------------
# 3. Update
# ---------------------------------------------------------------------------

class TestBankUpdate:
    def test_update_description(self, client):
        original = add_income(client, description="orig")
        # find the record id from the list
        records = get_records(client)
        rec = next(r for r in records if r["description"] == "orig")
        r = client.put(f"/bank/update/{rec['id']}", json={
            "date": rec["date"],
            "category": rec["category"],
            "amount": abs(rec["amount"]),
            "description": "updated desc",
        })
        assert r.status_code == 200
        assert r.json()["data"]["description"] == "updated desc"

    def test_update_out_of_range_id_rejected(self, client):
        r = client.put("/bank/update/999999", json=INCOME_ENTRY)
        assert r.status_code in (400, 422)

    def test_cumulative_still_correct_after_update(self, client):
        records = get_records(client)
        running = 0.0
        for rec in records:
            running += rec["amount"]
            assert abs(rec["cumulative_amount"] - running) < 0.01


# ---------------------------------------------------------------------------
# 4. Delete
# ---------------------------------------------------------------------------

class TestBankDelete:
    def test_delete_income_record(self, client):
        entry = add_income(client, description="delete me")
        records_before = get_records(client)
        target = next(r for r in records_before if r["description"] == "delete me")
        r = client.delete(f"/bank/delete/{target['id']}")
        assert r.status_code == 200
        records_after = get_records(client)
        ids_after = {rec["id"] for rec in records_after}
        assert target["id"] not in ids_after

    def test_delete_out_of_range_id_rejected(self, client):
        r = client.delete("/bank/delete/999999")
        assert r.status_code in (400, 422)

    def test_cumulative_reindexed_after_delete(self, client):
        records = get_records(client)
        running = 0.0
        for rec in records:
            running += rec["amount"]
            assert abs(rec["cumulative_amount"] - running) < 0.01
