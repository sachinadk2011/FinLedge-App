from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from backend.services.bank_service import read_bank_records, summarize_bank_records
from backend.services.share_service import read_share_records, summarize_share_records
from backend.services.summary_graph_service import (
    build_combined_position_png,
    build_monthly_bank_png,
    build_monthly_overview_png,
    build_monthly_share_png,
    build_yearly_bank_png,
    build_yearly_overview_png,
    build_yearly_share_png,
)

router = APIRouter(prefix="/summary", tags=["summary"])

MIN_RECORDS_FOR_INSIGHTS = 10
INSIGHTS_MESSAGE = "Add more transaction data to generate meaningful financial insights."


def _png_response(png_bytes: bytes) -> Response:
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            # Graphs should always reflect latest data. Frontend also adds a ts query param.
            "Cache-Control": "no-store",
        },
    )


def _ensure_min_records() -> tuple[list[dict], list[dict]]:
    bank_records = read_bank_records()
    share_records = read_share_records()
    if (len(bank_records) + len(share_records)) < MIN_RECORDS_FOR_INSIGHTS:
        raise HTTPException(status_code=400, detail=INSIGHTS_MESSAGE)
    return bank_records, share_records


@router.get("/graphs/monthly-bank")
def monthly_bank_graph():
    try:
        bank_records, _share_records = _ensure_min_records()
        return _png_response(build_monthly_bank_png(bank_records))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/graphs/yearly-bank")
def yearly_bank_graph():
    try:
        bank_records, _share_records = _ensure_min_records()
        return _png_response(build_yearly_bank_png(bank_records))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/graphs/monthly-share")
def monthly_share_graph():
    try:
        _bank_records, share_records = _ensure_min_records()
        return _png_response(build_monthly_share_png(share_records))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/graphs/yearly-share")
def yearly_share_graph():
    try:
        _bank_records, share_records = _ensure_min_records()
        return _png_response(build_yearly_share_png(share_records))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/graphs/monthly")
def monthly_overview_graph():
    try:
        bank_records, share_records = _ensure_min_records()
        return _png_response(build_monthly_overview_png(bank_records=bank_records, share_records=share_records))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/graphs/yearly")
def yearly_overview_graph():
    try:
        bank_records, share_records = _ensure_min_records()
        return _png_response(build_yearly_overview_png(bank_records=bank_records, share_records=share_records))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/graphs/combined")
def combined_graph():
    try:
        bank_records, share_records = _ensure_min_records()
        bank_summary = summarize_bank_records(bank_records)
        share_summary = summarize_share_records(share_records)
        return _png_response(build_combined_position_png(bank_summary=bank_summary, share_summary=share_summary))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
