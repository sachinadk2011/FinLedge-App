"""Read-only access to live workbooks and multi-file export packaging."""

import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from .config import DATA_TYPE_CONFIG, get_data_type_config

def export_data_file(data_type: str) -> Path:
    config = get_data_type_config(data_type)
    live_path = Path(config["path"])
    if not live_path.exists():
        raise ValueError(f"No live data file exists yet for {config['label']}.")
    return live_path

def export_all_data_files() -> Path:
    existing_files: list[tuple[str, Path]] = []
    for data_type, config in DATA_TYPE_CONFIG.items():
        live_path = Path(config["path"])
        if live_path.exists():
            existing_files.append((config["filename"], live_path))

    if not existing_files:
        raise ValueError("No data files are available to export yet.")

    tag = datetime.now().strftime("%Y%m%d-%H%M%S")
    zip_path = Path(tempfile.gettempdir()) / f"finledge-data-export-{tag}.zip"

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for filename, live_path in existing_files:
            archive.write(live_path, arcname=filename)

    return zip_path
