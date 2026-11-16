"""Verified online SQLite snapshots for Desktop data operations."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable


@dataclass(frozen=True)
class SnapshotReport:
    path: Path
    schema_version: int
    table_row_counts: dict[str, int]
    created_timestamp: str


VERIFIED_SNAPSHOT_CALLBACK = Callable[[SnapshotReport], None]


def create_verified_snapshot(
    source: sqlite3.Connection,
    destination: str | Path,
    *,
    record_verified: VERIFIED_SNAPSHOT_CALLBACK,
    expected_schema_version: int | None = None,
) -> SnapshotReport:
    """Back up through SQLite's online backup API, verify, then record the result.

    The destination is explicit and must not already exist. A failed snapshot is
    left at that path for the caller's recovery/quarantine workflow; this helper
    never deletes or overwrites files.
    """
    if source.in_transaction:
        raise RuntimeError("A verified snapshot must start outside an active transaction")

    destination_path = Path(destination).expanduser().resolve()
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    with destination_path.open("xb"):
        pass

    snapshot = sqlite3.connect(destination_path, isolation_level=None)
    try:
        source.backup(snapshot)
        snapshot.row_factory = sqlite3.Row
        check = snapshot.execute("PRAGMA quick_check").fetchone()
        if check is None or check[0] != "ok":
            detail = "no result" if check is None else str(check[0])
            raise sqlite3.DatabaseError(f"Snapshot integrity check failed: {detail}")

        version = int(snapshot.execute("PRAGMA user_version").fetchone()[0])
        if expected_schema_version is not None and version != expected_schema_version:
            raise RuntimeError(
                f"Snapshot schema version {version} does not match expected "
                f"version {expected_schema_version}"
            )
        foreign_key_issues = snapshot.execute("PRAGMA foreign_key_check").fetchall()
        if foreign_key_issues:
            detail = "; ".join(str(tuple(row)) for row in foreign_key_issues[:5])
            raise sqlite3.IntegrityError(f"Snapshot has foreign-key violations: {detail}")

        report = SnapshotReport(
            path=destination_path,
            schema_version=version,
            table_row_counts=_table_row_counts(snapshot),
            created_timestamp=datetime.now(timezone.utc)
            .isoformat(timespec="microseconds")
            .replace("+00:00", "Z"),
        )
    finally:
        snapshot.close()

    record_verified(report)
    return report


def _table_row_counts(connection: sqlite3.Connection) -> dict[str, int]:
    table_names = [
        str(row[0])
        for row in connection.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    ]
    counts = {}
    for table_name in table_names:
        escaped_name = table_name.replace('"', '""')
        counts[table_name] = int(
            connection.execute(f'SELECT count(*) FROM "{escaped_name}"').fetchone()[0]
        )
    return counts

