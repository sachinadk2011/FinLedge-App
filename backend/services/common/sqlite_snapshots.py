"""Shared verified-snapshot boundary for SQLite write operations."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable

from backend.db.core import create_operation_snapshot
from backend.db.repositories import SPECS


def snapshot_before_operation(
    connection: sqlite3.Connection,
    kind: str,
    callback: Callable[[], object] | None = None,
) -> object:
    """Use the configured verified snapshot unless a test seam is injected."""
    if connection.in_transaction:
        raise RuntimeError("A verified snapshot must start outside an active transaction")
    if callback is None:
        return create_operation_snapshot(connection, kind)
    if not callable(callback):
        raise TypeError("A snapshot callback must be callable")
    return callback()


def replace_records_for_reviewed_import(
    connection: sqlite3.Connection,
    repository,
    *,
    incoming_row_ids: set[str],
    deleted_by_device: str,
    scope_column: str | None = None,
    scope_value: object | None = None,
) -> int:
    """Remove one allowlisted repository's old set while preserving live IDs.

    Rows absent from the reviewed source receive tombstones. Rows whose UUID is
    still present in the incoming set are reinserted under that same identity
    and therefore are not recorded as deletions.
    """
    if not connection.in_transaction:
        raise RuntimeError("Replace must run inside its caller-owned transaction")
    if repository.spec not in SPECS.values():
        raise TypeError("Replace requires a supported connection-scoped repository")
    table = repository.spec.table
    if scope_column is None:
        query = f"SELECT row_id FROM {table} ORDER BY sequence_no"
        parameters = ()
    else:
        if scope_column not in repository.spec.columns:
            raise ValueError(f"Replace scope {scope_column!r} is not valid for {table}")
        if scope_value is None:
            raise ValueError("A scoped Replace requires a scope value")
        query = f"SELECT row_id FROM {table} WHERE {scope_column} = ? ORDER BY sequence_no"
        parameters = (scope_value,)
    rows = list(connection.execute(query, parameters))
    removed_count = 0
    for row in rows:
        row_id = str(row["row_id"])
        if row_id in incoming_row_ids:
            connection.execute(f"DELETE FROM {table} WHERE row_id = ?", (row_id,))
            continue
        repository.delete(
            row_id,
            deleted_by_device=deleted_by_device,
            note="Removed by confirmed Replace import",
        )
        removed_count += 1
    return removed_count
