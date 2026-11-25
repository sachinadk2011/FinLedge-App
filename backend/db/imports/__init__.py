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
    "PersonalFinanceImportIssue": (".personal_finance", "PersonalFinanceImportIssue"),
    "PersonalFinanceImportPlan": (".personal_finance", "PersonalFinanceImportPlan"),
    "PersonalFinanceImportReport": (".personal_finance", "PersonalFinanceImportReport"),
    "PersonalFinanceMergePlan": (".personal_finance", "PersonalFinanceMergePlan"),
    "PersonalFinanceMergeRow": (".personal_finance", "PersonalFinanceMergeRow"),
    "PersonalFinanceConflictResolutionReport": (".personal_finance", "PersonalFinanceConflictResolutionReport"),
    "StagedPersonalFinanceRecord": (".personal_finance", "StagedPersonalFinanceRecord"),
    "stage_personal_finance_workbook": (".personal_finance", "stage_personal_finance_workbook"),
    "ShareImportIssue": (".share", "ShareImportIssue"),
    "ShareImportPlan": (".share", "ShareImportPlan"),
    "ShareImportReport": (".share", "ShareImportReport"),
    "ShareMergeRow": (".share", "ShareMergeRow"),
    "ShareMergePlan": (".share", "ShareMergePlan"),
    "ShareConflictResolutionReport": (".share", "ShareConflictResolutionReport"),
    "StagedShareRecord": (".share", "StagedShareRecord"),
    "stage_share_workbook": (".share", "stage_share_workbook"),
    "import_staged_share_workbook": (".share", "import_staged_share_workbook"),
    "StagedTransferRecord": (".transfer", "StagedTransferRecord"),
    "TransferImportIssue": (".transfer", "TransferImportIssue"),
    "TransferImportPlan": (".transfer", "TransferImportPlan"),
    "TransferImportReport": (".transfer", "TransferImportReport"),
    "TransferMergeRow": (".transfer", "TransferMergeRow"),
    "TransferMergePlan": (".transfer", "TransferMergePlan"),
    "TransferConflictResolutionReport": (".transfer", "TransferConflictResolutionReport"),
    "stage_transfer_workbook": (".transfer", "stage_transfer_workbook"),
    "import_staged_transfer_workbook": (".transfer", "import_staged_transfer_workbook"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
