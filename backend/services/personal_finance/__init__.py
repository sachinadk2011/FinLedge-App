"""Stable public APIs for Personal Finance workbook and SQLite services."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "BANK_FLOW_FILE_PATH": (".workbook_service", "BANK_FLOW_FILE_PATH"),
    "CASH_FLOW_FILE_PATH": (".workbook_service", "CASH_FLOW_FILE_PATH"),
    "TRANSFER_FILE_PATH": (".workbook_service", "TRANSFER_FILE_PATH"),
    "append_personal_finance_record": (".workbook_service", "append_personal_finance_record"),
    "read_personal_finance_records": (".workbook_service", "read_personal_finance_records"),
    "summarize_personal_finance_records": (".workbook_service", "summarize_personal_finance_records"),
    "update_personal_finance_record": (".workbook_service", "update_personal_finance_record"),
    "delete_personal_finance_record": (".workbook_service", "delete_personal_finance_record"),
    "create_transfer_record": (".workbook_service", "create_transfer_record"),
    "read_transfer_records": (".workbook_service", "read_transfer_records"),
    "update_transfer_record": (".workbook_service", "update_transfer_record"),
    "SQLitePersonalFinanceService": (".sqlite_service", "SQLitePersonalFinanceService"),
    "import_staged_personal_finance_workbook": (".import_service", "import_staged_personal_finance_workbook"),
    "replace_staged_personal_finance_workbook": (".replace_service", "replace_staged_personal_finance_workbook"),
    "classify_personal_finance_import": (".review_service", "classify_personal_finance_import"),
    "resolve_personal_finance_import_conflict": (".conflict_service", "resolve_personal_finance_import_conflict"),
    "validate_transfer_import_rows": (".transfers", "validate_transfer_import_rows"),
    "normalize_transfer_direction": (".transfer_directions", "normalize_transfer_direction"),
    "validate_transfer_income_timeline": (".transfer_import_validation", "validate_transfer_income_timeline"),
    "classify_transfer_import": (".transfer_import_review_service", "classify_transfer_import"),
    "resolve_transfer_import_conflict": (".transfer_conflict_service", "resolve_transfer_import_conflict"),
    "destination_flow": (".transfer_directions", "destination_flow"),
    "origin_flow": (".transfer_directions", "origin_flow"),
    "LINKED_MODULE_SOURCES": (".summary", "LINKED_MODULE_SOURCES"),
    "SHARE_ONLY_CATEGORIES": (".summary", "SHARE_ONLY_CATEGORIES"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
