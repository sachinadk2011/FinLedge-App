"""Public Share database APIs, loaded lazily to avoid import cycles."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "SHARE_CALCULATION_VERSION": (".calculations", "SHARE_CALCULATION_VERSION"),
    "list_share_history": (".history", "list_share_history"),
    "normalize_share_name": (".identity", "normalize_share_name"),
    "calculate_share_replay": (".calculations", "calculate_share_replay"),
    "rebuild_share_holdings": (".calculations", "rebuild_share_holdings"),
    "ShareReplay": (".calculations", "ShareReplay"),
    "ShareReplayError": (".calculations", "ShareReplayError"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
