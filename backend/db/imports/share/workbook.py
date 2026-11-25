"""Read-only staging and canonical validation for legacy Share worksheets."""

from __future__ import annotations

from dataclasses import replace
from decimal import Decimal, InvalidOperation
from pathlib import Path
import re
from uuid import NAMESPACE_URL, uuid5

from openpyxl import load_workbook

from backend.db.core.content_hash import content_hash, normalize_hash_text
from backend.db.core.metadata import utc_timestamp_now
from backend.db.core.row_mapping import decimal_to_scaled
from backend.db.imports.common import normalize_import_date, normalize_import_row_id, normalize_import_timestamps
from backend.db.imports.share.models import ShareImportIssue, ShareImportPlan, StagedShareRecord
from backend.services.common.workbook_headers import header_indexes, header_key
from backend.services.common.workbook_merge import legacy_identity_keys, normalize_device_label


_REQUIRED_HEADERS = ("Date", "Share Name", "Category", "Per Unit Price", "Allotted", "Buy/Sell")
_KNOWN_HEADERS = {header_key(name) for name in (
    *_REQUIRED_HEADERS, "Charge", "ASBA Charge", "SIP Units", "Total Amount", "Profit/Loss",
    "Cumulative Profit", "Created Timestamp", "Last Updated Timestamp", "Updated Device", "Row ID",
    "Content Hash",
)}
_HASH_RE = re.compile(r"^sha256:[0-9a-f]{64}$", re.IGNORECASE)


def stage_share_workbook(path: str | Path, *, sheet_name: str = "Share") -> ShareImportPlan:
    """Read a Share worksheet without mutating its workbook or any database."""
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
        missing = [name for name in _REQUIRED_HEADERS if header_key(name) not in indexes]
        if missing:
            raise ValueError(f"Workbook is missing required columns: {', '.join(missing)}")

        plan_issues: list[ShareImportIssue] = []
        unknown = [str(value).strip() for value in headers if header_key(value) and header_key(value) not in _KNOWN_HEADERS]
        if unknown:
            plan_issues.append(ShareImportIssue(
                "unknown_columns", "warning", f"Unrecognized columns will be ignored: {', '.join(unknown)}."
            ))
        rows, row_numbers = [], []
        for row_number, values in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            row = list(values)
            if any(value not in (None, "") for value in row):
                rows.append(row)
                row_numbers.append(row_number)
        identities = legacy_identity_keys(headers, rows, "share", identity_scope="share_transactions.xlsx#share")
        import_timestamp = utc_timestamp_now()
        seen_ids: set[str] = set()
        records = tuple(
            _stage_row(headers, indexes, row, row_number, sequence, identities[sequence - 1], seen_ids, import_timestamp)
            for sequence, (row_number, row) in enumerate(zip(row_numbers, rows), start=1)
        )
        records = _assign_sip_plan_ids(records)
        return ShareImportPlan(source_path.name, sheet_name, records, tuple(plan_issues))
    finally:
        workbook.close()


