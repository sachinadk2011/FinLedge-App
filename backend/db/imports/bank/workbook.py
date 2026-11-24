"""Read-only Bank workbook staging for the Desktop SQLite import pipeline."""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
import re
from uuid import UUID

from openpyxl import load_workbook

from backend.db.imports.bank.models import BankImportIssue, BankImportPlan, StagedBankRecord
from backend.models import BankCategory
from backend.db.core import content_hash, normalize_hash_text
from backend.db.core.metadata import utc_timestamp_now
from backend.db.imports.common import normalize_import_timestamps
from backend.services.bank import legacy_bank_amount_to_scaled
from backend.services.common.workbook_merge import calculate_content_hash, legacy_identity_keys, normalize_device_label
from backend.services.common.workbook_headers import header_key, header_indexes


_REQUIRED_HEADERS = ("Date", "Category", "Amount")
_KNOWN_HEADERS = {
    header_key(name)
    for name in (
        "Date", "Category", "Amount", "Cumulative Amount", "Description",
        "Created Timestamp", "Last Updated Timestamp", "Updated Device", "Row ID", "Content Hash",
    )
}
_CATEGORIES = {category.value.casefold(): category.value for category in BankCategory}
_LEGACY_INCOME = "income"
_SHA1_HASH = re.compile(r"^[0-9a-f]{40}$", re.IGNORECASE)
_SHA256_HASH = re.compile(r"^sha256:[0-9a-f]{64}$", re.IGNORECASE)


def stage_bank_workbook(path: str | Path, *, sheet_name: str = "Bank") -> BankImportPlan:
    """Read and classify Bank rows without modifying the workbook or a database."""
    source_path = Path(path).expanduser().resolve()
    workbook = load_workbook(source_path, read_only=True, data_only=True)
    try:
        if sheet_name not in workbook.sheetnames:
            raise ValueError(f"Workbook is missing the {sheet_name!r} worksheet.")
        sheet = workbook[sheet_name]
        header_row = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), ())
        headers = list(header_row)
        indexes = header_indexes(headers)
        if len(indexes) != len([header for header in headers if header_key(header)]):
            raise ValueError("Workbook has duplicate or ambiguous column headers.")
        missing = [name for name in _REQUIRED_HEADERS if header_key(name) not in indexes]
        if missing:
            raise ValueError(f"Workbook is missing required columns: {', '.join(missing)}")

        plan_issues = []
        unknown_headers = [
            str(header).strip()
            for header in headers
            if header_key(header) and header_key(header) not in _KNOWN_HEADERS
        ]
        if unknown_headers:
            plan_issues.append(BankImportIssue(
                code="unknown_columns",
                severity="warning",
                message=f"Unrecognized columns will be ignored: {', '.join(unknown_headers)}.",
            ))

        records = []
        source_rows = []
        source_row_numbers = []
        for row_number, values in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            row = list(values)
            if any(value not in (None, "") for value in row):
                source_rows.append(row)
                source_row_numbers.append(row_number)
        identity_keys = legacy_identity_keys(
            headers,
            source_rows,
            "bank",
            identity_scope="bank_transactions.xlsx#bank",
        )
        seen_ids: set[str] = set()
        import_timestamp = utc_timestamp_now()
        for sequence_no, (row_number, row) in enumerate(zip(source_row_numbers, source_rows), start=1):
            records.append(_stage_row(
                row_number,
                sequence_no,
                headers,
                indexes,
                row,
                identity_keys[sequence_no - 1],
                seen_ids,
                import_timestamp,
            ))
        return BankImportPlan(source_name=source_path.name, records=tuple(records), issues=tuple(plan_issues))
    finally:
        workbook.close()


