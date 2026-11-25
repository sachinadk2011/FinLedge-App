from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
import pytest

from backend.db.imports.transfer import stage_transfer_workbook


HEADERS = [
    "Date", "Flow Type", "Direction", "Category", "Amount", "Signed Amount", "Description",
    "Source", "Created Timestamp", "Last Updated Timestamp", "Source Ref", "Updated Device", "Row ID", "Content Hash",
]


def _write(path: Path, rows: list[list[object]], headers=HEADERS) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Transfer Flow"
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def test_transfer_staging_maps_aliases_normalizes_money_and_is_read_only(tmp_path: Path):
    path = tmp_path / "personal_finance_transfer.xlsx"
    row = ["2025-01-02", "Bank to Cash", "transfer", "Transfer", 125.25, -125.25,
           "move", "transfer", None, None, None, "desktop-test", None, None]
    _write(path, [row])
    before = path.read_bytes()

    plan = stage_transfer_workbook(path)

    assert path.read_bytes() == before
    record = plan.records[0]
    assert record.status == "ready"
    assert record.direction == "bank_to_cash"
    assert record.amount_scaled == 1_252_500
    assert record.transfer_ref and record.transfer_ref.startswith("transfer:")
    assert record.row_id is None and record.identity_key
    assert record.content_hash and record.metadata_quality == "backfilled"


@pytest.mark.parametrize("amount,direction", [(0, "bank_to_cash"), (-3, "bank_to_cash"), (25, "other")])
def test_transfer_staging_flags_nonpositive_amount_and_unknown_direction(tmp_path: Path, amount, direction):
    path = tmp_path / "invalid.xlsx"
    _write(path, [["2025-01-02", direction, "transfer", "Transfer", amount, amount, "", "transfer", None, None, None, None, None, None]])

    record = stage_transfer_workbook(path).records[0]

    assert record.status == "invalid"
    assert any(issue.severity == "error" for issue in record.issues)


def test_transfer_staging_requires_direction_alias_and_amount_column(tmp_path: Path):
    path = tmp_path / "missing.xlsx"
    _write(path, [], ["Date", "Amount"])
    with pytest.raises(ValueError, match="Flow Type or Transfer Direction"):
        stage_transfer_workbook(path)


def test_transfer_staging_rejects_duplicate_source_refs(tmp_path: Path):
    path = tmp_path / "duplicate-ref.xlsx"
    first = ["2025-01-02", "bank_to_cash", "transfer", "Transfer", 10, -10, "a", "transfer", None, None, "transfer:fixed", None, None, None]
    second = ["2025-01-03", "cash_to_bank", "transfer", "Transfer", 15, -15, "b", "transfer", None, None, "transfer:fixed", None, None, None]
    _write(path, [first, second])

    plan = stage_transfer_workbook(path)

    assert plan.records[0].status == "ready"
    assert plan.records[1].status == "invalid"
    assert plan.records[1].issues[-1].code == "duplicate_transfer_ref"
