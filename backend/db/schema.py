"""Desktop SQLite schema migration entry points."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from .migration_runner import SNAPSHOT_CALLBACK, apply_migrations, discover_migrations


MINIMUM_SQLITE_VERSION = (3, 37, 0)
MIGRATIONS_DIRECTORY = Path(__file__).with_name("migrations")


def verify_sqlite_engine(version: tuple[int, ...] | None = None) -> None:
    """Refuse schema initialization if STRICT table support is unavailable."""
    detected = version or sqlite3.sqlite_version_info
    if tuple(detected[:3]) < MINIMUM_SQLITE_VERSION:
        found = ".".join(str(part) for part in detected[:3])
        required = ".".join(str(part) for part in MINIMUM_SQLITE_VERSION)
        raise RuntimeError(
            f"FinLedge requires SQLite {required} or newer; found {found}. "
            "Database initialization was not started."
        )


def migrate_database(
    connection: sqlite3.Connection,
    *,
    before_migration: SNAPSHOT_CALLBACK,
    migrations_directory: str | Path = MIGRATIONS_DIRECTORY,
) -> int:
    """Apply packaged migrations after the caller has arranged verified backups."""
    verify_sqlite_engine()
    migrations = discover_migrations(migrations_directory)
    return apply_migrations(
        connection,
        migrations,
        before_migration=before_migration,
    )

