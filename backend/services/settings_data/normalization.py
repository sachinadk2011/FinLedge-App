"""Legacy column and category normalization rules for workbook imports."""

from ...models import BankCategory, ShareCategory, PF_EXPENSE_CATEGORIES, PF_INCOME_CATEGORIES

_COLUMN_ALIASES: dict[str, str] = {
    # Bank Services — old versions called it "Cumulative Total"
    "cumulative total": "Cumulative Amount",
    "cumulative balance": "Cumulative Amount",
    "running total": "Cumulative Amount",
    # Audit timestamp aliases used by older workbooks and external exports.
    "timestamp": "Created Timestamp",
    "created at": "Created Timestamp",
    "created timestamp": "Created Timestamp",
    # Personal Finance — alternate Direction names
    "type": "Direction",
    "transaction type": "Direction",
    "transfer direction": "Direction",
    # Generic
    "note": "Description",
    "notes": "Description",
    "remarks": "Description",
}

_BANK_REQUIRED = ["Date", "Category", "Amount"]

_SHARE_REQUIRED = ["Date", "Share Name", "Category", "Per Unit Price", "Allotted", "Buy/Sell"]

_PF_REQUIRED = ["Date", "Direction", "Category", "Amount"]

_BANK_LEGACY_CATEGORIES = {"income", "service cost", "investment cost", "operation cost"}

_BANK_RETIRED_CATEGORIES = {"atm charge", "sms charge"}

_BANK_VALID_CATEGORIES = {c.value for c in BankCategory}

_BANK_INCOME_CATEGORIES = {"Interest Earned"}

_SHARE_CATEGORY_ALIASES: dict[str, str] = {
    "ipo": "ipo",
    "ipo entry": "ipo",
    "initial public offering": "ipo",
    "sip": "sip",
    "sip investment": "sip",
    "systematic investment plan": "sip",
    "buy": "buy",
    "secondary buy": "buy",
    "purchase": "buy",
    "sell": "sell",
    "sell shares": "sell",
    "sale": "sell",
    "dividend": "dividend",
    "dividend (cash)": "dividend",
    "cash dividend": "dividend",
    "dividend (bonus)": "dividend",
    "bonus dividend": "dividend",
    "bonus": "dividend",
}

_SHARE_VALID_CATEGORIES = {c.value for c in ShareCategory}

_PF_DIRECTION_ALIASES: dict[str, str] = {
    "income": "income",
    "credit": "income",
    "in": "income",
    "inflow": "income",
    "expense": "expense",
    "expenses": "expense",
    "debit": "expense",
    "out": "expense",
    "outflow": "expense",
    "cost": "expense",
    "charge": "expense",
    "spend": "expense",
    "spending": "expense",
}

_PF_EXPENSE_ALIASES: dict[str, str] = {
    "food & dining": "Food",
    "food and dining": "Food",
    "dining": "Food",
    "restaurant": "Food",
    "grocery": "Food",
    "groceries": "Food",
    "transport": "Transportation",
    "commute": "Transportation",
    "fuel": "Transportation",
    "petrol": "Transportation",
    "movie": "Entertainment",
    "movies": "Entertainment",
    "recreation": "Entertainment",
    "clothing": "Shopping",
    "clothes": "Shopping",
    "medical": "Health",
    "hospital": "Health",
    "medicine": "Health",
    "school": "Education",
    "university": "Education",
    "tuition": "Education",
    "utility": "Bills",
    "utilities": "Bills",
    "electricity": "Bills",
    "internet": "Bills",
    "water": "Bills",
    "phone": "Bills",
    "mobile": "Bills",
    "house rent": "Rent",
    "apartment rent": "Rent",
    "vacation": "Travel",
    "trip": "Travel",
    "invest": "Investment",
    "investment cost": "Investment",
    "share market": "Share Market",
    "stock": "Share Market",
    "sip": "SIP",
}

_PF_EXPENSE_VALID = {c.value for c in PF_EXPENSE_CATEGORIES}

