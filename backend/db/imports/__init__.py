"""Stable public APIs for Desktop workbook-to-SQLite import staging."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "BankImportIssue": (".bank", "BankImportIssue"),
    "BankImportReport": (".bank", "BankImportReport"),
    "BankMergePlan": (".bank", "BankMergePlan"),
    "BankMergeRow": (".bank", "BankMergeRow"),
    "BankImportPlan": (".bank", "BankImportPlan"),
    "StagedBankRecord": (".bank", "StagedBankRecord"),
    "stage_bank_workbook": (".bank", "stage_bank_workbook"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
