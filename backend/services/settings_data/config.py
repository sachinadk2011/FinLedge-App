"""Data-folder and canonical workbook configuration for Settings operations."""

from typing import Any

from .. import bank_service, personal_finance_service, share_service
from ..path_utils import get_data_dir
from .normalization import _BANK_REQUIRED, _PF_REQUIRED, _SHARE_REQUIRED

DATA_DIR = get_data_dir()

DATA_TYPE_CONFIG: dict[str, dict[str, Any]] = {
    "bank": {
        "label": "Bank Services",
        "filename": "bank_transactions.xlsx",
        "path": bank_service.FILE_PATH,
        "headers": bank_service.HEADERS,
        "required_headers": _BANK_REQUIRED,
        "sheet_name": bank_service.SHEET_NAME,
    },
    "share": {
        "label": "Share Portfolio",
        "filename": "share_transactions.xlsx",
        "path": share_service.FILE_PATH,
        "headers": share_service.HEADERS,
        "required_headers": _SHARE_REQUIRED,
        "sheet_name": share_service.SHEET_NAME,
    },
    "pf-bank": {
        "label": "Personal Expenses — Bank Flow",
        "filename": "personal_finance_bank_flow.xlsx",
        "path": personal_finance_service.BANK_FLOW_FILE_PATH,
        "headers": personal_finance_service.HEADERS,
        "required_headers": _PF_REQUIRED,
        "sheet_name": personal_finance_service.SHEET_NAME,
    },
    "pf-cash": {
        "label": "Personal Expenses — Cash Flow",
        "filename": "personal_finance_cash_flow.xlsx",
        "path": personal_finance_service.CASH_FLOW_FILE_PATH,
        "headers": personal_finance_service.HEADERS,
        "required_headers": _PF_REQUIRED,
        "sheet_name": personal_finance_service.SHEET_NAME,
    },
}

def list_data_types() -> list[dict[str, Any]]:
    return [
        {
            "id": dt,
            "label": cfg["label"],
            "filename": cfg["filename"],
            "headers": list(cfg["headers"]),
            "required_headers": list(cfg["required_headers"]),
        }
        for dt, cfg in DATA_TYPE_CONFIG.items()
    ]

def get_data_type_config(data_type: str) -> dict[str, Any]:
    normalized = str(data_type or "").strip().lower()
    config = DATA_TYPE_CONFIG.get(normalized)
    if not config:
        supported = ", ".join(DATA_TYPE_CONFIG)
        raise ValueError(f"Unknown data type '{data_type}'. Supported types: {supported}.")
    return config
