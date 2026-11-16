"""Small helper for lazy, package-level public API exports."""

from __future__ import annotations

from importlib import import_module
from typing import Any


def resolve_export(
    namespace: dict[str, Any],
    exports: dict[str, tuple[str, str]],
    name: str,
) -> Any:
    """Resolve and cache one public name from a package's private module layout."""
    target = exports.get(name)
    if target is None:
        raise AttributeError(f"module {namespace['__name__']!r} has no attribute {name!r}")
    module = import_module(target[0], namespace["__name__"])
    value = getattr(module, target[1])
    namespace[name] = value
    return value


def resolve_module(namespace: dict[str, Any], modules: dict[str, str], name: str) -> Any:
    """Resolve and cache a legacy module alias from a compatibility package."""
    module_path = modules.get(name)
    if module_path is None:
        raise AttributeError(f"module {namespace['__name__']!r} has no attribute {name!r}")
    module = import_module(module_path, namespace["__name__"])
    namespace[name] = module
    return module


def package_dir(namespace: dict[str, Any]) -> list[str]:
    """Include lazy public names in package introspection and autocomplete."""
    exports = namespace.get("_EXPORTS", {})
    return sorted(set(namespace) | set(exports))
