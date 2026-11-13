"""Safe SQLite connection setup used by Desktop repositories."""

from __future__ import annotations

import sqlite3
from pathlib import Path


SUPPORTED_SCHEMA_VERSION = 1
BUSY_TIMEOUT_MS = 5_000


class FinLedgeConnection(sqlite3.Connection):
    """Connection that exposes why writes may be disabled."""

    read_only_reason: str | None = None


def connect_database(
    database_path: str | Path,
    *,
    readonly: bool = False,
    create: bool = False,
    supported_schema_version: int = SUPPORTED_SCHEMA_VERSION,
) -> FinLedgeConnection:
    """Open and configure a database at an explicitly supplied path.

    The caller owns path selection. A missing database is not created unless
    ``create=True`` is passed. A database created by a newer app is opened in
    query-only mode and carries a ``read_only_reason`` for the caller to show.
    """
    path = Path(database_path).expanduser().resolve()
    if not path.exists():
        if not create or readonly:
            raise FileNotFoundError(f"FinLedge database does not exist: {path}")
        path.parent.mkdir(parents=True, exist_ok=True)

    if readonly:
        uri = f"{path.as_uri()}?mode=ro"
        connection = sqlite3.connect(
            uri,
            uri=True,
            timeout=BUSY_TIMEOUT_MS / 1000,
            isolation_level=None,
            factory=FinLedgeConnection,
        )
    else:
        connection = sqlite3.connect(
            path,
            timeout=BUSY_TIMEOUT_MS / 1000,
            isolation_level=None,
            factory=FinLedgeConnection,
        )

    connection.row_factory = sqlite3.Row
    connection.execute(f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}")
    connection.execute("PRAGMA foreign_keys = ON")
    if connection.execute("PRAGMA foreign_keys").fetchone()[0] != 1:
        connection.close()
        raise RuntimeError("SQLite foreign-key enforcement could not be enabled")

    quick_check = connection.execute("PRAGMA quick_check").fetchone()
    if quick_check is None or quick_check[0] != "ok":
        connection.close()
        detail = "no result" if quick_check is None else str(quick_check[0])
        raise sqlite3.DatabaseError(f"SQLite integrity check failed: {detail}")

    schema_version = int(connection.execute("PRAGMA user_version").fetchone()[0])
    if schema_version > supported_schema_version and not readonly:
        connection.execute("PRAGMA query_only = ON")
        connection.read_only_reason = (
            f"This database uses schema version {schema_version}; this app supports "
            f"version {supported_schema_version}. It is open read-only to prevent "
            "a downgrade or data loss. Update FinLedge to make changes."
        )
        return connection

    if not readonly:
        journal_mode = str(connection.execute("PRAGMA journal_mode = WAL").fetchone()[0]).lower()
        if journal_mode != "wal":
            connection.close()
            raise sqlite3.OperationalError(
                f"SQLite WAL mode is required, but the database reported {journal_mode!r}"
            )
        connection.execute("PRAGMA synchronous = FULL")
    return connection

