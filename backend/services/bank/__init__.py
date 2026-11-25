"""Stable public APIs for Bank workbook and SQLite services."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "bank_amount_to_scaled": (".amounts", "bank_amount_to_scaled"),
    "FILE_PATH": (".bank_service", "FILE_PATH"),
    "HEADERS": (".bank_service", "HEADERS"),
    "legacy_bank_amount_to_scaled": (".amounts", "legacy_bank_amount_to_scaled"),
    "import_staged_bank_workbook": (".import_service", "import_staged_bank_workbook"),
    "replace_staged_bank_workbook": (".replace_service", "replace_staged_bank_workbook"),
    "classify_bank_import": (".review_service", "classify_bank_import"),
    "resolve_bank_import_conflict": (".conflict_service", "resolve_bank_import_conflict"),
    "normalize_bank_amount": (".amounts", "normalize_bank_amount"),
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
