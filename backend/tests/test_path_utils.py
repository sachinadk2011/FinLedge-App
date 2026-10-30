import importlib
import os
from datetime import date

from backend.services import path_utils


def test_auto_data_directory_uses_shared_development_project_path(tmp_path, monkeypatch):
    project_root = tmp_path / "FinLedge"
    monkeypatch.setenv("FINLEDGE_PROJECT_ROOT", str(project_root))
    monkeypatch.setenv("FINLEDGE_MODE", "development")
    monkeypatch.setenv("FINLEDGE_DATA_DIR", "auto")
    path_utils._resolve_mode.cache_clear()
    try:
        assert not path_utils.get_data_dir(create=False).exists()
        assert path_utils.get_data_dir() == project_root / ".finledge-dev-data" / "FinLedge Data"
    finally:
        path_utils._resolve_mode.cache_clear()


def test_standalone_testing_and_production_use_the_electron_shared_documents_paths(tmp_path, monkeypatch):
    monkeypatch.setenv("USERPROFILE", str(tmp_path / "Profile"))
    monkeypatch.setenv("APPDATA", str(tmp_path / "Profile" / "AppData" / "Roaming"))
    monkeypatch.delenv("FINLEDGE_DATA_DIR", raising=False)
    monkeypatch.setenv("FINLEDGE_MODE", "testing")
    path_utils._resolve_mode.cache_clear()
    try:
        assert path_utils.get_data_dir() == tmp_path / "Profile" / "AppData" / "Roaming" / "Finledge Testing EXE" / "FinLedge Data"
        monkeypatch.setenv("FINLEDGE_MODE", "production")
        path_utils._resolve_mode.cache_clear()
        assert path_utils.get_data_dir() == tmp_path / "Profile" / "AppData" / "Roaming" / "Finledge" / "FinLedge Data"
    finally:
        path_utils._resolve_mode.cache_clear()


def test_data_directory_expands_environment_tokens_to_one_resolved_path(tmp_path, monkeypatch):
    project_root = tmp_path / "project"
    configured_root = tmp_path / "shared-data"
    monkeypatch.setenv("FINLEDGE_PROJECT_ROOT", str(project_root))
    monkeypatch.setenv("FINLEDGE_MODE", "development")
    monkeypatch.setenv("FINLEDGE_DATA_ROOT", str(configured_root))
    monkeypatch.setenv("FINLEDGE_DATA_DIR", "%FINLEDGE_DATA_ROOT%/FinLedge Data")
    path_utils._resolve_mode.cache_clear()
    try:
        assert path_utils.get_data_dir() == configured_root / "FinLedge Data"
    finally:
        path_utils._resolve_mode.cache_clear()


def test_invalid_data_directory_token_fails_without_creating_a_fallback(tmp_path, monkeypatch):
    project_root = tmp_path / "project"
    monkeypatch.setenv("FINLEDGE_PROJECT_ROOT", str(project_root))
    monkeypatch.setenv("FINLEDGE_MODE", "development")
    monkeypatch.setenv("FINLEDGE_DATA_DIR", "%FINLEDGE_UNDEFINED_ROOT%/data")
    path_utils._resolve_mode.cache_clear()
    try:
        try:
            path_utils.get_data_dir()
        except ValueError as exc:
            assert "undefined environment variable" in str(exc)
        else:
            raise AssertionError("undefined directory token should fail")
        assert not (project_root / ".finledge-dev-data").exists()
    finally:
        path_utils._resolve_mode.cache_clear()


def test_services_and_workbook_initialization_use_one_resolved_root(tmp_path, monkeypatch):
    from backend.services import bank_service, personal_finance_service, personal_finance_transfers, share_service
    from backend.services.workbook_initialization import WORKBOOK_NAMES, initialize_data_workbooks

    active_root = tmp_path / "active-data"
    project_root = tmp_path / "project"
    original_values = {key: os.environ.get(key) for key in (
        "FINLEDGE_DATA_DIR", "FINLEDGE_MODE", "FINLEDGE_PROJECT_ROOT", "FINLEDGE_BACKUP_DIR",
    )}
    monkeypatch.setenv("FINLEDGE_PROJECT_ROOT", str(project_root))
    monkeypatch.setenv("FINLEDGE_MODE", "development")
    monkeypatch.setenv("FINLEDGE_DATA_DIR", str(active_root))
    monkeypatch.delenv("FINLEDGE_BACKUP_DIR", raising=False)
    path_utils._resolve_mode.cache_clear()

    modules = (bank_service, share_service, personal_finance_service, personal_finance_transfers)
    try:
        for module in modules:
            importlib.reload(module)

        assert path_utils.get_data_dir() == active_root.resolve()
        assert {module.DATA_DIR for module in modules} == {active_root.resolve()}
        initialized = initialize_data_workbooks(active_root)
        assert initialized["status"] == "initialized"
        assert all((active_root / name).is_file() for name in WORKBOOK_NAMES)
        for workbook_path in active_root.glob("*.xlsx"):
            from openpyxl import load_workbook
            workbook = load_workbook(workbook_path, read_only=True, data_only=True)
            try:
                assert all(sheet.max_row <= 1 for sheet in workbook.worksheets if sheet.title not in {"Deleted", "Conflicts"})
            finally:
                workbook.close()

        bank_service.append_bank_record(date(2025, 1, 2), "income", 42.0, "synthetic test row")
        assert bank_service.read_bank_records()[0]["amount"] == 42.0
        assert (active_root / "backups").is_dir()
        assert not (project_root / ".finledge-dev-data").exists()
    finally:
        for key, value in original_values.items():
            if value is None:
                monkeypatch.delenv(key, raising=False)
            else:
                monkeypatch.setenv(key, value)
        path_utils._resolve_mode.cache_clear()
        for module in modules:
            importlib.reload(module)

