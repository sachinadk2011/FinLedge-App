from fastapi import APIRouter, HTTPException

from backend.models import PersonalFinanceAddRequest
from backend.services.personal_finance_service import (
    append_personal_finance_record,
    delete_personal_finance_record,
    read_personal_finance_records,
    summarize_personal_finance_records,
    update_personal_finance_record,
)

router = APIRouter(prefix="/personal-finance", tags=["personal-finance"])


@router.post("/add")
def add_personal_finance_record(payload: PersonalFinanceAddRequest):
    try:
        record = append_personal_finance_record(
            entry_date=payload.dates,
            flow_type=payload.flow_type.value,
            direction=payload.direction.value,
            category=payload.category.value,
            amount=payload.amount,
            description=payload.description,
            source=payload.source,
        )
        return {"message": "Personal Expenses record added successfully", "data": record}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/data")
def get_personal_finance_data(flow_type: str | None = None):
    try:
        records = read_personal_finance_records(flow_type=flow_type)
        summary = summarize_personal_finance_records(records)
        return {
            "records": records,
            "summary": summary,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/delete/{flow_type}/{record_id}")
def delete_personal_finance_row(flow_type: str, record_id: int):
    try:
        result = delete_personal_finance_record(record_id, flow_type)
        return {"message": "Personal Expenses record deleted", "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/update/{record_flow_type}/{record_id}")
def update_personal_finance_row(record_flow_type: str, record_id: int, payload: PersonalFinanceAddRequest):
    try:
        result = update_personal_finance_record(
            record_id=record_id,
            record_flow_type=record_flow_type,
            entry_date=payload.dates,
            flow_type=payload.flow_type.value,
            direction=payload.direction.value,
            category=payload.category.value,
            amount=payload.amount,
            description=payload.description,
            source=payload.source,
        )
        return {"message": "Personal Expenses record updated", "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
