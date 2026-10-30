import { TRANSFER_DIRECTION_OPTIONS } from "./transferDirections";
import { getJson } from "../api/client";

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
  "Gift",
  "Other",
];

export const PERSONAL_FINANCE_INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Prize/Lottery",
  "Gift",
  "Refund",
  "Other Income",
];

function replaceArray(target, values) {
  if (!Array.isArray(values) || !values.length) return;
  target.splice(0, target.length, ...values);
}

let categoryOptionsLoad = null;

/** Refresh category choices from the backend enum definitions. */
export async function loadCategoryOptions() {
  if (!categoryOptionsLoad) {
    categoryOptionsLoad = getJson("/meta/categories").then((categories) => {
      replaceArray(BANK_CATEGORIES, categories.bank_categories);
      BANK_INCOME_CATEGORIES.clear();
      (categories.bank_income_categories || []).forEach((category) => BANK_INCOME_CATEGORIES.add(String(category).toLowerCase()));
      replaceArray(PERSONAL_FINANCE_EXPENSE_CATEGORIES, categories.personal_finance_expense_categories);
      replaceArray(PERSONAL_FINANCE_INCOME_CATEGORIES, categories.personal_finance_income_categories);
    }).catch((error) => {
      categoryOptionsLoad = null;
      throw error;
    });
  }
  return categoryOptionsLoad;
}

export const PERSONAL_FINANCE_TRANSFER_DIRECTIONS = TRANSFER_DIRECTION_OPTIONS;
export { destinationFlow, normalizeTransferDirection, originFlow, transferActionLabel, transferFlowLabel } from "./transferDirections";
