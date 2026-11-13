from pathlib import Path

import pytest

from backend.db.database_path import (
    DATABASE_DIRECTORY,
    DATABASE_FILENAME,
    resolve_application_database_path,
    resolve_database_path,
)


def test_database_path_is_built_under_explicit_root_without_creating_it(tmp_path: Path):
    data_root = tmp_path / "selected-data-root"
    database_path = resolve_database_path(data_root)
    assert database_path == data_root.resolve() / DATABASE_DIRECTORY / DATABASE_FILENAME
    assert not data_root.exists()


@pytest.mark.parametrize("empty", ["", "   "])
def test_database_path_rejects_missing_root(empty: str):
    with pytest.raises(ValueError, match="explicit"):
        resolve_database_path(empty)


def test_application_database_path_uses_shared_channel_root_without_creating(monkeypatch, tmp_path: Path):
    data_root = tmp_path / "AppData" / "Roaming" / "Finledge"
    monkeypatch.setenv("FINLEDGE_CHANNEL_DATA_ROOT", str(data_root))
    resolved = resolve_application_database_path()
    assert resolved == data_root.resolve() / DATABASE_DIRECTORY / DATABASE_FILENAME
    assert not data_root.exists()


def test_application_database_path_falls_back_to_standalone_data_root(monkeypatch, tmp_path: Path):
    from backend.services import path_utils

    data_root = tmp_path / "AppData" / "Roaming" / "Finledge" / "FinLedge Data"
    monkeypatch.delenv("FINLEDGE_CHANNEL_DATA_ROOT", raising=False)
    monkeypatch.setenv("FINLEDGE_DATA_DIR", str(data_root))
    monkeypatch.setattr(path_utils, "get_data_dir", lambda *, create=True: data_root)
    resolved = resolve_application_database_path()
    assert resolved == data_root.parent / DATABASE_DIRECTORY / DATABASE_FILENAME
    assert not data_root.exists()
