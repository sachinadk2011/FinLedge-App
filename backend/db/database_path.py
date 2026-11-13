"""Pure SQLite path construction; environment root selection stays with the caller."""

from __future__ import annotations

from pathlib import Path


DATABASE_DIRECTORY = "FinLedge Database"
DATABASE_FILENAME = "finledge.db"


def resolve_database_path(storage_root: str | Path) -> Path:
    """Return the canonical DB file beneath an explicitly selected shared root.

    This helper deliberately does not inspect environment variables, create the
    directory, or open the database. Desktop startup must first select a root
    through the approved per-environment resolver.
    """
    raw_path = str(storage_root).strip()
    if not raw_path:
        raise ValueError("An explicit Desktop database storage root is required")
    return Path(raw_path).expanduser().resolve() / DATABASE_DIRECTORY / DATABASE_FILENAME


def resolve_application_database_path() -> Path:
    """Resolve beneath the Desktop data folder selected through FINLEDGE_DATA_DIR.

    Electron supplies `FINLEDGE_CHANNEL_DATA_ROOT` so EXE and AppX resolve the
    same channel root even while their legacy workbook folders differ. The
    standalone backend falls back to the parent of its resolved workbook folder.
    Neither path selection nor this helper creates or opens anything.
    """
    import os

    channel_root = str(os.getenv("FINLEDGE_CHANNEL_DATA_ROOT") or "").strip()
    if channel_root:
        return resolve_database_path(channel_root)

    from backend.services.path_utils import get_data_dir

    return resolve_database_path(get_data_dir(create=False).parent)
