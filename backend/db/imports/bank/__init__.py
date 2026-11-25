"""Stable public API for staged Bank workbook imports."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "BankImportIssue": (".models", "BankImportIssue"),
    "BankImportReport": (".models", "BankImportReport"),
    "BankReplaceReport": (".models", "BankReplaceReport"),
    "BankConflictResolutionReport": (".models", "BankConflictResolutionReport"),
    "BankMergePlan": (".models", "BankMergePlan"),
    "BankMergeRow": (".models", "BankMergeRow"),
    "BankImportPlan": (".models", "BankImportPlan"),
    "StagedBankRecord": (".models", "StagedBankRecord"),
    "stage_bank_workbook": (".workbook", "stage_bank_workbook"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
