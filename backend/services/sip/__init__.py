"""Stable public API for the Desktop SIP service."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {"SQLiteSipService": (".sqlite_service", "SQLiteSipService")}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
