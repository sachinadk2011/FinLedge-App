import os
import shutil
import sys
from pathlib import Path


def get_data_dir() -> Path:
    project_root = Path(__file__).resolve().parents[2]

    # User data storage outside the project folder (and safe for packaged .exe builds).
    # By default: ~/FinancialTrackerData
    env_override = (os.environ.get("FINLEDGE_DATA_DIR") or os.environ.get("FINANCIAL_TRACKER_DATA_DIR") or "").strip()
    is_frozen = bool(getattr(sys, "frozen", False))
    if env_override:
        data_dir = Path(env_override).expanduser()
    else:
        # Dev runs: keep it near the repo but outside it (e.g., Desktop/FinancialTrackerData).
        # Packaged exe: always use a user-writable folder.
        data_dir = (Path.home() / "FinancialTrackerData") if is_frozen else (project_root.parent / "FinancialTrackerData")

    data_dir.mkdir(parents=True, exist_ok=True)

    # Backward compatibility: migrate legacy Excel files into the new location once.
    legacy_dirs: list[Path] = [
        project_root / "backend" / "data",
        project_root / "data",
    ]

    # Old defaults used by previous versions.
    if os.name == "nt":
        roaming = Path(os.environ.get("APPDATA") or (Path.home() / "AppData" / "Roaming"))
        legacy_dirs.insert(0, roaming / "FinancialTracker")
    else:
        legacy_dirs.insert(0, Path.home() / ".financial_tracker")

    # If this is a packaged build, some older versions stored next to the executable.
    if is_frozen:
        legacy_dirs.append(Path(sys.executable).resolve().parent / "data")

    # Map legacy filenames to new stable names.
    targets = {
        "bank_transactions.xlsx": ["bank_transactions.xlsx", "bank.xlsx"],
        "share_transactions.xlsx": ["share_transactions.xlsx", "share.xlsx"],
    }

    for target_name, candidates in targets.items():
        target = data_dir / target_name
        if target.exists():
            continue

        found = None
        for legacy_dir in legacy_dirs:
            for name in candidates:
                candidate = legacy_dir / name
                if candidate.exists():
                    found = candidate
                    break
            if found:
                break

        if found:
            shutil.copy2(found, target)

    return data_dir
