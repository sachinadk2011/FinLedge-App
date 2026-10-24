import os
import argparse
import json
from pathlib import Path

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare-data", action="store_true")
    options = parser.parse_args()
    if options.prepare_data:
        from backend.services.data_directory_service import migrate_legacy_workbooks
        from backend.services.path_utils import get_data_dir
        from backend.services.workbook_initialization import initialize_data_workbooks

        raw_sources = os.getenv("FINLEDGE_LEGACY_DATA_DIRS", "[]")
        try:
            sources = [Path(item) for item in json.loads(raw_sources)]
        except (TypeError, ValueError) as exc:
            raise RuntimeError("Invalid legacy data folder configuration") from exc
        migration = migrate_legacy_workbooks(get_data_dir(), sources)
        workbooks = initialize_data_workbooks(get_data_dir())
        print(json.dumps({**migration, "workbooks": workbooks}))
        return

    from backend.main import app
    host = os.getenv("FINLEDGE_BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("FINLEDGE_BACKEND_PORT", "8000"))
    log_level = os.getenv("FINLEDGE_BACKEND_LOG_LEVEL", "info")

    uvicorn.run(app, host=host, port=port, log_level=log_level)


if __name__ == "__main__":
    main()
