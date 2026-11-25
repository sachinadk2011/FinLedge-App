"""Operation-scoped verified snapshots for Desktop SQLite writes."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from .backup import SnapshotReport, create_verified_snapshot
from .connection import SUPPORTED_SCHEMA_VERSION


SnapshotKind = Literal[
    "migration", "auto", "safety-copy", "pre-import", "pre-replace",
    "pre-restore", "repair", "manual-rebuild",
]
_SNAPSHOT_KINDS = frozenset(SnapshotKind.__args__)


def create_operation_snapshot(
    connection: sqlite3.Connection,
    kind: SnapshotKind,
    *,
    backup_root: str | Path | None = None,
    expected_schema_version: int = SUPPORTED_SCHEMA_VERSION,
) -> SnapshotReport:
    """Create an immutable, verified snapshot and record its manifest.

    The configured backup root is mandatory unless the caller supplies an
    explicit root. This prevents accidental fallback into another environment.
    Snapshot directories and files are created exclusively and are never
    replaced or pruned here.
    """
    if kind not in _SNAPSHOT_KINDS:
        raise ValueError(f"Unsupported SQLite snapshot kind: {kind!r}")
    if connection.in_transaction:
        raise RuntimeError("A verified snapshot must start outside an active transaction")

    configured_root = backup_root if backup_root is not None else os.getenv("FINLEDGE_BACKUP_DIR")
    if not str(configured_root or "").strip():
        raise RuntimeError("FINLEDGE_BACKUP_DIR or an explicit backup root is required for SQLite snapshots")
    root = Path(configured_root).expanduser().resolve()
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H%M%S%f")
    snapshot_directory = root / kind / timestamp
    snapshot_directory.mkdir(parents=True, exist_ok=False)
    destination = snapshot_directory / "finledge.db"

    def record_verified(report: SnapshotReport) -> None:
        manifest = {
            "kind": kind,
            "snapshot_file": report.path.name,
            "created_timestamp": report.created_timestamp,
            "schema_version": report.schema_version,
            "table_row_counts": report.table_row_counts,
        }
        manifest_path = snapshot_directory / "manifest.json"
        with manifest_path.open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(manifest, handle, sort_keys=True, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())

    return create_verified_snapshot(
        connection,
        destination,
        record_verified=record_verified,
        expected_schema_version=expected_schema_version,
    )
