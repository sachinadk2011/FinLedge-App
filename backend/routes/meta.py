from fastapi import APIRouter

from backend.models import (
    BankCategory,
    PF_EXPENSE_CATEGORIES,
    PF_INCOME_CATEGORIES,
    PersonalFinanceCategory,
)

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/categories")
def get_categories():
    """Return category choices derived from the backend request-model enums."""
    pf_categories = list(PersonalFinanceCategory)
    return {
        "bank_categories": [category.value for category in BankCategory],
        "bank_income_categories": [BankCategory.interest_earned.value, "income"],
        "personal_finance_expense_categories": [category.value for category in pf_categories if category in PF_EXPENSE_CATEGORIES],
        "personal_finance_income_categories": [category.value for category in pf_categories if category in PF_INCOME_CATEGORIES],
    }
