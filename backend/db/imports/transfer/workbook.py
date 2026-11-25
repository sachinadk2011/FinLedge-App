"""Read-only staging and canonical validation for Transfer Flow workbooks."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from pathlib import Path
import hashlib
import re

from openpyxl import load_workbook

from backend.db.core.content_hash import content_hash, normalize_hash_text
from backend.db.core.metadata import utc_timestamp_now
from backend.db.core.row_mapping import decimal_to_scaled
from backend.db.imports.common import normalize_import_date, normalize_import_row_id, normalize_import_timestamps
from backend.db.imports.transfer.models import (
    StagedTransferRecord,
    TransferImportIssue,
    TransferImportPlan,
)
from backend.services.common.workbook_headers import header_indexes, header_key
from backend.services.common.workbook_merge import legacy_identity_keys, normalize_device_label
from backend.services.personal_finance import normalize_transfer_direction


_KNOWN_HEADERS = {header_key(name) for name in (
    "Date", "Flow Type", "Transfer Direction", "Direction", "Category", "Amount", "Signed Amount",
    "Description", "Source", "Created Timestamp", "Last Updated Timestamp", "Source Ref",
    "Updated Device", "Row ID", "Content Hash",
)}
_HASH_RE = re.compile(r"^sha256:[0-9a-f]{64}$", re.IGNORECASE)


def stage_transfer_workbook(path: str | Path, *, sheet_name: str = "Transfer Flow") -> TransferImportPlan:
    """Read one transfer worksheet without changing its workbook or a database."""
    source_path = Path(path).expanduser().resolve()
    workbook = load_workbook(source_path, read_only=True, data_only=True)
    try:
        if sheet_name not in workbook.sheetnames:
            raise ValueError(f"Workbook is missing the {sheet_name!r} worksheet.")
        sheet = workbook[sheet_name]
        headers = list(next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), ()))
        indexes = header_indexes(headers)
        if len(indexes) != len([header for header in headers if header_key(header)]):
            raise ValueError("Workbook has duplicate or ambiguous column headers.")
        if header_key("Date") not in indexes or header_key("Amount") not in indexes:
            raise ValueError("Workbook must contain Date and Amount columns.")
        direction_columns = {header_key(name) for name in ("Flow Type", "Transfer Direction", "Direction")}
        if not direction_columns.intersection(indexes):
            raise ValueError("Workbook must contain a Flow Type or Transfer Direction column.")

        plan_issues: list[TransferImportIssue] = []
        unknown = [str(value).strip() for value in headers if header_key(value) and header_key(value) not in _KNOWN_HEADERS]
        if unknown:
            plan_issues.append(TransferImportIssue(
                "unknown_columns", "warning", f"Unrecognized columns will be ignored: {', '.join(unknown)}."
            ))
        source_rows, row_numbers = [], []
        for row_number, values in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            row = list(values)
            if any(value not in (None, "") for value in row):
                source_rows.append(row)
                row_numbers.append(row_number)
        identity_headers = list(headers)
        flow_index = indexes.get(header_key("Flow Type"))
        if flow_index is None:
            flow_index = len(identity_headers)
            identity_headers.append("Flow Type")
        identity_rows = []
        for source_row in source_rows:
            normalized_row = list(source_row) + [None] * max(0, len(identity_headers) - len(source_row))
            raw_direction = (
                _value(source_row, indexes, "Flow Type")
                or _value(source_row, indexes, "Transfer Direction")
                or _value(source_row, indexes, "Direction")
            )
            normalized_row[flow_index] = normalize_transfer_direction(raw_direction) or str(raw_direction or "").strip()
            identity_rows.append(normalized_row)
        identities = legacy_identity_keys(
            identity_headers, identity_rows, "transfer",
            identity_scope=f"{source_path.name.casefold()}#{sheet_name.casefold()}",
        )
        import_timestamp = utc_timestamp_now()
        seen_ids: set[str] = set()
        seen_refs: set[str] = set()
        records = tuple(
            _stage_row(headers, indexes, row, row_number, sequence, identities[sequence - 1],
                       seen_ids, seen_refs, import_timestamp)
            for sequence, (row_number, row) in enumerate(zip(row_numbers, source_rows), start=1)
        )
        return TransferImportPlan(source_path.name, sheet_name, records, tuple(plan_issues))
    finally:
        workbook.close()


def _stage_row(headers, indexes, row, row_number, sequence, identity_key, seen_ids, seen_refs, import_timestamp):
    issues: list[TransferImportIssue] = []
    txn_date = normalize_import_date(_value(row, indexes, "Date"))
    if txn_date is None:
        issues.append(_error(row_number, "invalid_date", "Date is missing or invalid."))
    raw_direction = (
        _value(row, indexes, "Flow Type")
        or _value(row, indexes, "Transfer Direction")
        or _value(row, indexes, "Direction")
    )
    direction = normalize_transfer_direction(raw_direction)
    if not direction:
        issues.append(_error(row_number, "invalid_direction", "Transfer direction must be Bank to Cash or Cash to Bank."))
    amount_scaled = _amount(_value(row, indexes, "Amount"), row_number, issues)
    raw_row_id = _value(row, indexes, "Row ID")
    try:
        row_id, duplicate = normalize_import_row_id(raw_row_id, seen_ids)
    except ValueError as error:
        row_id, duplicate = None, False
        issues.append(_error(row_number, "malformed_row_id", str(error)))
    if duplicate:
        issues.append(TransferImportIssue(
            "duplicate_row_id", "warning", f"Row ID {row_id} already appeared in this workbook.", row_number
        ))
    timestamps = None
    try:
        timestamps = normalize_import_timestamps(
            _value(row, indexes, "Created Timestamp"),
            _value(row, indexes, "Last Updated Timestamp"), txn_date,
            import_timestamp=import_timestamp,
        )
    except ValueError as error:
        issues.append(_error(row_number, "invalid_timestamp", str(error)))
    if timestamps and timestamps.metadata_quality == "imported_missing":
        issues.append(TransferImportIssue(
            "imported_missing", "warning", "Timestamps and transaction date are missing; import time was used.", row_number
        ))

    description_value = _value(row, indexes, "Description")
    description = str(description_value).strip() if description_value not in (None, "") else None
    raw_ref = _value(row, indexes, "Source Ref")
    transfer_ref = str(raw_ref).strip() if raw_ref not in (None, "") else None
    if not transfer_ref:
        seed = row_id or identity_key
        transfer_ref = f"transfer:{hashlib.sha256(seed.encode('utf-8')).hexdigest()[:16]}"
        issues.append(TransferImportIssue(
            "legacy_transfer_ref_generated", "warning", "Missing Source Ref was replaced with a deterministic transfer reference.", row_number
        ))
    if transfer_ref in seen_refs:
        issues.append(_error(row_number, "duplicate_transfer_ref", f"Transfer reference {transfer_ref!r} appears more than once."))
    else:
        seen_refs.add(transfer_ref)

    normalized_hash = None
    if txn_date and direction and amount_scaled is not None and transfer_ref:
        payload = {
            "txn_date": txn_date,
            "direction": direction,
            "amount_scaled": amount_scaled,
            "description": normalize_hash_text(description) if description else None,
            "source_ref": normalize_hash_text(transfer_ref),
        }
        normalized_hash = content_hash(
            payload, ("txn_date", "direction", "amount_scaled", "description", "source_ref")
        )
    raw_hash = _value(row, indexes, "Content Hash")
    if raw_hash not in (None, ""):
        source_hash = str(raw_hash).strip()
        if not _HASH_RE.fullmatch(source_hash) or source_hash.casefold() != str(normalized_hash or "").casefold():
            issues.append(TransferImportIssue(
                "content_hash_recalculated", "warning",
                "Legacy or mismatched Content Hash was recalculated from canonical transfer fields.", row_number,
            ))

    status = "invalid" if any(issue.severity == "error" for issue in issues) else "possible_duplicate" if duplicate else "ready"
    return StagedTransferRecord(
        row_number=row_number,
        sequence_no=sequence,
        row_id=row_id,
        identity_key=identity_key if row_id is None else None,
        txn_date=txn_date,
        direction=direction or None,
        amount_scaled=amount_scaled,
        description=description,
        transfer_ref=transfer_ref,
        created_timestamp=timestamps.created_timestamp if timestamps else "",
        last_updated_timestamp=timestamps.last_updated_timestamp if timestamps else "",
        updated_device=normalize_device_label(_value(row, indexes, "Updated Device")),
        metadata_quality=timestamps.metadata_quality if timestamps else "imported_missing",
        source_content_hash=str(raw_hash).strip() if raw_hash not in (None, "") else None,
        content_hash=normalized_hash,
        status=status,
        issues=tuple(issues),
    )


def _amount(value, row_number, issues):
    if value in (None, ""):
        issues.append(_error(row_number, "missing_amount", "Amount is required."))
        return None
    try:
        decimal_value = Decimal(str(value)) if isinstance(value, float) else Decimal(str(value))
        amount = decimal_to_scaled(decimal_value)
    except (InvalidOperation, TypeError, ValueError) as error:
        issues.append(_error(row_number, "invalid_amount", f"Amount must be a valid value with at most four decimal places: {error}"))
        return None
    if amount <= 0:
        issues.append(_error(row_number, "non_positive_amount", "Transfer amount must be greater than zero."))
        return None
    return amount


def _value(row, indexes, name):
    index = indexes.get(header_key(name))
    return row[index] if index is not None and index < len(row) else None


def _error(row_number, code, message):
    return TransferImportIssue(code, "error", message, row_number)
