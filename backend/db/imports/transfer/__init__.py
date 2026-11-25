"""Stable public APIs for Desktop transfer workbook imports."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "StagedTransferRecord": (".models", "StagedTransferRecord"),
    "TransferImportIssue": (".models", "TransferImportIssue"),
    "TransferImportPlan": (".models", "TransferImportPlan"),
    "TransferImportReport": (".models", "TransferImportReport"),
    "TransferMergeRow": (".models", "TransferMergeRow"),
    "TransferMergePlan": (".models", "TransferMergePlan"),
    "TransferConflictResolutionReport": (".models", "TransferConflictResolutionReport"),
    "stage_transfer_workbook": (".workbook", "stage_transfer_workbook"),
    "import_staged_transfer_workbook": (".import_service", "import_staged_transfer_workbook"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
