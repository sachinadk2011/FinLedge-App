from fastapi import APIRouter, HTTPException

from backend.models import (
    DividendShareRequest,
    IpoSecondaryShareRequest,
    ShareAddRequest,
    ShareUpdateAllotmentRequest,
    ShareUpdateSipAllotmentRequest,
    SipShareRequest,
)
from backend.services.share_service import (
    append_share_record,
    delete_share_record,
    read_share_records,
    summarize_share_records,
    update_share_allotment,
    update_sip_allotment,
    update_share_record,
)
router = APIRouter(prefix="/share", tags=["share"])


def _share_payload_to_service_args(payload: ShareAddRequest) -> dict:
    if isinstance(payload, SipShareRequest):
        return {
            "entry_date": payload.dates,
            "share_name": payload.share_name,
            "category": payload.category.value,
            "per_unit_price": payload.total_amount,
            "allotted": 0,
            "buy_sell": payload.buy_sell,
        }

    if isinstance(payload, DividendShareRequest):
        return {
            "entry_date": payload.dates,
            "share_name": payload.share_name,
            "category": payload.category.value,
            "per_unit_price": payload.amount if payload.buy_sell == "cash" else 0,
            "allotted": 0 if payload.buy_sell == "cash" else payload.bonus_shares,
            "buy_sell": payload.buy_sell,
        }

    if isinstance(payload, IpoSecondaryShareRequest):
        return {
            "entry_date": payload.dates,
            "share_name": payload.share_name,
            "category": payload.category.value,
            "per_unit_price": payload.per_unit_price,
            "allotted": payload.allotted,
            "buy_sell": payload.buy_sell,
        }

    raise ValueError("Unsupported share payload.")


@router.post("/add")
def add_share_record(payload: ShareAddRequest):
    try:
        record = append_share_record(**_share_payload_to_service_args(payload))
        return {"message": "Share record added successfully", "data": record}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/data")
def get_share_data():
    try:
        records = read_share_records()
        summary = summarize_share_records(records)
        return {
            "records": records,
            "summary": summary,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/update-allotment")
def update_allotment(payload: ShareUpdateAllotmentRequest):
    try:
        result = update_share_allotment(payload.share_name, payload.allotted)
        return {"message": "IPO allotment updated", "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/update-sip-allotment")
def update_sip_quantity(payload: ShareUpdateSipAllotmentRequest):
    try:
        result = update_sip_allotment(payload.share_name, payload.allotted)
        return {"message": "SIP share quantity updated", "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/delete/{record_id}")
def delete_share_row(record_id: int):
    try:
        result = delete_share_record(record_id)
        return {"message": "Share record deleted", "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/update/{record_id}")
def update_share_row(record_id: int, payload: ShareAddRequest):
    try:
        result = update_share_record(record_id=record_id, **_share_payload_to_service_args(payload))
        return {"message": "Share record updated", "data": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
