"""
test_settings.py — Module: Settings (Import / Export)
Tests: data-type listing, has-data, import replace/merge,
       old-column alias, category migration on import, export (xlsx + zip).
"""
import io
import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _xlsx_bytes(sheet_title: str, headers: list, rows: list) -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = sheet_title
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO(); wb.save(buf)
    return buf.getvalue()


def _bank_xlsx(rows, headers=None) -> bytes:
    return _xlsx_bytes("Bank", headers or ["Date", "Category", "Amount"], rows)


def _old_bank_xlsx(rows) -> bytes:
    """Old export: 'Cumulative Total' instead of 'Cumulative Amount', no Description."""
    return _xlsx_bytes("Bank", ["Date", "Category", "Amount", "Cumulative Total"], rows)


def get_bank_records(client) -> list:
    return client.get("/bank/data").json()["records"]


# ---------------------------------------------------------------------------
# 1. GET /settings/data-types
# ---------------------------------------------------------------------------

class TestSettingsDataTypes:
    def test_returns_all_four_types(self, client):
        r = client.get("/settings/data-types")
        assert r.status_code == 200
        ids = {dt["id"] for dt in r.json()["data_types"]}
        assert ids == {"bank", "share", "pf-bank", "pf-cash", "pf-transfer"}

    def test_each_type_has_required_fields(self, client):
        for dt in client.get("/settings/data-types").json()["data_types"]:
            for field in ("id", "label", "required_headers"):
                assert field in dt
            assert isinstance(dt["required_headers"], list)
            assert len(dt["required_headers"]) > 0

    def test_bank_minimal_required_headers(self, client):
        r = client.get("/settings/data-types")
        bank = next(dt for dt in r.json()["data_types"] if dt["id"] == "bank")
        assert set(bank["required_headers"]) == {"Date", "Category", "Amount"}


def test_meta_categories_match_backend_enums(client):
    from backend.models import BankCategory, PF_EXPENSE_CATEGORIES, PF_INCOME_CATEGORIES, PersonalFinanceCategory

    response = client.get("/meta/categories")
    assert response.status_code == 200
    payload = response.json()
    assert payload["bank_categories"] == [category.value for category in BankCategory]
    assert payload["personal_finance_expense_categories"] == [category.value for category in PersonalFinanceCategory if category in PF_EXPENSE_CATEGORIES]
    assert payload["personal_finance_income_categories"] == [category.value for category in PersonalFinanceCategory if category in PF_INCOME_CATEGORIES]

# ---------------------------------------------------------------------------
# 2. GET /settings/has-data/{data_type}
# ---------------------------------------------------------------------------

class TestSettingsHasData:
    def test_valid_type_responds(self, client):
        r = client.get("/settings/has-data/bank")
        assert r.status_code == 200
        assert "has_data" in r.json()

    def test_invalid_type_returns_400(self, client):
        r = client.get("/settings/has-data/invalid_type")
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# 3. POST /settings/import/{data_type} — replace mode
# ---------------------------------------------------------------------------

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class TestSettingsImportReplace:
    def test_import_current_format(self, client):
        xlsx = _bank_xlsx([
            ["2025-06-01", "Interest Earned", 300.0],
            ["2025-06-15", "Mobile Banking Charge", -100.0],
        ])
        r = client.post(
            "/settings/import/bank",
            files={"file": ("bank.xlsx", xlsx, XLSX_MIME)},
            data={"mode": "replace"},
        )
        assert r.status_code == 200, r.text
        result = r.json()["data"]
        assert result["imported_rows"] == 2
        assert result["mode"] == "replace"

    def test_import_old_column_alias_accepted(self, client):
        """'Cumulative Total' must be aliased to 'Cumulative Amount' — not rejected."""
        xlsx = _old_bank_xlsx([
            ["2025-07-01", "Interest Earned", 500.0, 500.0],
            ["2025-07-15", "Other Charges", -100.0, 400.0],
        ])
        r = client.post(
            "/settings/import/bank",
            files={"file": ("old_bank.xlsx", xlsx, XLSX_MIME)},
            data={"mode": "replace"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["data"]["imported_rows"] == 2

    def test_import_old_categories_migrated(self, client):
        """Legacy 'Service Cost' and 'ATM Charge' must NOT survive in stored data."""
        xlsx = _old_bank_xlsx([
            ["2025-08-01", "Service Cost", -50.0, -50.0],
            ["2025-08-02", "ATM Charge", -30.0, -80.0],
        ])
        client.post(
            "/settings/import/bank",
            files={"file": ("old2.xlsx", xlsx, XLSX_MIME)},
            data={"mode": "replace"},
        )
        cats = {rec["category"] for rec in get_bank_records(client)}
        assert "Service Cost" not in cats, "Legacy 'Service Cost' survived import"
        assert "ATM Charge" not in cats, "Retired 'ATM Charge' survived import"

    def test_import_missing_required_column_rejected(self, client):
        """File missing 'Amount' must be rejected with 400."""
        xlsx = _xlsx_bytes("Bank", ["Date", "Category"], [["2025-01-01", "Interest Earned"]])
        r = client.post(
            "/settings/import/bank",
            files={"file": ("bad.xlsx", xlsx, XLSX_MIME)},
            data={"mode": "replace"},
        )
        assert r.status_code == 400
        assert "Amount" in r.json()["detail"]

    def test_import_cumulative_recalculated(self, client):
        """After replace import the cumulative chain must be correct in stored data."""
        xlsx = _bank_xlsx([
            ["2025-09-01", "Interest Earned", 1000.0],
            ["2025-09-15", "Mobile Banking Charge", -200.0],
            ["2025-10-01", "Interest Earned", 500.0],
        ])
        client.post(
            "/settings/import/bank",
            files={"file": ("chain.xlsx", xlsx, XLSX_MIME)},
            data={"mode": "replace"},
        )
        records = get_bank_records(client)
        running = 0.0
        for rec in records:
            running += rec["amount"]
            assert abs(rec["cumulative_amount"] - running) < 0.01


# ---------------------------------------------------------------------------
# 4. POST /settings/import/{data_type} — merge mode
# ---------------------------------------------------------------------------

class TestSettingsImportMerge:
    def test_merge_appends_new_rows(self, client):
        # Baseline: replace with 1 row
        client.post(
            "/settings/import/bank",
            files={"file": ("base.xlsx", _bank_xlsx([["2025-09-01", "Interest Earned", 200.0]]), XLSX_MIME)},
            data={"mode": "replace"},
        )
        before_count = len(get_bank_records(client))

        # Merge 2 more
        client.post(
            "/settings/import/bank",
            files={"file": ("extra.xlsx", _bank_xlsx([
                ["2025-10-01", "Cheque Book", -50.0],
                ["2025-10-15", "Interest Earned", 100.0],
            ]), XLSX_MIME)},
            data={"mode": "merge"},
        )
        assert len(get_bank_records(client)) == before_count + 2

    def test_merge_cumulative_still_correct(self, client):
        records = get_bank_records(client)
        running = 0.0
        for rec in records:
            running += rec["amount"]
            assert abs(rec["cumulative_amount"] - running) < 0.01


# ---------------------------------------------------------------------------
# 5. Export
# ---------------------------------------------------------------------------

class TestSettingsExport:
    def test_export_bank_returns_xlsx(self, client):
        r = client.get("/settings/export/bank")
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "spreadsheetml" in ct or "octet-stream" in ct

    def test_export_all_returns_zip(self, client):
        r = client.get("/settings/export-all")
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "zip" in ct or "octet-stream" in ct