_PF_INCOME_ALIASES: dict[str, str] = {
    "wages": "Salary",
    "monthly salary": "Salary",
    "bonus salary": "Salary",
    "part time": "Freelance",
    "part-time": "Freelance",
    "contract work": "Freelance",
    "business income": "Business",
    "profit": "Business",
    "lottery": "Prize/Lottery",
    "prize": "Prize/Lottery",
    "gift money": "Gift",
    "present": "Gift",
    "cashback": "Refund",
    "cash back": "Refund",
    "return": "Refund",
    "investment return": "Investment Return",
    "investment income": "Investment Income",
    "capital gain": "Investment Return",
    "interest income": "Investment Income",
    "dividend income": "Dividend",
    "dividend": "Dividend",
    "share proceeds": "Share Sell Proceeds",
    "sell proceeds": "Share Sell Proceeds",
    "share sell": "Share Sell Proceeds",
}

_PF_INCOME_VALID = {c.value for c in PF_INCOME_CATEGORIES}

def _migrate_bank_category(category: str, description: str) -> tuple[str, int]:
    """
    Map a bank category to the current v1.2.0 category set.
    Returns (new_category, sign) where sign is +1 for income, -1 for charge, 0 = keep amount as-is.
    Mirrors the logic in data_migration_service._map_legacy_category exactly.
    """
    orig = category.strip().lower()
    text = description.strip().lower()
    compact = text.replace(" ", "")

    # Already a valid current category — keep it
    if category.strip() in _BANK_VALID_CATEGORIES:
        sign = 1 if category.strip() in _BANK_INCOME_CATEGORIES else -1
        return category.strip(), 0  # amount already signed correctly

    if orig == "atm charge":
        return "Debit Card Charge", -1
    if orig == "sms charge":
        return "Mobile Banking Charge", -1
    if orig not in _BANK_LEGACY_CATEGORIES:
        # Unknown category — put under Other Charges
        return "Other Charges", -1
    if orig == "income" and ("interest" in text or "int" in text):
        return "Interest Earned", 1
    if orig == "service cost" and "tax" in text:
        return "Interest Tax", -1
    if orig == "service cost" and "mobile banking" in text and "renew" in text:
        return "Mobile Banking Charge", -1
    if orig == "service cost" and "bank" in text and "renew" in text:
        return "Mobile Banking Charge", -1
    if orig == "service cost" and "mobile" in text:
        return "Mobile Banking Charge", -1
    if orig == "service cost" and "card" in text and "install" in text:
        return "Debit Card Charge", -1
    if orig == "investment cost" and "demat" in text and "meroshare" in compact and "renew" in text:
        return "Demat & MeroShare Renewal", -1
    if orig == "investment cost" and "meroshare" in compact and "renew" in text:
        return "MeroShare Renewal", -1
    if orig == "investment cost" and "demat" in text and "renew" in text:
        return "Demat Renewal", -1
    if orig == "investment cost" and "broker" in text and "renew" in text:
        return "Broker Renewal", -1
    # income that doesn't match interest → keep as income category
    if orig == "income":
        return "Other Charges", 1  # positive amount, unknown income
    return "Other Charges", -1

def _migrate_share_category(category: str) -> str:
    """Normalise a Share Portfolio category to the current lowercase key."""
    key = category.strip().lower()
    return _SHARE_CATEGORY_ALIASES.get(key, key if key in _SHARE_VALID_CATEGORIES else "buy")

def _migrate_pf_direction(direction: str) -> str:
    """Normalise a PF direction value to 'income' or 'expense'."""
    key = direction.strip().lower()
    return _PF_DIRECTION_ALIASES.get(key, "expense")

def _migrate_pf_category(category: str, direction: str) -> str:
    """Map a PF category to the closest current valid category for the given direction."""
    raw = category.strip()
    key = raw.lower()
    if direction == "income":
        if raw in _PF_INCOME_VALID:
            return raw
        return _PF_INCOME_ALIASES.get(key, "Other Income")
    else:
        if raw in _PF_EXPENSE_VALID:
            return raw
        return _PF_EXPENSE_ALIASES.get(key, "Other")
