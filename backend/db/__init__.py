"""Desktop database package and stable top-level API."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "connect_database": (".core", "connect_database"),
    "FinLedgeConnection": (".core", "FinLedgeConnection"),
    "migrate_database": (".core", "migrate_database"),
    "verify_sqlite_engine": (".core", "verify_sqlite_engine"),
    "resolve_database_path": (".core", "resolve_database_path"),
    "resolve_application_database_path": (".core", "resolve_application_database_path"),
    "create_verified_snapshot": (".core", "create_verified_snapshot"),
    "content_hash": (".core", "content_hash"),
    "decimal_to_scaled": (".core", "decimal_to_scaled"),
    "scaled_to_decimal": (".core", "scaled_to_decimal"),
    "stamp_create": (".core", "stamp_create"),
    "stamp_material_edit": (".core", "stamp_material_edit"),
    "transaction": (".core", "transaction"),
    "RecordRepository": (".repositories", "RecordRepository"),
    "BankRepository": (".repositories", "BankRepository"),
    "DividendRepository": (".repositories", "DividendRepository"),
    "PersonalFinanceRepository": (".repositories", "PersonalFinanceRepository"),
    "ShareRepository": (".repositories", "ShareRepository"),
    "SipRepository": (".repositories", "SipRepository"),
    "TransferRepository": (".repositories", "TransferRepository"),
    "list_share_history": (".share", "list_share_history"),
    "calculate_share_replay": (".share", "calculate_share_replay"),
    "rebuild_share_holdings": (".share", "rebuild_share_holdings"),
    "normalize_share_name": (".share", "normalize_share_name"),
    "calculate_sip_replay": (".sip", "calculate_sip_replay"),
    "rebuild_sip_plan_summaries": (".sip", "rebuild_sip_plan_summaries"),
    "list_pending_unit_suggestions": (".sip", "list_pending_unit_suggestions"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())

