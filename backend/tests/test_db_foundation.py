from __future__ import annotations

import hashlib
import sqlite3
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import pytest

from backend.db.connection import connect_database
from backend.db.backup import create_verified_snapshot
from backend.db.content_hash import content_hash
from backend.db.metadata import stamp_create, stamp_material_edit
from backend.db.migration_runner import Migration, apply_migrations
from backend.db.row_mapping import decimal_to_scaled, scaled_to_decimal
from backend.db.schema import migrate_database, verify_sqlite_engine
from backend.db.support_repository import (
    add_tombstone,
    allocate_sequence,
    record_conflict,
    resolve_legacy_row_id,
)
from backend.db.transactions import transaction


def test_connection_requires_explicit_create_and_configures_pragmas(tmp_path: Path):
    database = tmp_path / "nested" / "finledge.db"
    with pytest.raises(FileNotFoundError):
        connect_database(database)
    assert not database.exists()

    connection = connect_database(database, create=True)
    try:
        assert connection.row_factory is sqlite3.Row
        assert connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        assert connection.execute("PRAGMA journal_mode").fetchone()[0].casefold() == "wal"
        assert connection.execute("PRAGMA synchronous").fetchone()[0] == 2
        assert connection.execute("PRAGMA busy_timeout").fetchone()[0] == 5_000
    finally:
        connection.close()


def test_newer_schema_is_opened_query_only(tmp_path: Path):
    database = tmp_path / "future.db"
    connection = connect_database(database, create=True)
    connection.execute("PRAGMA user_version = 2")
    connection.close()

    newer = connect_database(database, supported_schema_version=1)
    try:
        assert newer.read_only_reason
        with pytest.raises(sqlite3.OperationalError):
            newer.execute("CREATE TABLE should_not_exist (id INTEGER)")
    finally:
        newer.close()


def test_corrupt_database_is_reported_without_replacement(tmp_path: Path):
    database = tmp_path / "corrupt.db"
    original = b"not a sqlite database"
    database.write_bytes(original)

    with pytest.raises(sqlite3.DatabaseError):
        connect_database(database)
    assert database.read_bytes() == original


def test_transaction_commits_or_rolls_back_as_a_unit(tmp_path: Path):
    connection = connect_database(tmp_path / "transactions.db", create=True)
    try:
        connection.execute("CREATE TABLE values_table (value INTEGER NOT NULL)")
        with transaction(connection):
            connection.execute("INSERT INTO values_table VALUES (1)")
        assert [row[0] for row in connection.execute("SELECT value FROM values_table")] == [1]

        with pytest.raises(ValueError):
            with transaction(connection):
                connection.execute("INSERT INTO values_table VALUES (2)")
                raise ValueError("force rollback")
        assert [row[0] for row in connection.execute("SELECT value FROM values_table")] == [1]
    finally:
        connection.close()


def test_metadata_preserves_create_fields_and_only_stamps_material_edits():
    created = stamp_create("desktop-dev", timestamp="2026-11-13T00:00:00.000000Z")
    assert created == {
        "created_timestamp": "2026-11-13T00:00:00.000000Z",
        "last_updated_timestamp": "2026-11-13T00:00:00.000000Z",
        "updated_device": "desktop-dev",
    }
    assert stamp_material_edit(created, "desktop-test", changed=False) == created
    changed = stamp_material_edit(
        created,
        "desktop-test",
        changed=True,
        timestamp="2026-11-13T00:01:00.000000Z",
    )
    assert changed["created_timestamp"] == created["created_timestamp"]
    assert changed["last_updated_timestamp"] == "2026-11-13T00:01:00.000000Z"
    assert changed["updated_device"] == "desktop-test"


def test_content_hash_is_deterministic_and_rejects_float():
    fields = ("transaction_type", "amount_scaled", "investment_name")
    left = {"investment_name": "ABC", "amount_scaled": 12500, "transaction_type": "buy"}
    right = {"transaction_type": "buy", "investment_name": "ABC", "amount_scaled": 12500}
    expected = "sha256:" + hashlib.sha256(
        b'{"amount_scaled":12500,"investment_name":"ABC","transaction_type":"buy"}'
    ).hexdigest()
    assert content_hash(left, fields) == content_hash(right, fields) == expected
    with pytest.raises(TypeError):
        content_hash({"amount": 1.25}, ("amount",))


def test_scaled_mapping_is_exact_and_never_silently_rounds():
    assert decimal_to_scaled(Decimal("12.3456")) == 123456
    assert scaled_to_decimal(123456) == Decimal("12.3456")
    with pytest.raises(ValueError, match="more precision"):
        decimal_to_scaled(Decimal("1.00001"))
    with pytest.raises(TypeError, match="Binary float"):
        decimal_to_scaled(1.25)


