"""Stable public APIs for Desktop Share workbook and SQLite services."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "FILE_PATH": (".workbook_service", "FILE_PATH"),
    "HEADERS": (".workbook_service", "HEADERS"),
    "SQLiteShareService": (".sqlite_service", "SQLiteShareService"),
    "classify_share_import": (".import_review_service", "classify_share_import"),
    "resolve_share_import_conflict": (".conflict_service", "resolve_share_import_conflict"),
    "summarize_share_records": (".summary", "summarize_share_records"),
    "apply_sip_investment": (".lot_calculations", "apply_sip_investment"),
    "apply_weighted_average_transaction": (".lot_calculations", "apply_weighted_average_transaction"),
    "append_share_record": (".workbook_service", "append_share_record"),
    "read_share_records": (".workbook_service", "read_share_records"),
    "delete_share_record": (".workbook_service", "delete_share_record"),
    "update_share_allotment": (".workbook_service", "update_share_allotment"),
    "update_share_record": (".workbook_service", "update_share_record"),
    "normalize_ipo_quantity": (".import_normalization", "normalize_ipo_quantity"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
