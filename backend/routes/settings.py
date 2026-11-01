import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.models import SettingsImportReviewRequest, SettingsModuleClearRequest
from backend.services.settings_service import (
    check_live_has_data,
    export_all_data_files,
    export_data_file,
    import_data_file,
    import_reviewed_data_file,
    list_data_types,
)
from backend.services.dev_data_clear_service import clear_module_rows, clear_tool_status

router = APIRouter(prefix="/settings", tags=["settings"])


def _save_uploaded_workbook(file: UploadFile) -> tuple[Path, Path]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".xlsx", ".xlsm"}:
        raise HTTPException(status_code=400, detail="Import file must be an Excel workbook (.xlsx).")
    temp_dir = Path(tempfile.mkdtemp(prefix="finledge-import-"))
    temp_path = temp_dir / (Path(file.filename or "import.xlsx").name)
    with temp_path.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)
    return temp_dir, temp_path


@router.get("/data-types")
def get_settings_data_types():
    try:
        return {"data_types": list_data_types()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/dev-tools")
def get_settings_dev_tools():
    return clear_tool_status()


@router.post("/dev-tools/clear/{data_type}")
def clear_settings_module_data(data_type: str, payload: SettingsModuleClearRequest):
    try:
        return clear_module_rows(data_type, confirmed=payload.confirmed)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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

    temp_dir, temp_path = _save_uploaded_workbook(file)

    try:
        result = import_data_file(data_type, temp_path, mode=mode)
        imported = result["imported_rows"]
        merged = result["merged_rows"]
        report = result.get("merge_report") or {}
        if mode == "merge" and report.get("added", 0) == 0 and report.get("updated", 0) == 0:
            msg = "No new transactions were added; all imported rows were already present."
        elif mode == "merge" and merged > 0:
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


@router.post("/preview-import/{data_type}")
async def preview_settings_import(
    data_type: str,
    file: UploadFile = File(...),
    mode: str = Form(default="replace"),
):
    if mode not in {"replace", "merge"}:
        raise HTTPException(status_code=400, detail="mode must be 'replace' or 'merge'.")
    try:
        temp_dir, temp_path = _save_uploaded_workbook(file)
    except HTTPException:
        raise
    try:
        preview = import_data_file(data_type, temp_path, mode=mode, dry_run=True)
        return {"message": "Import parsed. Review the rows before confirming.", "data": preview}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/import-reviewed/{data_type}")
def import_reviewed_settings_data(data_type: str, payload: SettingsImportReviewRequest):
    try:
        result = import_reviewed_data_file(data_type, payload.rows, mode=payload.mode)
        report = result.get("merge_report") or {}
        if payload.mode == "merge" and report.get("added", 0) == 0 and report.get("updated", 0) == 0:
            message = "No new transactions were added; all reviewed rows were already present."
        else:
            message = result.get("message") or "Reviewed import completed."
        return {"message": message, "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


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
