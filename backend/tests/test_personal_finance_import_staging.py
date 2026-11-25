from __future__ import annotations

import hashlib
from pathlib import Path

from openpyxl import Workbook
import pytest

from backend.db.imports import stage_personal_finance_workbook


HEADERS = [
    "Date", "Flow Type", "Direction", "Category", "Amount", "Signed Amount", "Description", "Source",
    "Created Timestamp", "Last Updated Timestamp", "Source Ref", "Updated Device", "Row ID", "Content Hash",
]


def _write(path: Path, rows: list[list[object]], *, sheet_name: str = "Bank Flow", headers=HEADERS) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = sheet_name
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def _row(*, flow="bank", direction="expense", category="Food", amount=12.34, signed=-12.34, source="manual", row_id=None):
    return [
        "2026-10-23", flow, direction, category, amount, signed, " Lunch  with team ", source,
        "2026-10-23T09:30:00Z", "2026-10-23T09:30:00Z", None, "desktop-dev", row_id, None,
    ]


def test_personal_finance_staging_normalizes_money_hash_and_derived_signed_amount(tmp_path: Path):
    path = tmp_path / "personal_finance_bank_flow.xlsx"
    row = _row(signed=999)
    _write(path, [row])
    before = hashlib.sha256(path.read_bytes()).hexdigest()

    plan = stage_personal_finance_workbook(path, flow_type="bank")

    staged = plan.records[0]
    assert plan.flow_type == "bank" and plan.sheet_name == "Bank Flow"
    assert staged.status == "ready"
    assert staged.sequence_no == 1 and staged.amount_scaled == 123_400
    assert staged.description == "Lunch  with team"
    assert staged.content_hash and staged.content_hash.startswith("sha256:")
    assert any(issue.code == "signed_amount_mismatch" and issue.severity == "warning" for issue in staged.issues)
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before


def test_personal_finance_staging_flags_invalid_unsupported_and_duplicate_rows(tmp_path: Path):
    path = tmp_path / "personal_finance_bank_flow.xlsx"
    duplicate = "11111111-1111-4111-8111-111111111111"
    _write(path, [
        _row(row_id=duplicate),
        _row(row_id=duplicate, amount=15),
        _row(category="Unknown", amount=20),
        _row(direction="income", category="Food", amount=10, signed=10),
        _row(source="share-sync", row_id="22222222-2222-4222-8222-222222222222"),
    ])

    plan = stage_personal_finance_workbook(path, flow_type="bank")

    assert [record.status for record in plan.records] == ["ready", "possible_duplicate", "unsupported", "invalid", "unsupported"]
    assert plan.counts_by_status == {"ready": 1, "unsupported": 2, "invalid": 1, "possible_duplicate": 1}
    assert plan.records[3].issues[0].code == "category_direction_mismatch"
    assert any(issue.code == "non_manual_source" for issue in plan.records[4].issues)


def test_personal_finance_staging_uses_legacy_sheet_and_stable_identity_key(tmp_path: Path):
    path = tmp_path / "personal_finance_cash_flow.xlsx"
    _write(path, [_row(flow="cash", direction="income", category="Salary", amount=100, signed=100)], sheet_name="Personal Finance")

    first = stage_personal_finance_workbook(path, flow_type="cash")
    second = stage_personal_finance_workbook(path, flow_type="cash")

    assert first.sheet_name == "Personal Finance"
    assert first.records[0].status == "ready"
    assert first.records[0].identity_key == second.records[0].identity_key
    assert first.records[0].identity_key


def test_personal_finance_staging_rejects_flow_mismatch_and_invalid_row_id(tmp_path: Path):
    path = tmp_path / "wrong-flow.xlsx"
    _write(path, [
        _row(flow="cash", row_id="bad-id"),
    ])

    staged = stage_personal_finance_workbook(path, flow_type="bank").records[0]

    assert staged.status == "invalid"
    assert {issue.code for issue in staged.issues} >= {"flow_type_mismatch", "malformed_row_id"}


def test_personal_finance_staging_rejects_missing_headers_and_invalid_flow_selection(tmp_path: Path):
    path = tmp_path / "missing-headers.xlsx"
    _write(path, [["2026-10-23", "Food"]], headers=["Date", "Category"])

    with pytest.raises(ValueError, match="required columns"):
        stage_personal_finance_workbook(path, flow_type="bank")

    with pytest.raises(ValueError, match="flow_type"):
        stage_personal_finance_workbook(path, flow_type="transfer")
