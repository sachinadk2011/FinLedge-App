"""Bundle implementation modules referenced by lazy package facades."""

import ast
import importlib.util
from pathlib import Path


def _package_name(initializer: Path, backend_root: Path) -> str:
    relative = initializer.parent.relative_to(backend_root.parent)
    return ".".join(relative.parts)


def _target_module(value: ast.expr, package_name: str) -> str | None:
    if isinstance(value, ast.Tuple) and value.elts:
        value = value.elts[0]
    if not isinstance(value, ast.Constant) or not isinstance(value.value, str):
        return None
    target = value.value
    if target.startswith("."):
        return importlib.util.resolve_name(target, package_name)
    return target


def _facade_targets(backend_root: Path) -> list[str]:
    targets: set[str] = set()
    facade_maps = {"_EXPORTS", "_COMPATIBILITY_MODULES"}

    for initializer in backend_root.rglob("__init__.py"):
        tree = ast.parse(initializer.read_text(encoding="utf-8"), filename=str(initializer))
        package_name = _package_name(initializer, backend_root)

        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                is_facade_map = any(
                    isinstance(target, ast.Name) and target.id in facade_maps
                    for target in node.targets
                )
                value = node.value
            elif isinstance(node, ast.AnnAssign):
                is_facade_map = isinstance(node.target, ast.Name) and node.target.id in facade_maps
                value = node.value
            else:
                continue

            if not is_facade_map or not isinstance(value, ast.Dict):
                continue
            for export_target in value.values:
                module_name = _target_module(export_target, package_name)
                if module_name:
                    targets.add(module_name)

    return sorted(targets)


_backend_root = Path(__file__).resolve().parents[3] / "backend"
hiddenimports = _facade_targets(_backend_root)
