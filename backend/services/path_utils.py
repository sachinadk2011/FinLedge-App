import os
import re
import sys
from functools import lru_cache
from pathlib import Path


def _get_project_root() -> Path:
    explicit_root = os.getenv("FINLEDGE_PROJECT_ROOT")
    if explicit_root:
        return Path(explicit_root).expanduser().resolve()

    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path.cwd()

    return Path(__file__).resolve().parents[2]


def _read_env_file(project_root: Path) -> None:
    env_file = project_root / ".env"
    if not env_file.exists():
        return

    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


def _expand_data_directory(value: str) -> str:
    expanded = str(value or "").strip()
    if not expanded:
        return ""
    if expanded.casefold() == "auto":
        return "auto"
    expanded = re.sub(
        r"%([^%]+)%|\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)",
        lambda match: os.environ.get(match.group(1) or match.group(2) or match.group(3), match.group(0)),
        expanded,
    )
    unresolved = re.search(r"%[^%]+%|\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*", expanded)
    if unresolved:
        raise ValueError(f"Data folder setting contains an undefined environment variable: {unresolved.group(0)}")
    return str(Path(expanded).expanduser().resolve())


@lru_cache(maxsize=1)
def _resolve_mode() -> str:
    project_root = _get_project_root()
    _read_env_file(project_root)
    return str(os.getenv("FINLEDGE_MODE") or "development").strip().lower() or "development"


def get_data_dir(*, create: bool = True) -> Path:
    project_root = _get_project_root()
    mode = _resolve_mode()
    explicit_data_dir = _expand_data_directory(os.getenv("FINLEDGE_DATA_DIR", ""))
    if explicit_data_dir.casefold() == "auto":
        explicit_data_dir = ""

    if explicit_data_dir:
        data_dir = Path(explicit_data_dir)
    elif mode in {"production", "testing"}:
        # Electron supplies FINLEDGE_DATA_DIR for each app's working copy.
        # A standalone backend follows the EXE channel root by default.
        roaming = Path(os.getenv("APPDATA") or (Path(os.getenv("USERPROFILE") or Path.home()) / "AppData" / "Roaming"))
        product_folder = "Finledge Testing EXE" if mode == "testing" else "Finledge"
        data_dir = roaming / product_folder / "FinLedge Data"
    else:
        data_dir = project_root / ".finledge-dev-data" / "FinLedge Data"

    if create:
        data_dir.mkdir(parents=True, exist_ok=True)

    return data_dir
