"""Generate PyInstaller Windows version resources from the root app version."""

import argparse
import json
import os
import re
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    project_root = Path(args.project_root).resolve()
    package = json.loads((project_root / "package.json").read_text(encoding="utf-8"))
    version = str(package.get("version", "")).split("+", 1)[0].split("-", 1)[0]
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", version)
    if not match:
        raise SystemExit(f"Unsupported FinLedge version for Windows metadata: {version}")

    revision = int(os.environ.get("BUILD_NUMBER") or 0)
    if revision < 0 or revision > 65535:
        raise SystemExit("BUILD_NUMBER must be between 0 and 65535 for Windows version metadata")
    numbers = tuple(int(part) for part in match.groups()) + (revision,)
    version_tuple = f"({', '.join(str(part) for part in numbers)})"
    resource = f'''VSVersionInfo(
  ffi=FixedFileInfo(
    filevers={version_tuple},
    prodvers={version_tuple},
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0),
  ),
  kids=[
    StringFileInfo([
      StringTable("040904B0", [
        StringStruct("CompanyName", "Sachin Adhikari"),
        StringStruct("FileDescription", "FinLedge background data engine"),
        StringStruct("FileVersion", "{version}.{revision}"),
        StringStruct("InternalName", "finledge-engine"),
        StringStruct("LegalCopyright", "Copyright © 2026 Sachin Adhikari"),
        StringStruct("OriginalFilename", "finledge-engine.exe"),
        StringStruct("ProductName", "FinLedge"),
        StringStruct("ProductVersion", "{version}"),
      ])
    ]),
    VarFileInfo([VarStruct("Translation", [1033, 1200])]),
  ],
)
'''
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(resource, encoding="utf-8")


if __name__ == "__main__":
    main()
