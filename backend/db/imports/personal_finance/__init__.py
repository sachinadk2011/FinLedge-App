"""Stable public API for Personal Finance workbook staging."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "PersonalFinanceImportIssue": (".models", "PersonalFinanceImportIssue"),
    "PersonalFinanceImportPlan": (".models", "PersonalFinanceImportPlan"),
    "PersonalFinanceImportReport": (".models", "PersonalFinanceImportReport"),
    "PersonalFinanceReplaceReport": (".models", "PersonalFinanceReplaceReport"),
    "PersonalFinanceMergePlan": (".models", "PersonalFinanceMergePlan"),
    "PersonalFinanceMergeRow": (".models", "PersonalFinanceMergeRow"),
    "PersonalFinanceConflictResolutionReport": (".models", "PersonalFinanceConflictResolutionReport"),
    "StagedPersonalFinanceRecord": (".models", "StagedPersonalFinanceRecord"),
    "stage_personal_finance_workbook": (".workbook", "stage_personal_finance_workbook"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
