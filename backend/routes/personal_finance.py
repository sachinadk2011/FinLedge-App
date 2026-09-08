from fastapi import APIRouter, HTTPException

from backend.models import PersonalFinanceAddRequest, PersonalFinanceTransferRequest
from backend.services.personal_finance_service import (
    append_personal_finance_record,
    create_transfer_record,
    delete_personal_finance_record,
    read_personal_finance_records,
    summarize_personal_finance_records,
    update_personal_finance_record,
    update_transfer_record,
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
        # Display records (combined = deduplicated transfers, one row per transfer)
        records = read_personal_finance_records(flow_type=flow_type)

        normalized = (flow_type or "combined").strip().lower()
        if normalized == "combined":
            # For summary accuracy: use full per-flow records so each transfer is
            # seen from BOTH sides (bank loses AND cash gains, or vice versa).
            # This prevents receiving-side income from being silently ignored.
            bank_recs = read_personal_finance_records(flow_type="bank")
            cash_recs = read_personal_finance_records(flow_type="cash")
            summary = summarize_personal_finance_records(bank_recs + cash_recs)
        else:
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


@router.post("/transfer")
def add_transfer_record(payload: PersonalFinanceTransferRequest):
    try:
        record = create_transfer_record(
            entry_date=payload.dates,
            direction=payload.direction.value,
            amount=payload.amount,
            description=payload.description,
        )
        return {"message": "Transfer recorded successfully", "data": record}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/transfer/{transfer_id}")
def edit_transfer_record(transfer_id: int, payload: PersonalFinanceTransferRequest):
    try:
        result = update_transfer_record(
            transfer_id=transfer_id,
            entry_date=payload.dates,
            direction=payload.direction.value,
            amount=payload.amount,
            description=payload.description,
        )
        return {"message": "Transfer updated successfully", "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
