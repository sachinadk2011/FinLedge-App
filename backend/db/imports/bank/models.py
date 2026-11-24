"""Small immutable models for Bank workbook import review."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


ImportStatus = Literal["ready", "unsupported", "invalid", "possible_duplicate"]
MergeClassification = Literal["add", "already_present", "conflict", "possible_duplicate", "unsupported", "invalid"]
IssueSeverity = Literal["warning", "error"]


@dataclass(frozen=True)
class BankImportIssue:
    code: str
    severity: IssueSeverity
    message: str
    row_number: int | None = None


@dataclass(frozen=True)
class StagedBankRecord:
    row_number: int
    sequence_no: int
    row_id: str | None
    identity_key: str | None
    txn_date: str | None
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
    issues: tuple[BankImportIssue, ...] = ()


@dataclass(frozen=True)
class BankImportPlan:
    source_name: str
    records: tuple[StagedBankRecord, ...]
    issues: tuple[BankImportIssue, ...] = ()

    @property
    def counts_by_status(self) -> dict[str, int]:
        counts = {status: 0 for status in ("ready", "unsupported", "invalid", "possible_duplicate")}
        for record in self.records:
            counts[record.status] += 1
        return counts


@dataclass(frozen=True)
class BankImportReport:
    imported_count: int
    already_present_count: int
    imported_identity_count: int
    existing_identity_count: int
    imported_missing_rows: tuple[int, ...] = ()


@dataclass(frozen=True)
class BankMergeRow:
    staged: StagedBankRecord
    classification: MergeClassification
    resolved_row_id: str | None = None
    existing_record: dict[str, object] | None = None
    possible_duplicates: tuple[dict[str, object], ...] = ()
    review_message: str | None = None


@dataclass(frozen=True)
class BankMergePlan:
    source_name: str
    rows: tuple[BankMergeRow, ...]

    @property
    def counts_by_classification(self) -> dict[str, int]:
        counts = {name: 0 for name in ("add", "already_present", "conflict", "possible_duplicate", "unsupported", "invalid")}
        for row in self.rows:
            counts[row.classification] += 1
        return counts
