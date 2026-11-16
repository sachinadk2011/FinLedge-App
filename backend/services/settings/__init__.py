"""Stable public API for Settings workbook operations."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "DATA_DIR": (".service", "DATA_DIR"),
    "DATA_TYPE_CONFIG": (".service", "DATA_TYPE_CONFIG"),
    "get_data_type_config": (".service", "get_data_type_config"),
    "list_data_types": (".service", "list_data_types"),
    "import_data_file": (".service", "import_data_file"),
    "import_reviewed_data_file": (".service", "import_reviewed_data_file"),
    "check_live_has_data": (".service", "check_live_has_data"),
    "export_data_file": (".service", "export_data_file"),
    "export_all_data_files": (".service", "export_all_data_files"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
