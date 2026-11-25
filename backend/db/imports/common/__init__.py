"""Shared helpers for Desktop workbook import staging."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "import_legacy_identity_file": (".identities", "import_legacy_identity_file"),
    "load_legacy_identity_entries": (".identities", "load_legacy_identity_entries"),
    "NormalizedImportTimestamps": (".metadata", "NormalizedImportTimestamps"),
    "normalize_import_timestamps": (".metadata", "normalize_import_timestamps"),
    "normalize_import_date": (".rows", "normalize_import_date"),
    "normalize_import_row_id": (".rows", "normalize_import_row_id"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
