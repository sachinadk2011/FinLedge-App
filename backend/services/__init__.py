"""Backend service packages with compatibility exports for older callers."""

from backend._package_api import package_dir, resolve_module

_COMPATIBILITY_MODULES = {
    "bank_service": ".bank.bank_service",
    "personal_finance_service": ".personal_finance.workbook_service",
    "personal_finance_transfers": ".personal_finance.transfers",
    "share_service": ".share.workbook_service",
    "settings_service": ".settings.service",
    "excel_utils": ".common.excel_utils",
    "path_utils": ".common.path_utils",
    "data_directory_service": ".common.data_directory_service",
    "data_migration_service": ".common.data_migration_service",
    "dev_data_clear_service": ".common.dev_data_clear_service",
    "metadata_backfill_service": ".common.metadata_backfill_service",
    "shared_sync_service": ".common.shared_sync_service",
    "summary_graph_service": ".common.summary_graph_service",
    "workbook_headers": ".common.workbook_headers",
    "workbook_initialization": ".common.workbook_initialization",
    "workbook_merge": ".common.workbook_merge",
}

__all__ = list(_COMPATIBILITY_MODULES)


def __getattr__(name: str):
    return resolve_module(globals(), _COMPATIBILITY_MODULES, name)


def __dir__():
    return package_dir(globals())
