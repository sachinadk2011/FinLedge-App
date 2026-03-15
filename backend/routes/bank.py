from fastapi import APIRouter, HTTPException

from backend.models import BankAddRequest
from backend.services.bank_service import (
    append_bank_record,
    delete_bank_record,
    read_bank_records,
    summarize_bank_records,
    update_bank_record,
)

router = APIRouter(prefix="/bank", tags=["bank"])


@router.post("/add")
def add_bank_record(payload: BankAddRequest):
    try:
        record = append_bank_record(
            entry_date=payload.dates,
            category=payload.category.value,
            amount=payload.amount,
            description=payload.description,
        )
        return {"message": "Bank record added successfully", "data": record}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/data")
def get_bank_data():
    try:
        records = read_bank_records()
        summary = summarize_bank_records(records)
        return {
            "records": records,
            "summary": summary,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/delete/{record_id}")
def delete_bank_row(record_id: int):
    try:
        result = delete_bank_record(record_id)
        return {"message": "Bank record deleted", "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/update/{record_id}")
def update_bank_row(record_id: int, payload: BankAddRequest):
    try:
        result = update_bank_record(
            record_id=record_id,
            entry_date=payload.dates,
            category=payload.category.value,
            amount=payload.amount,
            description=payload.description,
        )
        return {"message": "Bank record updated", "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
