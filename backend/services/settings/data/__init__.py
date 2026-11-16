"""Stable API for Settings import and export internals."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "DATA_DIR": (".config", "DATA_DIR"),
    "DATA_TYPE_CONFIG": (".config", "DATA_TYPE_CONFIG"),
    "get_data_type_config": (".config", "get_data_type_config"),
    "list_data_types": (".config", "list_data_types"),
    "_BANK_INCOME_CATEGORIES": (".normalization", "_BANK_INCOME_CATEGORIES"),
    "_BANK_LEGACY_CATEGORIES": (".normalization", "_BANK_LEGACY_CATEGORIES"),
    "_BANK_REQUIRED": (".normalization", "_BANK_REQUIRED"),
    "_BANK_RETIRED_CATEGORIES": (".normalization", "_BANK_RETIRED_CATEGORIES"),
    "_BANK_VALID_CATEGORIES": (".normalization", "_BANK_VALID_CATEGORIES"),
    "_COLUMN_ALIASES": (".normalization", "_COLUMN_ALIASES"),
    "_PF_EXPENSE_ALIASES": (".normalization", "_PF_EXPENSE_ALIASES"),
    "_PF_EXPENSE_VALID": (".normalization", "_PF_EXPENSE_VALID"),
    "_PF_INCOME_ALIASES": (".normalization", "_PF_INCOME_ALIASES"),
    "_PF_INCOME_VALID": (".normalization", "_PF_INCOME_VALID"),
    "_PF_REQUIRED": (".normalization", "_PF_REQUIRED"),
    "_PF_DIRECTION_ALIASES": (".normalization", "_PF_DIRECTION_ALIASES"),
    "_SHARE_CATEGORY_ALIASES": (".normalization", "_SHARE_CATEGORY_ALIASES"),
    "_SHARE_REQUIRED": (".normalization", "_SHARE_REQUIRED"),
    "_SHARE_VALID_CATEGORIES": (".normalization", "_SHARE_VALID_CATEGORIES"),
    "_migrate_bank_category": (".normalization", "_migrate_bank_category"),
    "_migrate_pf_category": (".normalization", "_migrate_pf_category"),
    "_migrate_pf_direction": (".normalization", "_migrate_pf_direction"),
    "_migrate_share_category": (".normalization", "_migrate_share_category"),
    "export_all_data_files": (".workbook_export", "export_all_data_files"),
    "export_data_file": (".workbook_export", "export_data_file"),
    "_apply_aliases": (".workbook_import", "_apply_aliases"),
    "_backup_live_file": (".workbook_import", "_backup_live_file"),
    "_count_live_rows": (".workbook_import", "_count_live_rows"),
    "_read_live_rows": (".workbook_import", "_read_live_rows"),
    "_read_workbook_rows": (".workbook_import", "_read_workbook_rows"),
    "_remap_bank_rows": (".workbook_import", "_remap_bank_rows"),
    "_remap_pf_rows": (".workbook_import", "_remap_pf_rows"),
    "_remap_rows": (".workbook_import", "_remap_rows"),
    "_remap_share_rows": (".workbook_import", "_remap_share_rows"),
    "_to_float": (".workbook_import", "_to_float"),
    "_validate_required_headers": (".workbook_import", "_validate_required_headers"),
    "check_live_has_data": (".workbook_import", "check_live_has_data"),
    "import_data_file": (".workbook_import", "import_data_file"),
    "import_reviewed_data_file": (".workbook_import", "import_reviewed_data_file"),
}

# Private helpers are imported explicitly by the parent Settings service; they
# are not part of wildcard consumers' public surface.
__all__ = [name for name in _EXPORTS if not name.startswith("_")]


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
