"""Operation snapshot path, verification manifest, and safety contracts."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

from backend.db.core import connect_database, create_operation_snapshot, migrate_database
from backend.services.common import snapshot_before_operation


def _database(path: Path):
    connection = connect_database(path, create=True)
    migrate_database(connection, before_migration=lambda *_: None)
    return connection


def test_operation_snapshot_writes_verified_manifest_after_snapshot(tmp_path: Path):
    connection = _database(tmp_path / "source.db")
    connection.execute("INSERT INTO app_metadata(key, value) VALUES ('snapshot-test', 'kept')")
    try:
        report = create_operation_snapshot(connection, "pre-replace", backup_root=tmp_path / "backups")

        assert report.path.parent.parent == (tmp_path / "backups" / "pre-replace").resolve()
        assert report.path.is_file()
        manifest_path = report.path.parent / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        assert manifest["kind"] == "pre-replace"
        assert manifest["schema_version"] == report.schema_version
        assert manifest["table_row_counts"]["app_metadata"] >= 1

        snapshot = sqlite3.connect(f"{report.path.as_uri()}?mode=ro", uri=True)
        try:
            assert snapshot.execute(
                "SELECT value FROM app_metadata WHERE key='snapshot-test'"
            ).fetchone()[0] == "kept"
        finally:
            snapshot.close()
    finally:
        connection.close()


def test_operation_snapshot_requires_explicit_environment_root(tmp_path: Path, monkeypatch):
    connection = _database(tmp_path / "source.db")
    monkeypatch.delenv("FINLEDGE_BACKUP_DIR", raising=False)
    try:
        with pytest.raises(RuntimeError, match="backup root is required"):
            create_operation_snapshot(connection, "pre-import")
        assert not (tmp_path / "Backups").exists()
    finally:
        connection.close()


def test_snapshot_boundary_defaults_to_verified_environment_snapshot(tmp_path: Path, monkeypatch):
    connection = _database(tmp_path / "source.db")
    root = tmp_path / "environment-backups"
    monkeypatch.setenv("FINLEDGE_BACKUP_DIR", str(root))
    try:
        report = snapshot_before_operation(connection, "pre-import")
        assert report.path.is_file()
        manifest = json.loads((report.path.parent / "manifest.json").read_text(encoding="utf-8"))
        assert manifest["kind"] == "pre-import"
    finally:
        connection.close()


@pytest.mark.parametrize("kind", ["../../production", "unknown", ""])
def test_operation_snapshot_rejects_unrecognized_kinds_without_creating_files(tmp_path: Path, kind: str):
    connection = _database(tmp_path / "source.db")
    root = tmp_path / "backups"
    try:
        with pytest.raises(ValueError, match="Unsupported SQLite snapshot kind"):
            create_operation_snapshot(connection, kind, backup_root=root)
        assert not root.exists()
    finally:
        connection.close()
