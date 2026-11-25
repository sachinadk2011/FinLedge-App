"""Read-only Smart Merge classification for staged Personal Finance rows."""

from __future__ import annotations

import sqlite3

from backend.db.imports.personal_finance.models import (
    PersonalFinanceImportPlan,
    PersonalFinanceMergePlan,
    PersonalFinanceMergeRow,
    StagedPersonalFinanceRecord,
)
from backend.db.repositories import (
    PersonalFinanceRepository,
    find_other_entity_owner,
    get_tombstone,
)


def classify_personal_finance_import(
    connection: sqlite3.Connection,
    plan: PersonalFinanceImportPlan,
) -> PersonalFinanceMergePlan:
    """Classify staged rows without writing to SQLite or the source workbook."""
    repository = PersonalFinanceRepository(connection)
    rows = tuple(_classify_row(connection, repository, row) for row in plan.records)
    return PersonalFinanceMergePlan(
        source_name=plan.source_name,
        flow_type=plan.flow_type,
        rows=rows,
    )


def _classify_row(
    connection: sqlite3.Connection,
    repository: PersonalFinanceRepository,
    staged: StagedPersonalFinanceRecord,
) -> PersonalFinanceMergeRow:
    if staged.status != "ready":
        messages = " ".join(issue.message for issue in staged.issues)
        return PersonalFinanceMergeRow(
            staged=staged,
            classification=staged.status,
            review_message=messages or f"This row is {staged.status} and must be reviewed.",
        )

    row_id = staged.row_id
    if row_id is None and staged.identity_key:
        mapped = connection.execute(
            "SELECT row_id FROM legacy_identity_map WHERE identity_key = ?",
            (staged.identity_key,),
        ).fetchone()
        row_id = str(mapped["row_id"]) if mapped is not None else None

    if row_id:
        owner = find_other_entity_owner(connection, row_id, "personal_finance")
        if owner:
            return PersonalFinanceMergeRow(
                staged=staged,
                classification="invalid",
                resolved_row_id=row_id,
                review_message=f"This UUID already belongs to the {owner} entity.",
            )

        tombstone = get_tombstone(connection, row_id)
        if tombstone is not None and str(tombstone["entity_type"]) != "personal_finance":
            return PersonalFinanceMergeRow(
                staged=staged,
                classification="invalid",
                resolved_row_id=row_id,
                existing_record=tombstone,
                review_message="This UUID has a deletion record for a different entity type.",
            )
        if tombstone is not None and str(tombstone["deleted_timestamp"]) > staged.last_updated_timestamp:
            return PersonalFinanceMergeRow(
                staged=staged,
                classification="conflict",
                resolved_row_id=row_id,
                existing_record=tombstone,
                review_message="A newer deletion record prevents this Personal Finance row from being restored automatically.",
            )

        existing = repository.get(row_id)
        if existing is not None:
            values = dict(existing)
            actual_hash = repository.canonical_content_hash(values)
            if actual_hash != str(existing["content_hash"]):
                return PersonalFinanceMergeRow(
                    staged=staged,
                    classification="invalid",
                    resolved_row_id=row_id,
                    existing_record=values,
                    review_message="The local Personal Finance row has a stale content hash and needs repair before import.",
                )
            if actual_hash == staged.content_hash:
                return PersonalFinanceMergeRow(
                    staged=staged,
                    classification="already_present",
                    resolved_row_id=row_id,
                    existing_record=values,
                )
            return PersonalFinanceMergeRow(
                staged=staged,
                classification="conflict",
                resolved_row_id=row_id,
                existing_record=values,
                review_message="This Row ID already exists with different Personal Finance business content.",
            )

    candidates = repository.find_possible_duplicates(
        txn_date=staged.txn_date or "",
        flow_type=staged.flow_type,
        direction=staged.direction or "",
        category=staged.category or "",
        amount_scaled=staged.amount_scaled if staged.amount_scaled is not None else 0,
        description=staged.description,
        excluding_row_id=row_id,
    )
    if candidates:
        return PersonalFinanceMergeRow(
            staged=staged,
            classification="possible_duplicate",
            resolved_row_id=row_id,
            possible_duplicates=tuple(candidates),
            review_message="A different Row ID has matching date, flow, direction, category, amount, and normalized description.",
        )
    return PersonalFinanceMergeRow(staged=staged, classification="add", resolved_row_id=row_id)
