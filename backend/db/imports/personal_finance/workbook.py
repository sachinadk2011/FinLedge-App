"""Read-only staging and validation for Personal Finance workbook rows."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from pathlib import Path
import re

from openpyxl import load_workbook

from backend.db.core import content_hash, decimal_to_scaled, normalize_hash_text
from backend.db.core.metadata import utc_timestamp_now
from backend.db.imports.common import normalize_import_date, normalize_import_row_id, normalize_import_timestamps
from backend.db.imports.personal_finance.models import (
    PersonalFinanceImportIssue,
    PersonalFinanceImportPlan,
    StagedPersonalFinanceRecord,
)
from backend.models import PF_EXPENSE_CATEGORIES, PF_INCOME_CATEGORIES, PersonalFinanceCategory
from backend.services.common.workbook_headers import header_indexes, header_key
from backend.services.common.workbook_merge import calculate_content_hash, legacy_identity_keys, normalize_device_label


_REQUIRED_HEADERS = ("Date", "Direction", "Category", "Amount")
_KNOWN_HEADERS = {
    header_key(name)
    for name in (
        "Date", "Flow Type", "Direction", "Category", "Amount", "Signed Amount", "Description",
        "Source", "Created Timestamp", "Last Updated Timestamp", "Updated Device", "Source Ref",
        "Row ID", "Content Hash",
    )
}
_CATEGORY_LOOKUP = {category.value.casefold(): category.value for category in PersonalFinanceCategory}
_DEVICE_LABELS = {"desktop-exe", "desktop-appx", "desktop-dev", "desktop-test", "mobile", "legacy"}
_SHA1_HASH = re.compile(r"^[0-9a-f]{40}$", re.IGNORECASE)
_SHA256_HASH = re.compile(r"^sha256:[0-9a-f]{64}$", re.IGNORECASE)


def stage_personal_finance_workbook(
    path: str | Path,
    *,
    flow_type: str,
) -> PersonalFinanceImportPlan:
    """Read one Bank or Cash Flow worksheet without changing its workbook or a database."""
    flow = str(flow_type or "").strip().casefold()
    if flow not in {"bank", "cash"}:
        raise ValueError("flow_type must be 'bank' or 'cash'")

    source_path = Path(path).expanduser().resolve()
    workbook = load_workbook(source_path, read_only=True, data_only=True)
    try:
        expected_sheet = "Bank Flow" if flow == "bank" else "Cash Flow"
        if expected_sheet in workbook.sheetnames:
            sheet_name = expected_sheet
        elif "Personal Finance" in workbook.sheetnames:
            sheet_name = "Personal Finance"
        else:
            raise ValueError(f"Workbook is missing the {expected_sheet!r} worksheet.")
        sheet = workbook[sheet_name]
        headers = list(next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), ()))
        indexes = header_indexes(headers)
        if len(indexes) != len([header for header in headers if header_key(header)]):
            raise ValueError("Workbook has duplicate or ambiguous column headers.")
        missing = [name for name in _REQUIRED_HEADERS if header_key(name) not in indexes]
        if missing:
            raise ValueError(f"Workbook is missing required columns: {', '.join(missing)}")

        plan_issues: list[PersonalFinanceImportIssue] = []
        unknown_headers = [
            str(header).strip() for header in headers
            if header_key(header) and header_key(header) not in _KNOWN_HEADERS
        ]
        if unknown_headers:
            plan_issues.append(PersonalFinanceImportIssue(
                code="unknown_columns",
                severity="warning",
                message=f"Unrecognized columns will be ignored: {', '.join(unknown_headers)}.",
            ))

        source_rows: list[list[object]] = []
        row_numbers: list[int] = []
        for row_number, values in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            row = list(values)
            if any(value not in (None, "") for value in row):
                source_rows.append(row)
                row_numbers.append(row_number)

        identity_keys = legacy_identity_keys(
            headers,
            source_rows,
            "personal_finance",
            identity_scope=f"{source_path.name.casefold()}#{('bank flow' if flow == 'bank' else 'cash flow')}",
        )
        import_timestamp = utc_timestamp_now()
        seen_ids: set[str] = set()
        records = tuple(
            _stage_row(
                row_number=row_number,
                sequence_no=sequence_no,
                headers=headers,
                indexes=indexes,
                row=row,
                identity_key=identity_keys[sequence_no - 1],
                flow_type=flow,
                seen_ids=seen_ids,
                import_timestamp=import_timestamp,
            )
            for sequence_no, (row_number, row) in enumerate(zip(row_numbers, source_rows), start=1)
        )
        return PersonalFinanceImportPlan(
            source_name=source_path.name,
            flow_type=flow,
            sheet_name=sheet_name,
            records=records,
            issues=tuple(plan_issues),
        )
    finally:
        workbook.close()


def _stage_row(
    *,
    row_number: int,
    sequence_no: int,
    headers: list[object],
    indexes: dict[str, int],
    row: list[object],
    identity_key: str,
    flow_type: str,
    seen_ids: set[str],
    import_timestamp: str,
) -> StagedPersonalFinanceRecord:
    issues: list[PersonalFinanceImportIssue] = []
    txn_date = _normalize_date(_value(row, indexes, "Date"))
    raw_flow = _value(row, indexes, "Flow Type")
    row_flow = str(raw_flow or flow_type).strip().casefold()
    direction_text = str(_value(row, indexes, "Direction") or "").strip().casefold()
    category_text = str(_value(row, indexes, "Category") or "").strip()
    category = _CATEGORY_LOOKUP.get(category_text.casefold())
    description_value = _value(row, indexes, "Description")
    description = str(description_value).strip() if description_value not in (None, "") else None
    raw_amount = _value(row, indexes, "Amount")
    raw_source = str(_value(row, indexes, "Source") or "").strip().casefold()
    raw_source_ref = _value(row, indexes, "Source Ref")
    raw_row_id = _value(row, indexes, "Row ID")
    raw_hash = _value(row, indexes, "Content Hash")

    if txn_date is None:
        issues.append(_error(row_number, "invalid_date", "Date is missing or invalid."))
    if row_flow not in {"bank", "cash"}:
        issues.append(_error(row_number, "invalid_flow_type", f"Unknown Flow Type {row_flow!r}."))
    elif row_flow != flow_type:
        issues.append(_error(row_number, "flow_type_mismatch", f"This row belongs to {row_flow!r}, not the selected {flow_type!r} workbook."))
    if direction_text not in {"income", "expense"} and raw_source != "transfer":
        issues.append(_error(row_number, "invalid_direction", "Direction must be income or expense."))
    if not category_text:
        issues.append(_error(row_number, "missing_category", "Category is required."))
    elif category is None:
        issues.append(PersonalFinanceImportIssue(
            code="unsupported_category", severity="warning",
            message=f"Unsupported Personal Finance category {category_text!r} needs review.", row_number=row_number,
        ))
    elif direction_text in {"income", "expense"}:
        allowed = PF_INCOME_CATEGORIES if direction_text == "income" else PF_EXPENSE_CATEGORIES
        if PersonalFinanceCategory(category) not in allowed:
            issues.append(_error(row_number, "category_direction_mismatch", f"{category!r} is not an allowed {direction_text} category."))

    amount_scaled = _amount_to_scaled(raw_amount, row_number, issues)
    if amount_scaled is not None and amount_scaled <= 0:
        issues.append(_error(row_number, "non_positive_amount", "Personal Finance amounts must be greater than zero."))
    signed_value = _value(row, indexes, "Signed Amount")
    signed_scaled = _amount_to_scaled(
        signed_value,
        row_number,
        issues,
        code="invalid_signed_amount",
        required=False,
        severity="warning",
    )
    if signed_scaled is not None and amount_scaled is not None and direction_text in {"income", "expense"}:
        expected = amount_scaled if direction_text == "income" else -amount_scaled
        if signed_scaled != expected:
            issues.append(PersonalFinanceImportIssue(
                code="signed_amount_mismatch", severity="warning",
                message="Signed Amount is derived and does not match Amount and Direction; the canonical signed value will be recomputed.",
                row_number=row_number,
            ))

    if not raw_source:
        source = "manual"
        issues.append(PersonalFinanceImportIssue(
            code="legacy_source_assumed_manual", severity="warning",
            message="Blank Source is treated as a legacy manual Personal Finance entry.", row_number=row_number,
        ))
    else:
        source = raw_source
    if source != "manual":
        issues.append(PersonalFinanceImportIssue(
            code="non_manual_source", severity="warning",
            message=f"Source {source!r} is not stored in Personal Finance; linked and transfer rows must be rebuilt from their canonical module.",
            row_number=row_number,
        ))
    source_ref = str(raw_source_ref).strip() if raw_source_ref not in (None, "") else None
    if source == "manual" and source_ref:
        issues.append(_error(row_number, "manual_source_ref_unsupported", "A manual entry has a Source Ref that the SQLite Personal Finance schema cannot preserve."))

    row_id = _normalize_row_id(raw_row_id, row_number, issues, seen_ids)
    try:
        timestamps = normalize_import_timestamps(
            _value(row, indexes, "Created Timestamp"),
            _value(row, indexes, "Last Updated Timestamp"),
            txn_date,
            import_timestamp=import_timestamp,
        )
    except ValueError as error:
        timestamps = None
        issues.append(_error(row_number, "invalid_timestamp", str(error)))
    if timestamps and timestamps.metadata_quality == "imported_missing":
        issues.append(PersonalFinanceImportIssue(
            code="imported_missing", severity="warning",
            message="No creation timestamp or transaction date was available; import time was used.",
            row_number=row_number,
        ))

    normalized_hash = None
    if txn_date and row_flow in {"bank", "cash"} and direction_text in {"income", "expense"} and category and amount_scaled and amount_scaled > 0 and source == "manual" and not source_ref:
        hash_fields = {
            "txn_date": txn_date,
            "flow_type": normalize_hash_text(row_flow, casefold=True),
            "direction": normalize_hash_text(direction_text, casefold=True),
            "category": normalize_hash_text(category, casefold=True),
            "amount_scaled": amount_scaled,
            "description": normalize_hash_text(description) if description else None,
            "source": "manual",
            "source_ref": None,
        }
        normalized_hash = content_hash(
            hash_fields,
            ("txn_date", "flow_type", "direction", "category", "amount_scaled", "description", "source", "source_ref"),
        )
        if raw_hash not in (None, ""):
            source_hash = str(raw_hash).strip()
            if _SHA1_HASH.fullmatch(source_hash):
                legacy_hash = calculate_content_hash(headers, row, "personal_finance")
                if legacy_hash.casefold() != source_hash.casefold():
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
    elif any(issue.code in {"unsupported_category", "non_manual_source"} for issue in issues):
        status = "unsupported"
    else:
        status = "ready"

    device_value = _value(row, indexes, "Updated Device")
    device = normalize_device_label(device_value)
    if device_value not in (None, "") and str(device_value).strip().casefold() not in _DEVICE_LABELS | {"desktop"}:
        issues.append(PersonalFinanceImportIssue(
            code="unknown_device_label", severity="warning",
            message="Unknown Updated Device label is preserved as legacy.", row_number=row_number,
        ))
    if any(issue.severity == "error" for issue in issues):
        status = "invalid"
    return StagedPersonalFinanceRecord(
        row_number=row_number,
        sequence_no=sequence_no,
        row_id=row_id,
        identity_key=identity_key if row_id is None else None,
        txn_date=txn_date,
        flow_type=flow_type,
        direction=direction_text if direction_text in {"income", "expense"} else None,
        category=category or category_text or None,
        amount_scaled=amount_scaled,
        description=description,
        created_timestamp=timestamps.created_timestamp if timestamps else "",
        last_updated_timestamp=timestamps.last_updated_timestamp if timestamps else "",
        updated_device=device,
        metadata_quality=timestamps.metadata_quality if timestamps else "imported_missing",
        source_content_hash=str(raw_hash).strip() if raw_hash not in (None, "") else None,
        content_hash=normalized_hash,
        status=status,
        issues=tuple(issues),
    )


def _amount_to_scaled(
    value: object | None,
    row_number: int,
    issues: list[PersonalFinanceImportIssue],
    *,
    code: str = "invalid_amount",
    required: bool = True,
    severity: str = "error",
) -> int | None:
    if value in (None, ""):
        if required:
            issues.append(_issue(row_number, code, "Amount is missing.", severity))
        return None
    try:
        decimal = value if isinstance(value, Decimal) else Decimal(str(value).replace(",", "").strip())
        if not decimal.is_finite():
            raise ValueError("Amount must be finite.")
        return decimal_to_scaled(decimal)
    except (InvalidOperation, TypeError, ValueError) as error:
        issues.append(_issue(row_number, code, str(error), severity))
        return None


def _normalize_date(value: object | None) -> str | None:
    return normalize_import_date(value)


def _normalize_row_id(
    value: object | None,
    row_number: int,
    issues: list[PersonalFinanceImportIssue],
    seen_ids: set[str],
) -> str | None:
    try:
        canonical, duplicate = normalize_import_row_id(value, seen_ids)
    except ValueError as error:
        issues.append(_error(row_number, "malformed_row_id", str(error)))
        return None
    if canonical is None:
        return None
    if duplicate:
        issues.append(PersonalFinanceImportIssue(
            code="duplicate_row_id", severity="warning",
            message=f"Row ID {canonical} already appeared earlier in this workbook; review as a possible duplicate.",
            row_number=row_number,
        ))
    return canonical


def _value(row: list[object], indexes: dict[str, int], name: str) -> object | None:
    index = indexes.get(header_key(name))
    return row[index] if index is not None and index < len(row) else None


def _error(row_number: int, code: str, message: str) -> PersonalFinanceImportIssue:
    return PersonalFinanceImportIssue(code=code, severity="error", message=message, row_number=row_number)


def _issue(row_number: int, code: str, message: str, severity: str) -> PersonalFinanceImportIssue:
    if severity == "warning":
        return PersonalFinanceImportIssue(code=code, severity="warning", message=message, row_number=row_number)
    return _error(row_number, code, message)


def _hash_warning(row_number: int, code: str, message: str) -> PersonalFinanceImportIssue:
    return PersonalFinanceImportIssue(code=code, severity="warning", message=message, row_number=row_number)
