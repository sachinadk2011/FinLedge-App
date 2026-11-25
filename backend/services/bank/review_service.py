"""Read-only Smart Merge classification for staged Bank workbook rows."""

from __future__ import annotations

import sqlite3

from backend.db.imports.bank.models import BankImportPlan, BankMergePlan, BankMergeRow, StagedBankRecord
from backend.db.repositories import BankRepository, find_other_entity_owner, get_tombstone


def classify_bank_import(connection: sqlite3.Connection, plan: BankImportPlan) -> BankMergePlan:
    """Classify staged rows against an existing database without writing to it."""
    repository = BankRepository(connection)
    classified = tuple(_classify_row(connection, repository, record) for record in plan.records)
    return BankMergePlan(source_name=plan.source_name, rows=classified)


def _classify_row(
    connection: sqlite3.Connection,
    repository: BankRepository,
    staged: StagedBankRecord,
) -> BankMergeRow:
    if staged.status == "invalid":
        return BankMergeRow(staged=staged, classification="invalid", review_message=_issue_summary(staged))
    if staged.status == "unsupported":
        return BankMergeRow(staged=staged, classification="unsupported", review_message=_issue_summary(staged))
    if staged.status == "possible_duplicate":
        return BankMergeRow(staged=staged, classification="possible_duplicate", review_message=_issue_summary(staged))

    row_id = staged.row_id
    if row_id is None and staged.identity_key:
        mapped = connection.execute(
            "SELECT row_id FROM legacy_identity_map WHERE identity_key = ?",
            (staged.identity_key,),
        ).fetchone()
        row_id = str(mapped["row_id"]) if mapped is not None else None

    if row_id:
        owner = find_other_entity_owner(connection, row_id, "bank")
        if owner:
            return BankMergeRow(
                staged=staged,
                classification="invalid",
                resolved_row_id=row_id,
                review_message=f"This UUID already belongs to the {owner} entity.",
            )

        tombstone = get_tombstone(connection, row_id)
        if tombstone is not None and str(tombstone["entity_type"]) != "bank":
            return BankMergeRow(
                staged=staged,
                classification="invalid",
                resolved_row_id=row_id,
                existing_record=tombstone,
                review_message="This UUID has a deletion record for a different entity type.",
            )
        if tombstone is not None and str(tombstone["deleted_timestamp"]) > staged.last_updated_timestamp:
            return BankMergeRow(
                staged=staged,
                classification="conflict",
                resolved_row_id=row_id,
                existing_record={
                    "row_id": row_id,
                    "deleted_timestamp": str(tombstone["deleted_timestamp"]),
                    "deleted_by_device": str(tombstone["deleted_by_device"]),
                },
                review_message="A newer deletion record prevents this Bank row from being restored automatically.",
            )

        existing = repository.get(row_id)
        if existing is not None:
            values = dict(existing)
            if str(existing["content_hash"]) == staged.content_hash:
                return BankMergeRow(
                    staged=staged,
                    classification="already_present",
                    resolved_row_id=row_id,
                    existing_record=values,
                )
            return BankMergeRow(
                staged=staged,
                classification="conflict",
                resolved_row_id=row_id,
                existing_record=values,
                review_message="This Row ID already exists with different business content.",
            )

    candidates = repository.find_possible_duplicates(
        txn_date=staged.txn_date or "",
        category=staged.category or "",
        amount_scaled=staged.amount_scaled if staged.amount_scaled is not None else 0,
        description=staged.description,
        excluding_row_id=row_id,
    )
    if candidates:
        return BankMergeRow(
            staged=staged,
            classification="possible_duplicate",
            resolved_row_id=row_id,
            possible_duplicates=tuple(candidates),
            review_message="A different Row ID has matching date, amount, category, and normalized description.",
        )
    return BankMergeRow(staged=staged, classification="add", resolved_row_id=row_id)


def _issue_summary(record: StagedBankRecord) -> str | None:
    messages = [issue.message for issue in record.issues]
    return " ".join(messages) if messages else None
