"""Stable public API for SQLite repositories."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "RecordSpec": (".record_repository", "RecordSpec"),
    "RecordRepository": (".record_repository", "RecordRepository"),
    "SPECS": (".record_repository", "SPECS"),
    "replace_share_holding": (".record_repository", "replace_share_holding"),
    "BankRepository": (".bank_repository", "BankRepository"),
    "DividendRepository": (".dividend_repository", "DividendRepository"),
    "list_holdings": (".holdings_repository", "list_holdings"),
    "replace_rebuilt_holding": (".holdings_repository", "replace_rebuilt_holding"),
    "PersonalFinanceRepository": (".personal_finance_repository", "PersonalFinanceRepository"),
    "ShareRepository": (".share_repository", "ShareRepository"),
    "SipRepository": (".sip_repository", "SipRepository"),
    "allocate_sequence": (".support_repository", "allocate_sequence"),
    "add_tombstone": (".support_repository", "add_tombstone"),
    "resolve_legacy_row_id": (".support_repository", "resolve_legacy_row_id"),
    "import_legacy_identity_entries": (".support_repository", "import_legacy_identity_entries"),
    "record_conflict": (".support_repository", "record_conflict"),
    "TransferRepository": (".transfer_repository", "TransferRepository"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