def test_migration_runner_requires_backup_and_records_immutable_checksum(tmp_path: Path):
    connection = connect_database(tmp_path / "migrations.db", create=True)
    sql = """
    -- The migration and its history row must commit together.
    CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_timestamp TEXT NOT NULL,
        checksum TEXT NOT NULL,
        description TEXT NOT NULL
    );
    CREATE TABLE sample (value INTEGER NOT NULL);
    """
    migration = Migration(
        version=1,
        name="0001_initial.sql",
        sql=sql,
        checksum=hashlib.sha256(sql.encode("utf-8")).hexdigest(),
    )
    snapshots = []
    try:
        version = apply_migrations(
            connection,
            [migration],
            before_migration=lambda number, name: snapshots.append((number, name)),
        )
        assert version == 1
        assert snapshots == [(1, "0001_initial.sql")]
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 1
        assert connection.execute(
            "SELECT version, checksum FROM schema_migrations"
        ).fetchone()["checksum"] == migration.checksum

        assert apply_migrations(
            connection,
            [migration],
            before_migration=lambda *_: pytest.fail("applied migration must not snapshot again"),
        ) == 1
    finally:
        connection.close()


def test_verified_snapshot_uses_online_backup_and_records_only_after_checks(tmp_path: Path):
    source = connect_database(tmp_path / "source.db", create=True)
    destination = tmp_path / "backups" / "snapshot.db"
    source.execute("CREATE TABLE sample (value INTEGER NOT NULL)")
    source.execute("INSERT INTO sample VALUES (7)")
    source.execute("PRAGMA user_version = 3")
    records = []
    try:
        report = create_verified_snapshot(
            source,
            destination,
            expected_schema_version=3,
            record_verified=records.append,
        )
        assert report.path == destination.resolve()
        assert report.schema_version == 3
        assert report.table_row_counts == {"sample": 1}
        assert records == [report]
        snapshot = sqlite3.connect(f"{destination.resolve().as_uri()}?mode=ro", uri=True)
        try:
            assert snapshot.execute("SELECT value FROM sample").fetchone()[0] == 7
        finally:
            snapshot.close()
    finally:
        source.close()


def test_snapshot_never_overwrites_an_existing_destination(tmp_path: Path):
    source = connect_database(tmp_path / "source.db", create=True)
    destination = tmp_path / "existing.db"
    original = b"do not overwrite"
    destination.write_bytes(original)
    try:
        with pytest.raises(FileExistsError):
            create_verified_snapshot(source, destination, record_verified=lambda _report: None)
        assert destination.read_bytes() == original
    finally:
        source.close()


def test_documented_initial_schema_migrates_with_approved_three_event_tables(tmp_path: Path):
    verify_sqlite_engine((3, 37, 0))
    with pytest.raises(RuntimeError, match="requires SQLite"):
        verify_sqlite_engine((3, 36, 0))

    connection = connect_database(tmp_path / "initial-schema.db", create=True)
    snapshots = []
    try:
        assert migrate_database(
            connection,
            before_migration=lambda version, name: snapshots.append((version, name)),
        ) == 1
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        assert {"share_transactions", "sip_transactions", "dividend_events"} <= tables
        assert {"share_holdings", "sip_plan_summaries"} <= tables
        assert "investment_transactions" not in tables
        assert "sip_plans" not in tables
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
        assert connection.execute("SELECT value FROM app_metadata WHERE key='schema_version'").fetchone()[0] == "1"
        assert snapshots == [(1, "0001_initial.sql")]
    finally:
        connection.close()


def test_support_repository_requires_transaction_and_allocates_separate_scopes(tmp_path: Path):
    connection = connect_database(tmp_path / "support.db", create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    try:
        with pytest.raises(RuntimeError, match="active transaction"):
            allocate_sequence(connection, "share")
        with transaction(connection):
            assert allocate_sequence(connection, "share") == 1
            assert allocate_sequence(connection, "sip") == 1
            assert allocate_sequence(connection, "share") == 2
    finally:
        connection.close()


def test_support_repository_tombstone_conflict_and_legacy_identity(tmp_path: Path):
    connection = connect_database(tmp_path / "support-records.db", create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    row_id = "12345678-1234-5678-1234-567812345678"
    try:
        with transaction(connection):
            add_tombstone(
                connection,
                row_id=row_id,
                entity_type="share",
                deleted_by_device="desktop-dev",
                sequence_no=4,
                deleted_timestamp="2026-11-13T00:00:00.000000Z",
            )
            first_conflict = record_conflict(
                connection,
                row_id=row_id,
                entity_type="share",
                losing_values={"amount_scaled": 100, "transaction_type": "buy"},
                losing_device="desktop-test",
            )
            repeated_conflict = record_conflict(
                connection,
                row_id=row_id,
                entity_type="share",
                losing_values={"transaction_type": "buy", "amount_scaled": 100},
                losing_device="desktop-test",
            )
            legacy_id = resolve_legacy_row_id(connection, "share.xlsx#share:row:1")
            assert resolve_legacy_row_id(connection, "share.xlsx#share:row:1") == legacy_id

        assert first_conflict == repeated_conflict
        deleted = connection.execute(
            "SELECT entity_type, sequence_no FROM deleted_records WHERE row_id=?",
            (row_id,),
        ).fetchone()
        assert (deleted["entity_type"], deleted["sequence_no"]) == ("share", 4)
        assert str(UUID(legacy_id)) == legacy_id
    finally:
        connection.close()
