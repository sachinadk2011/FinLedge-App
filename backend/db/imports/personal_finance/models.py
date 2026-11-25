"""Immutable staging models for Desktop Personal Finance workbook imports."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


ImportStatus = Literal["ready", "unsupported", "invalid", "possible_duplicate"]
IssueSeverity = Literal["warning", "error"]
MergeClassification = Literal["add", "already_present", "conflict", "possible_duplicate", "unsupported", "invalid"]


@dataclass(frozen=True)
class PersonalFinanceImportIssue:
    code: str
    severity: IssueSeverity
    message: str
    row_number: int | None = None


@dataclass(frozen=True)
class StagedPersonalFinanceRecord:
    row_number: int
    sequence_no: int
    row_id: str | None
    identity_key: str | None
    txn_date: str | None
    flow_type: str
    direction: str | None
    category: str | None
    amount_scaled: int | None
    description: str | None
    created_timestamp: str
    last_updated_timestamp: str
    updated_device: str
    metadata_quality: str
    source_content_hash: str | None
    content_hash: str | None
    status: ImportStatus
    issues: tuple[PersonalFinanceImportIssue, ...] = ()


@dataclass(frozen=True)
class PersonalFinanceImportPlan:
    source_name: str
    flow_type: Literal["bank", "cash"]
    sheet_name: str
    records: tuple[StagedPersonalFinanceRecord, ...]
    issues: tuple[PersonalFinanceImportIssue, ...] = ()

    @property
    def counts_by_status(self) -> dict[str, int]:
        counts = {status: 0 for status in ("ready", "unsupported", "invalid", "possible_duplicate")}
        for record in self.records:
            counts[record.status] += 1
        return counts


@dataclass(frozen=True)
class PersonalFinanceImportReport:
    imported_count: int
    already_present_count: int
    imported_identity_count: int
    existing_identity_count: int
    imported_missing_rows: tuple[int, ...] = ()


@dataclass(frozen=True)
class PersonalFinanceReplaceReport:
    flow_type: Literal["bank", "cash"]
    imported_count: int
    removed_count: int
    snapshot_path: str
    imported_identity_count: int = 0
    existing_identity_count: int = 0
    imported_missing_rows: tuple[int, ...] = ()


@dataclass(frozen=True)
class PersonalFinanceMergeRow:
    staged: StagedPersonalFinanceRecord
    classification: MergeClassification
    resolved_row_id: str | None = None
    existing_record: dict[str, object] | None = None
    possible_duplicates: tuple[dict[str, object], ...] = ()
    review_message: str | None = None


@dataclass(frozen=True)
class PersonalFinanceMergePlan:
    source_name: str
    flow_type: Literal["bank", "cash"]
    rows: tuple[PersonalFinanceMergeRow, ...]

    @property
    def counts_by_classification(self) -> dict[str, int]:
        counts = {name: 0 for name in ("add", "already_present", "conflict", "possible_duplicate", "unsupported", "invalid")}
        for row in self.rows:
            counts[row.classification] += 1
        return counts


@dataclass(frozen=True)
class PersonalFinanceConflictResolutionReport:
    row_id: str
    conflict_id: int
    resolution: Literal["kept_local", "kept_incoming"]
    row_updated: bool
