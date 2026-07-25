"""Preview or explicitly apply the FinLedge v1.2.0 Bank data migration."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.data_migration_service import migrate_bank_workbook
from backend.services.path_utils import get_data_dir


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate FinLedge legacy Bank categories to v1.2.0.")
    parser.add_argument("--apply", action="store_true", help="Create a backup folder and activate the migrated workbook.")
    parser.add_argument("--data-dir", type=Path, help="Override the FinLedge data directory.")
    args = parser.parse_args()
    data_dir = args.data_dir.expanduser().resolve() if args.data_dir else get_data_dir()
    report = migrate_bank_workbook(data_dir, apply=args.apply)
    print(json.dumps(report, indent=2))
    if not args.apply:
        print("Preview only: no Excel file was changed. Run again with --apply to create a backup folder and migrate.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
