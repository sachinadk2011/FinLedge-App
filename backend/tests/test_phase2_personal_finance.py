import pytest
from pydantic import ValidationError

from backend.models import PersonalFinanceAddRequest
from backend.services import personal_finance_service


def test_personal_finance_combined_view_uses_own_flows_and_transfers(monkeypatch):
    bank_record = {"id": 1, "flow_type": "bank", "source": "manual", "date": "2026-01-01"}
    cash_record = {"id": 1, "flow_type": "cash", "source": "manual", "date": "2026-01-02"}
    monkeypatch.setattr(
        personal_finance_service,
        "_read_personal_finance_records_for_flow",
        lambda flow: [bank_record] if flow == "bank" else [cash_record],
    )
    monkeypatch.setattr(personal_finance_service, "_build_transfer_records_for_combined", lambda: [])

    records = personal_finance_service.read_personal_finance_records("combined")

    assert records == [bank_record, cash_record]


def test_share_only_categories_are_excluded_from_personal_expense_totals():
    records = [
        {
            "flow_type": "bank",
            "direction": "expense",
            "category": "Investment Expense",
            "amount": 25,
            "source": "manual",
        },
        {
            "flow_type": "bank",
            "direction": "income",
            "category": "Investment Income",
            "amount": 40,
            "source": "manual",
        },
        {
            "flow_type": "bank",
            "direction": "expense",
            "category": "Service Cost",
            "amount": 300,
            "source": "bank-services-sync",
        },
        {
            "flow_type": "bank",
            "direction": "income",
            "category": "Salary",
            "amount": 1000,
            "source": "share-sync",
        },
    ]

    summary = personal_finance_service.summarize_personal_finance_records(records)["bank"]

    assert summary["expenses"] == 0
    assert summary["total_expenses"] == 0
    assert summary["income"] == 0
    assert summary["total_income"] == 0


@pytest.mark.parametrize("category", ["Investment", "SIP", "Share Market", "Investment Income", "Dividend"])
def test_share_categories_are_not_valid_personal_expense_entries(category):
    direction = "income" if category in {"Investment Income", "Dividend"} else "expense"
    with pytest.raises(ValidationError):
        PersonalFinanceAddRequest(
            flow_type="bank",
            direction=direction,
            category=category,
            amount=100,
        )
