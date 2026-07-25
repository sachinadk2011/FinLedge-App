export const BANK_CATEGORIES = [
  "Interest Earned",
  "Interest Tax",
  "Mobile Banking Charge",
  "Debit Card Charge",
  "Cheque Book",
  "Locker",
  "Demat Renewal",
  "Demat & MeroShare Renewal",
  "Broker Renewal",
  "MeroShare Renewal",
  "Other Charges",
];

/**
 * Categories that represent income (positive amount) in Bank Services.
 * Kept here as a single source of truth — used by BankDashboard and Summary.
 */
export const BANK_INCOME_CATEGORIES = new Set(["interest earned", "income"]);

export const SHARE_CATEGORIES = ["ipo", "sip", "buy", "sell", "dividend"];

export const SHARE_CATEGORY_LABELS = {
  ipo: "IPO entry",
  sip: "SIP investment",
  buy: "Secondary buy",
  sell: "Sell shares",
  dividend: "Dividend",
};

export const PERSONAL_FINANCE_FLOWS = [
  { value: "bank", label: "Bank Flow" },
  { value: "cash", label: "Cash Flow" },
];

export const PERSONAL_FINANCE_DIRECTIONS = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export const PERSONAL_FINANCE_EXPENSE_CATEGORIES = [
  "Food",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Health",
  "Education",
  "Bills",
  "Rent",
  "Travel",
  "Insurance",
  "Investment",
  "SIP",
  "Share Market",
  "Other",
];

export const PERSONAL_FINANCE_INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Prize/Lottery",
  "Gift",
  "Refund",
  "Investment Income",
  "Investment Return",
  "Dividend",
  "Share Sell Proceeds",
  "Other Income",
];