def _stage_row(
    row_number: int,
    sequence_no: int,
    headers: list[object],
    indexes: dict[str, int],
    row: list[object],
    identity_key: str,
    seen_ids: set[str],
    import_timestamp: str,
) -> StagedBankRecord:
    issues: list[BankImportIssue] = []
    raw_date = _value(row, indexes, "Date")
    raw_category = _value(row, indexes, "Category")
    raw_amount = _value(row, indexes, "Amount")
    raw_description = _value(row, indexes, "Description")
    raw_row_id = _value(row, indexes, "Row ID")
    raw_created = _value(row, indexes, "Created Timestamp")
    raw_updated = _value(row, indexes, "Last Updated Timestamp")
    raw_device = _value(row, indexes, "Updated Device")
    raw_hash = _value(row, indexes, "Content Hash")

    txn_date = _normalize_date(raw_date)
    category_text = str(raw_category or "").strip()
    category_key = category_text.casefold()
    category = _CATEGORIES.get(category_key)
    amount_scaled = None
    normalized_hash = None

    if txn_date is None:
        issues.append(_invalid_issue(row_number, "invalid_date", "Date is missing or invalid."))

    row_id = _normalize_row_id(raw_row_id, row_number, issues, seen_ids)
    timestamps = None
    try:
        timestamps = normalize_import_timestamps(
            raw_created,
            raw_updated,
            txn_date,
            import_timestamp=import_timestamp,
        )
    except ValueError as error:
        issues.append(_invalid_issue(row_number, "invalid_timestamp", str(error)))
    if timestamps is not None and timestamps.metadata_quality == "imported_missing":
        issues.append(BankImportIssue(
            code="imported_missing",
            severity="warning",
            message="No creation timestamp or transaction date was available; import time was used.",
            row_number=row_number,
        ))
    if not category_text:
        issues.append(_invalid_issue(row_number, "missing_category", "Category is required."))
    elif category_key == _LEGACY_INCOME:
        category = category_text
        issues.append(BankImportIssue(
            code="legacy_income",
            severity="warning",
            message="Legacy Income is retained for review; it is not a current Bank Services category.",
            row_number=row_number,
        ))
    elif category is None:
        issues.append(BankImportIssue(
            code="unsupported_category",
            severity="warning",
            message=f"Unsupported Bank Services category {category_text!r} needs review.",
            row_number=row_number,
        ))

    try:
        if raw_amount in (None, ""):
            raise ValueError("Amount is missing.")
        amount_scaled = legacy_bank_amount_to_scaled(raw_amount)
    except (TypeError, ValueError) as error:
        issues.append(_invalid_issue(row_number, "invalid_amount", str(error)))

    if category and amount_scaled is not None:
        is_income = category == BankCategory.interest_earned.value or category_key == _LEGACY_INCOME
        if (is_income and amount_scaled <= 0) or (not is_income and amount_scaled >= 0):
            issues.append(_invalid_issue(
                row_number,
                "invalid_sign",
                "Income amounts must be positive and Bank Services charges must be negative.",
            ))

    if txn_date and category and amount_scaled is not None and not any(
        issue.severity == "error" for issue in issues
    ):
        normalized_category = normalize_hash_text(category, casefold=True)
        normalized_description = normalize_hash_text(str(raw_description)) if raw_description not in (None, "") else None
        normalized_hash = content_hash(
            {
                "txn_date": txn_date,
                "category": normalized_category,
                "amount_scaled": amount_scaled,
                "description": normalized_description,
            },
            ("txn_date", "category", "amount_scaled", "description"),
        )
        if raw_hash not in (None, ""):
            source_hash = str(raw_hash).strip()
            if _SHA1_HASH.fullmatch(source_hash):
                verified_hash = calculate_content_hash(headers, row, "bank")
                if verified_hash.casefold() != source_hash.casefold():
                    issues.append(_hash_warning(row_number, "legacy_hash_mismatch", "Legacy SHA-1 Content Hash does not match this row; the canonical SHA-256 hash was recalculated."))
            elif _SHA256_HASH.fullmatch(source_hash):
                if source_hash.casefold() != normalized_hash.casefold():
                    issues.append(_hash_warning(row_number, "content_hash_mismatch", "Content Hash does not match this row; the canonical SHA-256 hash was recalculated."))
            else:
                issues.append(_hash_warning(row_number, "invalid_content_hash", "Content Hash has an unrecognized format; the canonical SHA-256 hash was recalculated."))

    if any(issue.severity == "error" for issue in issues):
        status = "invalid"
    elif any(issue.code == "duplicate_row_id" for issue in issues):
        status = "possible_duplicate"
    elif any(issue.code == "unsupported_category" for issue in issues):
        status = "unsupported"
    else:
        status = "ready"

    description = str(raw_description).strip() if raw_description not in (None, "") else None
    return StagedBankRecord(
        row_number=row_number,
        sequence_no=sequence_no,
        row_id=row_id,
        identity_key=identity_key if row_id is None else None,
        txn_date=txn_date,
        category=category or category_text or None,
        amount_scaled=amount_scaled,
        description=description or None,
        created_timestamp=timestamps.created_timestamp if timestamps else "",
        last_updated_timestamp=timestamps.last_updated_timestamp if timestamps else "",
        updated_device=normalize_device_label(raw_device),
        metadata_quality=timestamps.metadata_quality if timestamps else "imported_missing",
        source_content_hash=str(raw_hash).strip() if raw_hash not in (None, "") else None,
        content_hash=normalized_hash,
        status=status,
        issues=tuple(issues),
    )


def _normalize_row_id(
    value: object | None,
    row_number: int,
    issues: list[BankImportIssue],
    seen_ids: set[str],
) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        canonical = str(UUID(text))
    except (ValueError, AttributeError):
        issues.append(_invalid_issue(row_number, "malformed_row_id", f"Malformed Row ID {text!r}; review before re-minting."))
        return None
    if canonical in seen_ids:
        issues.append(BankImportIssue(
            code="duplicate_row_id",
            severity="warning",
            message=f"Row ID {canonical} already appeared earlier in this workbook; review as a possible duplicate.",
            row_number=row_number,
        ))
    else:
        seen_ids.add(canonical)
    return canonical


def _value(row: list[object], indexes: dict[str, int], name: str) -> object | None:
    index = indexes.get(header_key(name))
    return row[index] if index is not None and index < len(row) else None


def _normalize_date(value: object | None) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    try:
        return date.fromisoformat(str(value or "").strip()[:10]).isoformat()
    except ValueError:
        return None


def _invalid_issue(row_number: int, code: str, message: str) -> BankImportIssue:
    return BankImportIssue(code=code, severity="error", message=message, row_number=row_number)


def _hash_warning(row_number: int, code: str, message: str) -> BankImportIssue:
    return BankImportIssue(code=code, severity="warning", message=message, row_number=row_number)
