"""Forward-only, checksum-verified SQLite migrations."""

from __future__ import annotations

import hashlib
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

from .metadata import utc_timestamp_now
from .transactions import transaction


MIGRATION_NAME = re.compile(r"^(?P<version>[0-9]{4})_[a-z0-9_]+\.sql$")
SNAPSHOT_CALLBACK = Callable[[int, str], None]


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    sql: str
    checksum: str


def discover_migrations(migrations_dir: str | Path) -> list[Migration]:
    """Read ordered SQL migration files without executing or creating a database."""
    directory = Path(migrations_dir)
    migrations = []
    for path in sorted(directory.glob("*.sql")):
        match = MIGRATION_NAME.fullmatch(path.name)
        if not match:
            raise ValueError(f"Invalid migration filename: {path.name}")
        sql = path.read_text(encoding="utf-8")
        migrations.append(
            Migration(
                version=int(match.group("version")),
                name=path.name,
                sql=sql,
                checksum=hashlib.sha256(sql.encode("utf-8")).hexdigest(),
            )
        )
    versions = [migration.version for migration in migrations]
    if len(versions) != len(set(versions)):
        raise ValueError("Migration versions must be unique")
    if versions and versions != list(range(1, max(versions) + 1)):
        raise ValueError("Migration versions must be contiguous and start at 0001")
    return migrations


def apply_migrations(
    connection: sqlite3.Connection,
    migrations: Iterable[Migration],
    *,
    before_migration: SNAPSHOT_CALLBACK,
) -> int:
    """Apply each migration atomically after its required verified snapshot.

    The callback must complete a verified snapshot or raise. This function never
    chooses a backup path and never performs filesystem cleanup.
    """
    ordered = sorted(migrations, key=lambda migration: migration.version)
    _validate_order(ordered)

    current_version = int(connection.execute("PRAGMA user_version").fetchone()[0])
    latest_version = ordered[-1].version if ordered else 0
    if current_version > latest_version:
        raise RuntimeError(
            f"Database schema version {current_version} is newer than available "
            f"migrations ({latest_version}); refusing to downgrade"
        )

    history_exists = _table_exists(connection, "schema_migrations")
    if current_version > 0 and not history_exists:
        raise RuntimeError("Database version is set but schema_migrations is missing")
    applied = _read_history(connection) if history_exists else {}
    if set(applied) != set(range(1, current_version + 1)):
        raise RuntimeError("schema_migrations history does not match PRAGMA user_version")

    for migration in ordered:
        if migration.version <= current_version:
            if applied[migration.version] != migration.checksum:
                raise RuntimeError(
                    f"Applied migration {migration.name} has a different checksum; "
                    "migration files are immutable"
                )
            continue

        before_migration(migration.version, migration.name)
        with transaction(connection):
            _execute_script(connection, migration.sql)
            if not _table_exists(connection, "schema_migrations"):
                raise RuntimeError("Migration did not create schema_migrations")
            connection.execute(
                "INSERT INTO schema_migrations "
                "(version, applied_timestamp, checksum, description) VALUES (?, ?, ?, ?)",
                (migration.version, utc_timestamp_now(), migration.checksum, migration.name),
            )
            connection.execute(f"PRAGMA user_version = {migration.version}")
            _verify_migrated_database(connection)
        current_version = migration.version

    return current_version


def _validate_order(migrations: list[Migration]) -> None:
    versions = [migration.version for migration in migrations]
    if len(versions) != len(set(versions)):
        raise ValueError("Migration versions must be unique")
    if versions != sorted(versions):
        raise ValueError("Migrations must be supplied in ascending order")
    if versions and versions != list(range(1, len(versions) + 1)):
        raise ValueError("Migration versions must be contiguous and start at 0001")
    for migration in migrations:
        match = MIGRATION_NAME.fullmatch(migration.name)
        expected_checksum = hashlib.sha256(migration.sql.encode("utf-8")).hexdigest()
        if match is None or int(match.group("version")) != migration.version:
            raise ValueError(f"Migration name does not match version {migration.version}")
        if migration.checksum != expected_checksum:
            raise ValueError(f"Migration {migration.name} checksum does not match its SQL")


def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone() is not None


def _read_history(connection: sqlite3.Connection) -> dict[int, str]:
    return {
        int(row["version"]): str(row["checksum"])
        for row in connection.execute(
            "SELECT version, checksum FROM schema_migrations ORDER BY version"
        )
    }


def _execute_script(connection: sqlite3.Connection, script: str) -> None:
    statement = ""
    for line in script.splitlines(keepends=True):
        statement += line
        if sqlite3.complete_statement(statement):
            sql = statement.strip()
            statement = ""
            if sql:
                connection.execute(sql)
    if statement.strip():
        raise sqlite3.ProgrammingError("Migration contains an incomplete SQL statement")


def _verify_migrated_database(connection: sqlite3.Connection) -> None:
    quick_check = connection.execute("PRAGMA quick_check").fetchone()
    if quick_check is None or quick_check[0] != "ok":
        detail = "no result" if quick_check is None else str(quick_check[0])
        raise sqlite3.DatabaseError(f"Migrated database integrity check failed: {detail}")
    foreign_key_issues = connection.execute("PRAGMA foreign_key_check").fetchall()
    if foreign_key_issues:
        detail = "; ".join(str(tuple(row)) for row in foreign_key_issues[:5])
        raise sqlite3.IntegrityError(f"Migrated database has foreign-key violations: {detail}")