def _stage_row(headers, indexes, row, row_number, sequence, identity_key, seen_ids, import_timestamp):
    issues: list[ShareImportIssue] = []
    date_value = normalize_import_date(_value(row, indexes, "Date"))
    name_value = _value(row, indexes, "Share Name")
    name = " ".join(str(name_value or "").split()).upper() or None
    category = str(_value(row, indexes, "Category") or "").strip().casefold()
    subtype = str(_value(row, indexes, "Buy/Sell") or "").strip().casefold()
    if subtype == "sip":
        subtype = "installment"
    raw_id = _value(row, indexes, "Row ID")
    raw_hash = _value(row, indexes, "Content Hash")
    if date_value is None:
        issues.append(_issue(row_number, "invalid_date", "Date is missing or invalid."))
    if not name:
        issues.append(_issue(row_number, "missing_share_name", "Share Name is required."))
    try:
        row_id, duplicate = normalize_import_row_id(raw_id, seen_ids)
    except ValueError as error:
        row_id, duplicate = None, False
        issues.append(_issue(row_number, "malformed_row_id", str(error)))
    if duplicate:
        issues.append(ShareImportIssue("duplicate_row_id", "warning", f"Row ID {row_id} appears more than once.", row_number))
    try:
        timestamps = normalize_import_timestamps(
            _value(row, indexes, "Created Timestamp"), _value(row, indexes, "Last Updated Timestamp"),
            date_value, import_timestamp=import_timestamp,
        )
    except ValueError as error:
        timestamps = None
        issues.append(_issue(row_number, "invalid_timestamp", str(error)))
    if timestamps and timestamps.metadata_quality == "imported_missing":
        issues.append(ShareImportIssue("imported_missing", "warning", "Timestamps and transaction date are missing; import time was used.", row_number))

    price = _money(_value(row, indexes, "Per Unit Price"), "Per Unit Price", row_number, issues, required=True)
    raw_charge = _value(row, indexes, "Charge")
    if raw_charge in (None, ""):
        raw_charge = _value(row, indexes, "ASBA Charge")
    charge = _money(raw_charge, "Charge", row_number, issues, required=False)
    if charge is None:
        charge = 50_000 if category == "ipo" else 0
    if charge < 0:
        issues.append(_issue(row_number, "negative_charge", "Charge cannot be negative."))
    quantity = _whole(_value(row, indexes, "Allotted"), "Allotted", row_number, issues, allow_blank=True)
    units = _whole(_value(row, indexes, "SIP Units"), "SIP Units", row_number, issues, allow_blank=True)

    entity: str | None = None
    event: str | None = None
    per_unit = amount = cash_amount = sip_plan = None
    if category in {"ipo", "buy", "sell"}:
        entity, event, per_unit = "share", category, price
        if subtype != category:
            issues.append(_error(row_number, "type_mismatch", f"Buy/Sell must be {category!r} for this category."))
        if category == "ipo":
            quantity = None if quantity in (None, 0) else quantity
            if quantity is not None and quantity <= 0:
                issues.append(_error(row_number, "invalid_quantity", "IPO allotment must be blank, zero, or a positive whole number."))
        elif quantity is None or quantity <= 0:
            issues.append(_error(row_number, "invalid_quantity", f"{category.title()} quantity must be a positive whole number."))
        if price is None or price < 0:
            issues.append(_error(row_number, "invalid_price", "Per Unit Price must be zero or greater."))
    elif category == "dividend":
        entity = "dividend"
        if subtype == "cash":
            event, cash_amount = "cash", price
            quantity = None
            if price is None or price <= 0:
                issues.append(_error(row_number, "invalid_cash_dividend", "Cash dividend amount must be greater than zero."))
        elif subtype == "bonus":
            event = "bonus"
            cash_amount = None
            if quantity is None or quantity <= 0:
                issues.append(_error(row_number, "invalid_bonus_quantity", "Bonus shares must be a positive whole number."))
            if price not in (None, 0):
                issues.append(ShareImportIssue("bonus_price_ignored", "warning", "Bonus event price is derived/unused and will not be imported.", row_number))
        else:
            issues.append(_error(row_number, "invalid_dividend_type", "Dividend Buy/Sell must be cash or bonus."))
        if charge:
            issues.append(_error(row_number, "dividend_charge", "Dividend and bonus rows cannot carry a charge."))
    elif category == "sip":
        entity = "sip"
        event = "sip_redemption" if subtype == "redeem" else "sip_installment" if subtype == "installment" else None
        if event is None:
            issues.append(_error(row_number, "invalid_sip_type", "SIP Buy/Sell must be installment or redeem."))
        if price is None or price <= 0:
            issues.append(_error(row_number, "invalid_sip_amount", "SIP amount must be greater than zero."))
        elif event == "sip_redemption":
            amount = price - charge
            if amount <= 0:
                issues.append(_error(row_number, "invalid_net_redemption", "SIP redemption amount less charge must be greater than zero."))
            else:
                amount = amount
        else:
            amount = price
        if event == "sip_redemption":
            units = None
        elif units == 0:
            units = None
        per_unit = None
    else:
        issues.append(ShareImportIssue("unsupported_category", "warning", f"Unsupported Share category {category!r} needs review.", row_number))

    normalized_hash = None
    if date_value and name and entity and event and not any(item.severity == "error" for item in issues):
        canonical_name = normalize_hash_text(name, uppercase=True)
        if entity == "share":
            payload = {"txn_date": date_value, "share_name": canonical_name, "transaction_type": event,
                       "per_unit_price_scaled": per_unit, "quantity": quantity, "charge_scaled": charge or 0}
            fields = ("txn_date", "share_name", "transaction_type", "per_unit_price_scaled", "quantity", "charge_scaled")
        elif entity == "dividend":
            payload = {"txn_date": date_value, "share_name": canonical_name, "event_type": event,
                       "cash_amount_scaled": cash_amount, "quantity": quantity}
            fields = ("txn_date", "share_name", "event_type", "cash_amount_scaled", "quantity")
        else:
            # Plan ID is assigned below; the final hash is completed in _assign_sip_plan_ids.
            payload, fields = None, ()
        if payload is not None:
            normalized_hash = content_hash(payload, fields)
    if raw_hash not in (None, "") and not _HASH_RE.fullmatch(str(raw_hash).strip()):
        issues.append(ShareImportIssue("legacy_hash_upgraded", "warning", "Legacy or malformed Content Hash will be replaced by the canonical SHA-256 hash.", row_number))
    elif raw_hash not in (None, "") and normalized_hash and str(raw_hash).strip().casefold() != normalized_hash.casefold():
        issues.append(ShareImportIssue("content_hash_mismatch", "warning", "Content Hash does not match the canonical event; it was recalculated for review.", row_number))
    status = "invalid" if any(item.severity == "error" for item in issues) else "unsupported" if entity is None else "possible_duplicate" if duplicate else "ready"
    return StagedShareRecord(
        row_number, sequence, row_id, identity_key if row_id is None else None, date_value, name,
        entity, event, per_unit, amount, cash_amount, quantity, charge, units, sip_plan,
        timestamps.created_timestamp if timestamps else "", timestamps.last_updated_timestamp if timestamps else "",
        normalize_device_label(_value(row, indexes, "Updated Device")), timestamps.metadata_quality if timestamps else "imported_missing",
        str(raw_hash).strip() if raw_hash not in (None, "") else None, normalized_hash, status, tuple(issues),
    )


