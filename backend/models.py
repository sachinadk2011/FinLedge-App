from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field, model_validator


class BankCategory(str, Enum):
    interest_earned = "Interest Earned"
    interest_tax = "Interest Tax"
    mobile_banking_charge = "Mobile Banking Charge"
    debit_card_charge = "Debit Card Charge"
    atm_charge = "ATM Charge"
    sms_charge = "SMS Charge"
    cheque_book = "Cheque Book"
    locker = "Locker"
    demat_renewal = "Demat Renewal"
    broker_renewal = "Broker Renewal"
    meroshare_renewal = "MeroShare Renewal"
    other_charges = "Other Charges"


class ShareCategory(str, Enum):
    ipo = "ipo"
    sip = "sip"
    buy = "buy"
    sell = "sell"
    dividend = "dividend"


class PersonalFinanceFlow(str, Enum):
    bank = "bank"
    cash = "cash"


class PersonalFinanceDirection(str, Enum):
    income = "income"
    expense = "expense"


class PersonalFinanceCategory(str, Enum):
    food = "Food"
    transportation = "Transportation"
    entertainment = "Entertainment"
    shopping = "Shopping"
    health = "Health"
    education = "Education"
    bills = "Bills"
    rent = "Rent"
    travel = "Travel"
    insurance = "Insurance"
    investment = "Investment"
    sip = "SIP"
    share_market = "Share Market"
    other = "Other"
    salary = "Salary"
    freelance = "Freelance"
    business = "Business"
    prize_lottery = "Prize/Lottery"
    gift = "Gift"
    refund = "Refund"
    investment_return = "Investment Return"
    dividend = "Dividend"
    share_sell_proceeds = "Share Sell Proceeds"
    other_income = "Other Income"


class BankAddRequest(BaseModel):
    dates: date | None = None
    category: BankCategory
    amount: float
    description: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_amount_sign(self):
        if self.category == BankCategory.interest_earned and self.amount <= 0:
            raise ValueError("Amount must be positive for Interest Earned.")
        if self.category != BankCategory.interest_earned and self.amount >= 0:
            raise ValueError("Amount must be negative for Bank Services charge categories.")
        return self


class PersonalFinanceAddRequest(BaseModel):
    dates: date | None = None
    flow_type: PersonalFinanceFlow
    direction: PersonalFinanceDirection
    category: PersonalFinanceCategory
    amount: Decimal = Field(..., gt=0)
    description: str | None = Field(default=None, max_length=500)
    source: Literal["manual", "share-sync"] = "manual"

    @model_validator(mode="after")
    def validate_category_group(self):
        expense_categories = {
            PersonalFinanceCategory.food,
            PersonalFinanceCategory.transportation,
            PersonalFinanceCategory.entertainment,
            PersonalFinanceCategory.shopping,
            PersonalFinanceCategory.health,
            PersonalFinanceCategory.education,
            PersonalFinanceCategory.bills,
            PersonalFinanceCategory.rent,
            PersonalFinanceCategory.travel,
            PersonalFinanceCategory.insurance,
            PersonalFinanceCategory.investment,
            PersonalFinanceCategory.sip,
            PersonalFinanceCategory.share_market,
            PersonalFinanceCategory.other,
        }
        income_categories = {
            PersonalFinanceCategory.salary,
            PersonalFinanceCategory.freelance,
            PersonalFinanceCategory.business,
            PersonalFinanceCategory.prize_lottery,
            PersonalFinanceCategory.gift,
            PersonalFinanceCategory.refund,
            PersonalFinanceCategory.investment_return,
            PersonalFinanceCategory.dividend,
            PersonalFinanceCategory.share_sell_proceeds,
            PersonalFinanceCategory.other_income,
        }

        if self.direction == PersonalFinanceDirection.expense and self.category not in expense_categories:
            raise ValueError("Expense entries must use an expense category.")
        if self.direction == PersonalFinanceDirection.income and self.category not in income_categories:
            raise ValueError("Income entries must use an income category.")
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
