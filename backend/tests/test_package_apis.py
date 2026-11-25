"""Contracts for lazy Desktop backend package facades."""

from __future__ import annotations

import importlib
import subprocess
import sys

import pytest


FACADE_PACKAGES = (
    "backend.db",
    "backend.db.core",
    "backend.db.imports",
    "backend.db.imports.bank",
    "backend.db.imports.common",
    "backend.db.imports.personal_finance",
    "backend.db.imports.share",
    "backend.db.imports.transfer",
    "backend.services.share",
    "backend.db.repositories",
    "backend.db.share",
    "backend.db.sip",
    "backend.routes",
    "backend.services",
    "backend.services.bank",
    "backend.services.common",
    "backend.services.personal_finance",
    "backend.services.settings",
    "backend.services.settings.data",
    "backend.services.share",
    "backend.services.sip",
)


@pytest.mark.parametrize("package_name", FACADE_PACKAGES)
def test_declared_exports_resolve_and_are_cached(package_name: str) -> None:
    package = importlib.import_module(package_name)
    export_map = getattr(package, "_EXPORTS", None)
    if export_map is None:
        export_map = package._COMPATIBILITY_MODULES

    assert package.__all__
    assert set(package.__all__) <= set(export_map)

    for name in package.__all__:
        resolved = getattr(package, name)
        assert name in vars(package)
        assert getattr(package, name) is resolved


@pytest.mark.parametrize("package_name", FACADE_PACKAGES)
def test_wildcard_import_exports_declared_public_names(package_name: str) -> None:
    namespace: dict[str, object] = {}
    exec(f"from {package_name} import *", namespace)

    package = importlib.import_module(package_name)
    assert set(package.__all__) <= set(namespace)
    for name in package.__all__:
        assert namespace[name] is getattr(package, name)


@pytest.mark.parametrize("package_name", FACADE_PACKAGES)
def test_package_import_is_lazy_and_failed_exports_are_standard(package_name: str) -> None:
    script = """
import importlib
import importlib.util
import sys

package_name = sys.argv[1]
package = importlib.import_module(package_name)
export_map = getattr(package, '_EXPORTS', None)
if export_map is None:
    export_map = package._COMPATIBILITY_MODULES
target = next(iter(export_map.values()))
module_path = target[0] if isinstance(target, tuple) else target
implementation = importlib.util.resolve_name(module_path, package_name)
assert implementation not in sys.modules
export = getattr(package, package.__all__[0])
assert implementation in sys.modules
assert export is getattr(package, package.__all__[0])
try:
    package.MissingPublicExport
except AttributeError as exc:
    assert 'MissingPublicExport' in str(exc)
else:
    raise AssertionError('missing package export did not raise AttributeError')
"""
    completed = subprocess.run(
        [sys.executable, "-c", script, package_name],
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr


def test_intentionally_empty_packages_document_their_scope() -> None:
    backend = importlib.import_module("backend")
    tests = importlib.import_module("backend.tests")

    assert not getattr(backend, "__all__", ())
    assert "intentionally exports no application API" in backend.__doc__
    assert not getattr(tests, "__all__", ())
    assert "not a production public API" in tests.__doc__
