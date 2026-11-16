"""Stable public API for Desktop FastAPI routers."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "bank_router": (".bank", "router"),
    "meta_router": (".meta", "router"),
    "personal_finance_router": (".personal_finance", "router"),
    "settings_router": (".settings", "router"),
    "share_router": (".share", "router"),
    "summary_router": (".summary", "router"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
