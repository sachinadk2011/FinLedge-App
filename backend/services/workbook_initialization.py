"""Create missing FinLedge workbooks for a newly prepared data directory."""

import json
from pathlib import Path

WORKBOOK_NAMES = (
    "bank_transactions.xlsx",
    "share_transactions.xlsx",
    "personal_finance_bank_flow.xlsx",
    "personal_finance_cash_flow.xlsx",
    "personal_finance_transfer.xlsx",
)
INITIALIZED_MARKER = ".finledge-workbooks-initialized.json"


def initialize_data_workbooks(data_dir: Path) -> dict:
    """Initialize each workbook through its owning service's schema logic."""
    data_dir = Path(data_dir).expanduser().resolve()
    marker_path = data_dir / INITIALIZED_MARKER
    if marker_path.is_file() and all((data_dir / name).is_file() for name in WORKBOOK_NAMES):
        return {"status": "already_initialized", "files": list(WORKBOOK_NAMES)}

    from .bank_service import read_bank_records
    from .personal_finance_service import read_personal_finance_records, read_transfer_records
    from .share_service import read_share_records

    read_bank_records()
    read_share_records()
    read_personal_finance_records(flow_type="bank")
    read_personal_finance_records(flow_type="cash")
    read_transfer_records()

    report = {"status": "initialized", "files": list(WORKBOOK_NAMES)}
    marker_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report
