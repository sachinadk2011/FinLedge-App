import os
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


@lru_cache(maxsize=1)
def _resolve_mode() -> str:
    project_root = _get_project_root()
    _read_env_file(project_root)
    return str(os.getenv("FINLEDGE_MODE") or "development").strip().lower() or "development"


def get_data_dir() -> Path:
    project_root = _get_project_root()
    mode = _resolve_mode()
    explicit_data_dir = os.getenv("FINLEDGE_DATA_DIR")

    if explicit_data_dir:
        data_dir = Path(explicit_data_dir).expanduser().resolve()
    elif mode == "production":
        if os.name == "nt":
            profile = Path(os.getenv("USERPROFILE") or Path.home())
            data_dir = profile / "Documents" / "FinLedge"
        else:
            data_dir = Path.home() / ".finledge"
    else:
        data_dir = project_root / ".finledge-dev-data"

    data_dir.mkdir(parents=True, exist_ok=True)

    return data_dir
