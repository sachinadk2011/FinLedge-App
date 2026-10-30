"""
test_personal_finance.py — Module: Personal Expenses
Tests: add (bank/cash flow, income/expense), list, update, delete,
       signed amount direction, synced-row read-only check.

API shapes:
  POST /personal-finance/add               → {"message": ..., "data": {date, flow_type, ...}}
  GET  /personal-finance/data?flow_type=   → {"records": [...], "summary": {...}}
  PUT  /personal-finance/update/flow/id    → {"message": ..., "data": {...}}
  DEL  /personal-finance/delete/flow/id   → {"message": ...}

Synced rows: source = "bank-services-sync" or "share-sync"
  id = e.g. "bank-services-3" (non-null string) — frontend uses source != "manual" to hide buttons
"""
import pytest
from fastapi.testclient import TestClient

BANK_INCOME = {
    "date": "2025-05-01", "flow_type": "bank", "direction": "income",
    "category": "Salary", "amount": 50000.0, "description": "May salary",
}
BANK_EXPENSE = {
    "date": "2025-05-05", "flow_type": "bank", "direction": "expense",
    "category": "Bills", "amount": 1200.0, "description": "Electricity",
}
CASH_INCOME = {
    "date": "2025-05-10", "flow_type": "cash", "direction": "income",
    "category": "Gift", "amount": 5000.0, "description": "Gift",
}
CASH_EXPENSE = {
    "date": "2025-05-12", "flow_type": "cash", "direction": "expense",
    "category": "Food", "amount": 800.0, "description": "Groceries",
}


def add_pf(client, payload: dict) -> dict:
    r = client.post("/personal-finance/add", json=payload)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def get_records(client, flow_type="bank") -> list:
    return client.get(f"/personal-finance/data?flow_type={flow_type}").json()["records"]


# ---------------------------------------------------------------------------
# 1. Add
# ---------------------------------------------------------------------------

class TestPFAdd:
    def test_bank_income_signed_positive(self, client):
        data = add_pf(client, BANK_INCOME)
        assert data["direction"] == "income"
        assert data["signed_amount"] > 0

    def test_bank_expense_signed_negative(self, client):
        data = add_pf(client, BANK_EXPENSE)
        assert data["direction"] == "expense"
        assert data["signed_amount"] < 0

    def test_cash_income(self, client):
        data = add_pf(client, CASH_INCOME)
        assert data["flow_type"] == "cash"
        assert data["signed_amount"] > 0

    def test_cash_expense(self, client):
        data = add_pf(client, CASH_EXPENSE)
        assert data["flow_type"] == "cash"
        assert data["signed_amount"] < 0

    def test_signed_amount_magnitude_matches_amount(self, client):
        data = add_pf(client, {**BANK_INCOME, "amount": 1000.0})
        assert abs(data["signed_amount"]) == pytest.approx(1000.0)

    def test_invalid_flow_type_rejected(self, client):
        r = client.post("/personal-finance/add", json={**BANK_INCOME, "flow_type": "savings"})
        assert r.status_code == 422

    def test_invalid_direction_rejected(self, client):
        r = client.post("/personal-finance/add", json={**BANK_INCOME, "direction": "neutral"})
        assert r.status_code == 422

    def test_invalid_category_rejected(self, client):
        r = client.post("/personal-finance/add", json={**BANK_INCOME, "category": "FakeCat"})
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# 2. List
# ---------------------------------------------------------------------------

class TestPFList:
    def test_bank_flow_has_records_and_summary(self, client):
        j = client.get("/personal-finance/data?flow_type=bank").json()
        assert "records" in j
        assert "summary" in j

    def test_cash_flow_has_records_and_summary(self, client):
        j = client.get("/personal-finance/data?flow_type=cash").json()
        assert "records" in j

    def test_records_have_required_fields(self, client):
        rec = get_records(client, "bank")[0]
        for field in ("id", "date", "flow_type", "direction", "category",
                      "amount", "signed_amount", "description", "source"):
            assert field in rec, f"Missing field: {field}"

    def test_synced_rows_source_values_valid(self, client):
        """All synced rows must have a recognised source value."""
        valid_sources = {"manual", "bank-services-sync", "share-sync"}
        for rec in get_records(client, "bank"):
            assert rec["source"] in valid_sources, (
                f"Unknown source: {rec['source']}"
            )

    def test_synced_rows_non_manual_id_not_int(self, client):
        """Synced rows' id must NOT be a plain integer — UI uses this to gate edit/delete."""
        for rec in get_records(client, "bank"):
            if rec["source"] != "manual":
                # id should be a string like "bank-services-1", not an integer
                assert not isinstance(rec["id"], int), (
                    f"Synced row source={rec['source']} has numeric id={rec['id']} — "
                    "UI would incorrectly show edit/delete buttons"
                )


# ---------------------------------------------------------------------------
# 3. Update
# ---------------------------------------------------------------------------

class TestPFUpdate:
    def test_update_description(self, client):
        entry = add_pf(client, {**BANK_INCOME, "description": "original"})
        records = get_records(client, "bank")
        manual = [r for r in records if r["source"] == "manual" and r["description"] == "original"]
        assert manual, "Added record not found in list"
        rec = manual[0]
        r = client.put(
            f"/personal-finance/update/bank/{rec['id']}",
            json={**BANK_INCOME, "description": "updated"},
        )
        assert r.status_code == 200
        assert r.json()["data"]["description"] == "updated"

    def test_update_invalid_id_rejected(self, client):
        r = client.put("/personal-finance/update/bank/999999", json=BANK_INCOME)
        assert r.status_code in (400, 422)


# ---------------------------------------------------------------------------
# 4. Delete
# ---------------------------------------------------------------------------

class TestPFDelete:
    def test_delete_bank_manual_record(self, client):
        entry = add_pf(client, {**BANK_INCOME, "description": "to delete bank"})
        records = get_records(client, "bank")
        rec = next(r for r in records
                   if r["source"] == "manual" and r["description"] == "to delete bank")
        r = client.delete(f"/personal-finance/delete/bank/{rec['id']}")
        assert r.status_code == 200
        ids_after = {r["id"] for r in get_records(client, "bank") if r["source"] == "manual"}
        assert rec["id"] not in ids_after

    def test_delete_cash_manual_record(self, client):
        entry = add_pf(client, {**CASH_EXPENSE, "description": "to delete cash"})
        records = get_records(client, "cash")
        rec = next(r for r in records
                   if r["source"] == "manual" and r["description"] == "to delete cash")
        r = client.delete(f"/personal-finance/delete/cash/{rec['id']}")
        assert r.status_code == 200

    def test_delete_invalid_id_rejected(self, client):
        r = client.delete("/personal-finance/delete/bank/999999")
        assert r.status_code in (400, 422)
