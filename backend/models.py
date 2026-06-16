from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field, model_validator


class BankCategory(str, Enum):
    operation_cost = "operation cost"
    investment_cost = "investment cost"
    service_cost = "service cost"
    income = "income"


class ShareCategory(str, Enum):
    ipo = "ipo"
    sip = "sip"
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


class ShareBaseRequest(BaseModel):
    dates: date | None = None
    share_name: str = Field(..., min_length=1, max_length=200)
    category: ShareCategory


class IpoSecondaryShareRequest(ShareBaseRequest):
    category: Literal[ShareCategory.ipo, ShareCategory.buy, ShareCategory.sell]
    per_unit_price: Decimal = Field(..., ge=0)
    allotted: int = Field(..., ge=0)
    buy_sell: str = Field(..., min_length=1, max_length=20)


class SipShareRequest(ShareBaseRequest):
    category: Literal[ShareCategory.sip]
    total_amount: Decimal = Field(..., gt=0)
    buy_sell: Literal["installment", "redeem"] = "installment"


class DividendShareRequest(ShareBaseRequest):
    category: Literal[ShareCategory.dividend]
    amount: Decimal | None = Field(default=None, ge=0)
    bonus_shares: int | None = Field(default=None, ge=0)
    buy_sell: Literal["cash", "bonus"]

    @model_validator(mode="after")
    def validate_dividend_value(self):
        if self.buy_sell == "cash":
            if self.amount is None:
                raise ValueError("Cash dividend requires an amount.")
            if self.bonus_shares not in (None, 0):
                raise ValueError("Cash dividend cannot include bonus shares.")
        if self.buy_sell == "bonus":
            if self.bonus_shares is None or self.bonus_shares <= 0:
                raise ValueError("Bonus dividend requires a positive share quantity.")
            if self.amount not in (None, Decimal("0")):
                raise ValueError("Bonus dividend cannot include a cash amount.")
        return self


ShareAddRequest = Annotated[
    Union[IpoSecondaryShareRequest, SipShareRequest, DividendShareRequest],
    Field(discriminator="category"),
]


class ShareUpdateAllotmentRequest(BaseModel):
    share_name: str = Field(..., min_length=1, max_length=200)
    allotted: int = Field(..., gt=0)


class ShareUpdateSipAllotmentRequest(BaseModel):
    share_name: str = Field(..., min_length=1, max_length=200)
    allotted: int = Field(..., gt=0)
