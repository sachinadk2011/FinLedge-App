from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class BankCategory(str, Enum):
    operation_cost = "operation cost"
    investment_cost = "investment cost"
    service_cost = "service cost"
    income = "income"


class ShareCategory(str, Enum):
    ipo = "ipo"
    buy = "buy"
    sell = "sell"
    dividend = "dividend"


class BankAddRequest(BaseModel):
    dates: date | None = None
    category: BankCategory
    amount: float
    description: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_amount_sign(self):
        if self.category == BankCategory.income and self.amount <= 0:
            raise ValueError("Amount must be positive for income.")
        if self.category != BankCategory.income and self.amount >= 0:
            raise ValueError("Amount must be negative for cost categories.")
        return self


class ShareAddRequest(BaseModel):
    dates: date | None = None
    share_name: str = Field(..., min_length=1, max_length=200)
    category: ShareCategory
    per_unit_price: Decimal = Field(..., ge=0)
    allotted: int = Field(..., ge=0)
    buy_sell: str = Field(..., min_length=1, max_length=20)


class ShareUpdateAllotmentRequest(BaseModel):
    share_name: str = Field(..., min_length=1, max_length=200)
    allotted: int = Field(..., gt=0)
