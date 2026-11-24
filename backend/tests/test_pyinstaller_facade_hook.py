"""The packaged sidecar must include every lazy package facade target."""

from __future__ import annotations

import importlib
import importlib.util
from pathlib import Path

FACADE_PACKAGES = (
    "backend.db",
    "backend.db.core",
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


def test_pyinstaller_hook_discovers_lazy_package_targets() -> None:
    project_root = Path(__file__).resolve().parents[2]
    hook_path = project_root / "desktop" / "scripts" / "pyinstaller_hooks" / "hook-backend.py"
    spec = importlib.util.spec_from_file_location("finledge_hook_backend", hook_path)
    assert spec is not None and spec.loader is not None
    hook = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(hook)

    assert "backend.services.common.path_utils" in hook.hiddenimports
    assert "backend.services.personal_finance.transfer_directions" in hook.hiddenimports
    assert "backend.db.core.connection" in hook.hiddenimports
    assert "backend.routes.bank" in hook.hiddenimports
    assert all(".tests" not in module for module in hook.hiddenimports)

    for package_name in FACADE_PACKAGES:
        package = importlib.import_module(package_name)
        export_map = getattr(package, "_EXPORTS", None)
        if export_map is None:
            export_map = package._COMPATIBILITY_MODULES
        for target in export_map.values():
            module_path = target[0] if isinstance(target, tuple) else target
            module_name = importlib.util.resolve_name(module_path, package_name)
            assert module_name in hook.hiddenimports, (package_name, module_name)
