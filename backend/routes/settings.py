import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.services.settings_service import (
    check_live_has_data,
    export_all_data_files,
    export_data_file,
    import_data_file,
    list_data_types,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/data-types")
def get_settings_data_types():
    try:
        return {"data_types": list_data_types()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/has-data/{data_type}")
def get_settings_has_data(data_type: str):
    """Return whether the live file for this data type already has data rows."""
    try:
        has_data = check_live_has_data(data_type)
        return {"data_type": data_type, "has_data": has_data}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/import/{data_type}")
async def import_settings_data(
    data_type: str,
    file: UploadFile = File(...),
    mode: str = Form(default="replace"),
):
    """
    Import an Excel file. mode = "replace" (default) or "merge".
    The file must contain at minimum the core user-visible columns;
    internal timestamp/ref columns are optional and auto-filled.
    """
    if mode not in {"replace", "merge"}:
        raise HTTPException(status_code=400, detail="mode must be 'replace' or 'merge'.")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".xlsx", ".xlsm"}:
        raise HTTPException(status_code=400, detail="Import file must be an Excel workbook (.xlsx).")

    temp_dir = Path(tempfile.mkdtemp(prefix="finledge-import-"))
    temp_path = temp_dir / (Path(file.filename or "import.xlsx").name)

    try:
        with temp_path.open("wb") as handle:
            shutil.copyfileobj(file.file, handle)

        result = import_data_file(data_type, temp_path, mode=mode)
        imported = result["imported_rows"]
        merged = result["merged_rows"]
        if mode == "merge" and merged > 0:
            msg = f"Imported {imported} rows and merged with {merged} existing rows successfully."
        else:
            msg = f"Imported {imported} rows successfully."
        return {"message": msg, "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.get("/export/{data_type}")
def export_settings_data(data_type: str):
    try:
        live_path = export_data_file(data_type)
        return FileResponse(
            path=live_path,
            filename=live_path.name,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/export-all")
def export_all_settings_data():
    try:
        zip_path = export_all_data_files()
        return FileResponse(
            path=zip_path,
            filename=zip_path.name,
            media_type="application/zip",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
