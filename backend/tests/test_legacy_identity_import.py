from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.db.core import connect_database, migrate_database, transaction
from backend.db.imports.common import import_legacy_identity_file, load_legacy_identity_entries
from backend.db.repositories import resolve_legacy_row_id


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def test_identity_file_import_preserves_uuid_and_is_idempotent(tmp_path: Path):
    identity_path = tmp_path / "row-identity-map.json"
    identity_path.write_text(
        json.dumps({"bank_transactions.xlsx#bank:row-a": "{12345678-1234-5678-1234-567812345678}"}),
        encoding="utf-8",
    )
    connection = _database(tmp_path / "import-identity.db")
    try:
        with transaction(connection):
            assert import_legacy_identity_file(
                connection,
                identity_path,
                created_timestamp="2026-11-24T00:00:00.000000Z",
            ) == (1, 0)
        with transaction(connection):
            assert import_legacy_identity_file(connection, identity_path) == (0, 1)
            assert resolve_legacy_row_id(connection, "bank_transactions.xlsx#bank:row-a") == (
                "12345678-1234-5678-1234-567812345678"
            )
        assert load_legacy_identity_entries(identity_path) == {
            "bank_transactions.xlsx#bank:row-a": "12345678-1234-5678-1234-567812345678"
        }
    finally:
        connection.close()


@pytest.mark.parametrize(
    ("content", "message"),
    [
        ('{"key":"12345678-1234-5678-1234-567812345678","key":"87654321-4321-8765-4321-876543218765"}', "duplicate JSON key"),
        ('{"key":"not-a-uuid"}', "invalid UUID"),
        ('{"a":"12345678-1234-5678-1234-567812345678","b":"12345678-1234-5678-1234-567812345678"}', "assigns UUID"),
        ('[]', "one JSON object"),
    ],
)
def test_invalid_identity_file_is_rejected_before_database_write(tmp_path: Path, content: str, message: str):
    identity_path = tmp_path / "invalid-map.json"
    identity_path.write_text(content, encoding="utf-8")
    connection = _database(tmp_path / "invalid-map.db")
    try:
        with pytest.raises(ValueError, match=message):
            with transaction(connection):
                import_legacy_identity_file(connection, identity_path)
        assert connection.execute("SELECT COUNT(*) FROM legacy_identity_map").fetchone()[0] == 0
    finally:
        connection.close()


def test_identity_file_import_requires_transaction_and_preserves_existing_mapping(tmp_path: Path):
    identity_path = tmp_path / "conflict-map.json"
    identity_path.write_text(
        json.dumps({"bank_transactions.xlsx#bank:row-a": "87654321-4321-8765-4321-876543218765"}),
        encoding="utf-8",
    )
    connection = _database(tmp_path / "conflict-map.db")
    try:
        with pytest.raises(RuntimeError, match="active caller-owned transaction"):
            import_legacy_identity_file(connection, identity_path)
        with transaction(connection):
            resolve_legacy_row_id(connection, "bank_transactions.xlsx#bank:row-a")
        with pytest.raises(ValueError, match="already mapped to a different row_id"):
            with transaction(connection):
                import_legacy_identity_file(connection, identity_path)
        with transaction(connection):
            assert resolve_legacy_row_id(connection, "bank_transactions.xlsx#bank:row-a") != (
                "87654321-4321-8765-4321-876543218765"
            )
    finally:
        connection.close()