def _assign_sip_plan_ids(records: tuple[StagedShareRecord, ...]) -> tuple[StagedShareRecord, ...]:
    """Legacy rows have no plan ID; derive stable plan UUIDs from first installments."""
    open_plan: dict[str, str] = {}
    resolved: list[StagedShareRecord] = []
    for record in records:
        if record.entity_type != "sip" or not record.share_name or not record.event_type:
            resolved.append(record)
            continue
        key = record.share_name
        if record.event_type == "sip_installment":
            if record.status == "invalid":
                resolved.append(record)
                continue
            plan_id = open_plan.setdefault(
                key,
                str(uuid5(NAMESPACE_URL, f"finledge:legacy-sip:{key}:{record.row_id or record.identity_key}")),
            )
            updated = replace(record, sip_plan_id=plan_id)
        elif record.event_type == "sip_redemption":
            plan_id = open_plan.pop(key, None)
            if plan_id is None:
                issue = ShareImportIssue(
                    "sip_redemption_without_plan", "error",
                    "SIP redemption has no preceding unredeemed installment for this SIP name.", record.row_number,
                )
                updated = replace(record, status="invalid", issues=(*record.issues, issue))
            else:
                updated = replace(record, sip_plan_id=plan_id)
        else:
            resolved.append(record)
            continue

        if updated.status != "invalid":
            if updated.txn_date and updated.share_name and updated.sip_plan_id and updated.event_type:
                payload = {
                    "txn_date": updated.txn_date,
                    "investment_name": normalize_hash_text(updated.share_name, uppercase=True),
                    "sip_plan_id": updated.sip_plan_id,
                    "transaction_type": updated.event_type,
                    "amount_scaled": updated.amount_scaled,
                    "charge_scaled": updated.charge_scaled or 0,
                    "units": updated.units,
                }
                fields = ("txn_date", "investment_name", "sip_plan_id", "transaction_type", "amount_scaled", "charge_scaled", "units")
                updated = replace(updated, content_hash=content_hash(payload, fields))
        if updated.content_hash and updated.source_content_hash:
            source_hash = updated.source_content_hash.casefold()
            if _HASH_RE.fullmatch(updated.source_content_hash) and source_hash != updated.content_hash.casefold():
                issue = ShareImportIssue(
                    "content_hash_mismatch", "warning",
                    "Content Hash does not match the canonical event; it was recalculated for review.", updated.row_number,
                )
                updated = replace(updated, issues=(*updated.issues, issue))
        resolved.append(updated)
    return tuple(resolved)


def _money(value, field, row_number, issues, *, required):
    if value in (None, ""):
        if required:
            issues.append(_error(row_number, f"missing_{field.casefold().replace(' ', '_')}", f"{field} is required."))
        return None
    try:
        if isinstance(value, float):
            value = str(value)
        return decimal_to_scaled(Decimal(str(value)))
    except (InvalidOperation, TypeError, ValueError) as error:
        issues.append(_error(row_number, f"invalid_{field.casefold().replace(' ', '_')}", f"{field} must be a valid amount: {error}"))
        return None


def _whole(value, field, row_number, issues, *, allow_blank):
    if value in (None, ""):
        return None if allow_blank else 0
    try:
        number = Decimal(str(value))
        if number != number.to_integral_value():
            raise ValueError
        return int(number)
    except (InvalidOperation, TypeError, ValueError):
        issues.append(_error(row_number, f"invalid_{field.casefold().replace(' ', '_')}", f"{field} must be a whole number."))
        return None


def _value(row, indexes, name):
    index = indexes.get(header_key(name))
    return row[index] if index is not None and index < len(row) else None


def _issue(row_number, code, message):
    return ShareImportIssue(code, "error", message, row_number)


def _error(row_number, code, message):
    return _issue(row_number, code, message)
