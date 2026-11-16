"""Stable public API for SIP replay and query logic."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "SIP_CALCULATION_VERSION": (".calculations", "SIP_CALCULATION_VERSION"),
    "SipReplay": (".calculations", "SipReplay"),
    "SipReplayError": (".calculations", "SipReplayError"),
    "calculate_sip_replay": (".calculations", "calculate_sip_replay"),
    "rebuild_sip_plan_summaries": (".calculations", "rebuild_sip_plan_summaries"),
    "list_pending_unit_suggestions": (".pending_units", "list_pending_unit_suggestions"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
