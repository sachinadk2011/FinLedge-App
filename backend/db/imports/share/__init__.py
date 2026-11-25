"""Stable public API for Share workbook staging."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "ShareImportIssue": (".models", "ShareImportIssue"),
    "ShareImportPlan": (".models", "ShareImportPlan"),
    "ShareImportReport": (".models", "ShareImportReport"),
    "ShareMergeRow": (".models", "ShareMergeRow"),
    "ShareMergePlan": (".models", "ShareMergePlan"),
    "ShareConflictResolutionReport": (".models", "ShareConflictResolutionReport"),
    "StagedShareRecord": (".models", "StagedShareRecord"),
    "stage_share_workbook": (".workbook", "stage_share_workbook"),
    "import_staged_share_workbook": (".import_service", "import_staged_share_workbook"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
