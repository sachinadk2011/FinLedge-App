"""Stable public APIs for Bank workbook and SQLite services."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "FILE_PATH": (".bank_service", "FILE_PATH"),
    "HEADERS": (".bank_service", "HEADERS"),
    "append_bank_record": (".bank_service", "append_bank_record"),
    "read_bank_records": (".bank_service", "read_bank_records"),
    "summarize_bank_records": (".bank_service", "summarize_bank_records"),
    "update_bank_record": (".bank_service", "update_bank_record"),
    "delete_bank_record": (".bank_service", "delete_bank_record"),
    "SQLiteBankService": (".sqlite_service", "SQLiteBankService"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
