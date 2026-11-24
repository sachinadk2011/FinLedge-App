from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from openpyxl import Workbook
import pytest

from backend.db.imports import stage_bank_workbook
from backend.db.imports.common import normalize_import_timestamps
from backend.models import BankCategory
from backend.services.bank import bank_amount_to_scaled, legacy_bank_amount_to_scaled
from backend.services.common.workbook_merge import calculate_content_hash


def _write_workbook(path: Path, headers: list[str], rows: list[list[object]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Bank"
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def test_legacy_income_is_retained_and_flagged_without_changing_category_enum(tmp_path: Path):
    path = tmp_path / "legacy-bank.xlsx"
    _write_workbook(
        path,
        ["Date", "Category", "Amount", "Description"],
        [[date(2020, 1, 2), "Income", 100.105, "interest income"]],
    )
    original = path.read_bytes()

    plan = stage_bank_workbook(path)

    row = plan.records[0]
    assert row.category == "Income"
    assert row.status == "ready"
    assert row.amount_scaled == 1_001_100
    assert [issue.code for issue in row.issues] == ["legacy_income"]
    assert plan.counts_by_status == {"ready": 1, "unsupported": 0, "invalid": 0, "possible_duplicate": 0}
    assert "income" not in {category.value.casefold() for category in BankCategory}
    assert path.read_bytes() == original


def test_supported_and_unknown_categories_are_classified_without_coercion(tmp_path: Path):
    path = tmp_path / "bank-categories.xlsx"
    _write_workbook(
        path,
        ["Date", "Category", "Amount", "Description", "Cumulative Amount", "New Note"],
        [
            ["2026-11-01", "interest earned", 50, "", 50, "kept outside canonical fields"],
            ["2026-11-02", "Broker Service", -5, "renewal", 45, "unknown category"],
        ],
    )

    plan = stage_bank_workbook(path)

    assert plan.records[0].status == "ready"
    assert plan.records[0].category == "Interest Earned"
    assert plan.records[0].amount_scaled == 500_000
    assert plan.records[1].status == "unsupported"
    assert plan.records[1].category == "Broker Service"
    assert [issue.code for issue in plan.records[1].issues] == ["unsupported_category"]
    assert plan.issues[0].code == "unknown_columns"


def test_invalid_rows_report_date_amount_and_sign_errors(tmp_path: Path):
    path = tmp_path / "invalid-bank.xlsx"
    _write_workbook(
        path,
        ["Date", "Category", "Amount"],
        [
            ["not-a-date", "Interest Earned", 10],
            ["2026-11-02", "Interest Tax", "not-money"],
            ["2026-11-03", "Interest Earned", -1],
        ],
    )

    plan = stage_bank_workbook(path)

    assert [record.status for record in plan.records] == ["invalid"] * 3
    assert [{issue.code for issue in record.issues} for record in plan.records] == [
        {"invalid_date", "imported_missing"},
        {"invalid_amount"},
        {"invalid_sign"},
    ]


def test_staging_requires_unique_headers_and_all_required_columns(tmp_path: Path):
    duplicate = tmp_path / "duplicate.xlsx"
    _write_workbook(duplicate, ["Date", "Category", "Amount", "amount"], [])
    missing = tmp_path / "missing.xlsx"
    _write_workbook(missing, ["Date", "Category"], [])

    with pytest.raises(ValueError, match="duplicate or ambiguous"):
        stage_bank_workbook(duplicate)
    with pytest.raises(ValueError, match="required columns.*Amount"):
        stage_bank_workbook(missing)


def test_bank_amount_boundaries_share_rounding_but_keep_sqlite_float_guard():
    assert legacy_bank_amount_to_scaled(Decimal("10.125")) == 101_300
    assert legacy_bank_amount_to_scaled(10.125) == 101_300
    assert bank_amount_to_scaled(Decimal("10.125")) == 101_300
    with pytest.raises(TypeError, match="binary float"):
        bank_amount_to_scaled(10.125)


def test_bank_staging_preserves_order_identity_and_timestamp_metadata(tmp_path: Path):
    path = tmp_path / "bank-metadata.xlsx"
    first_id = str(uuid4()).upper()
    duplicate_id = str(uuid4())
    _write_workbook(
        path,
        ["Date", "Category", "Amount", "Created Timestamp", "Last Updated Timestamp", "Updated Device", "Row ID", "Content Hash"],
        [
            ["2026-01-02", "Interest Earned", 10, "2026-01-01T10:00:00+05:45", None, "desktop-appx", first_id, "legacy-hash"],
            ["2026-01-03", "Interest Earned", 20, "2026-01-02T10:00:00", "2026-01-02", None, duplicate_id, None],
            ["2026-01-04", "Interest Earned", 30, "2026-01-03T10:00:00Z", None, None, duplicate_id, None],
        ],
    )

    plan = stage_bank_workbook(path)

    first, second, third = plan.records
    assert [row.sequence_no for row in plan.records] == [1, 2, 3]
    assert first.row_id == first_id.lower()
    assert first.created_timestamp == "2026-01-01T04:15:00.000000Z"
    assert first.last_updated_timestamp == first.created_timestamp
    assert first.updated_device == "desktop-appx"
    assert first.metadata_quality == "legacy_offset"
    assert first.source_content_hash == "legacy-hash"
    assert first.content_hash.startswith("sha256:")
    assert "invalid_content_hash" in {issue.code for issue in first.issues}
    assert second.created_timestamp == "2026-01-02T10:00:00.000000Z"
    assert second.metadata_quality == "legacy_naive"
    assert second.last_updated_timestamp == "2026-01-02T00:00:00.000000Z"
    assert third.metadata_quality == "exact"
    assert third.status == "possible_duplicate"
    assert [issue.code for issue in third.issues] == ["duplicate_row_id"]


def test_import_timestamp_quality_fallbacks_follow_schema_rules():
    fixed_import = "2026-11-24T00:00:00.000000Z"
    date_only = normalize_import_timestamps(None, None, "2026-02-03", import_timestamp=fixed_import)
    no_date = normalize_import_timestamps(None, None, None, import_timestamp=fixed_import)
    canonical_z = normalize_import_timestamps(
        "2026-02-03T10:20:30.123456Z", None, "2026-02-03", import_timestamp=fixed_import
    )

    assert date_only.created_timestamp == "2026-02-03T00:00:00.000000Z"
    assert date_only.metadata_quality == "backfilled"
    assert date_only.last_updated_timestamp == date_only.created_timestamp
    assert no_date.created_timestamp == fixed_import
    assert no_date.metadata_quality == "imported_missing"
    assert canonical_z.metadata_quality == "exact"


def test_legacy_bank_rows_receive_stable_identity_keys_with_duplicate_ordinals(tmp_path: Path):
    path = tmp_path / "bank-no-ids.xlsx"
    _write_workbook(
        path,
        ["Date", "Category", "Amount", "Description", "Created Timestamp"],
        [
            ["2026-01-02", "Interest Earned", 10, "same", "2026-01-02T10:00:00"],
            ["2026-01-02", "Interest Earned", 10, "same", "2026-01-02T10:00:00"],
        ],
    )

    first_plan = stage_bank_workbook(path)
    second_plan = stage_bank_workbook(path)

    first, second = first_plan.records
    assert first.row_id is None and first.identity_key
    assert second.row_id is None and second.identity_key
    assert first.identity_key.endswith("#0")
    assert second.identity_key.endswith("#1")
    assert [row.identity_key for row in second_plan.records] == [first.identity_key, second.identity_key]


def test_bank_staging_verifies_legacy_sha1_and_emits_canonical_sha256(tmp_path: Path):
    path = tmp_path / "bank-hash.xlsx"
    headers = ["Date", "Category", "Amount", "Description", "Content Hash"]
    source_row = ["2026-01-02", "Interest Earned", 10, "legacy note", None]
    source_row[-1] = calculate_content_hash(headers, source_row, "bank")
    _write_workbook(path, headers, [source_row])

    staged = stage_bank_workbook(path).records[0]

    assert staged.status == "ready"
    assert staged.source_content_hash == source_row[-1]
    assert staged.content_hash.startswith("sha256:")
    assert not any(issue.code == "legacy_hash_mismatch" for issue in staged.issues)
