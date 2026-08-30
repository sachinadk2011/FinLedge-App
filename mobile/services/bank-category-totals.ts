export const BANK_SERVICE_CATEGORIES = [
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
] as const;

export const BANK_INCOME_CATEGORIES = new Set(["interest earned", "income"]);

export type BankRecord = {
  id?: number | string;
  date?: string | null;
  category?: string | null;
  amount?: number | string | null;
  description?: string | null;
  timestamp?: string | null;
};

export type BankCategoryTotalsSummary = {
  total_income: number;
  total_expenses: number;
  net_balance: number;
  category_totals: Record<string, number>;
};

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function isIncomeCategory(category: string): boolean {
  return BANK_INCOME_CATEGORIES.has(category.trim().toLowerCase());
}

export function summarizeBankRecords(records: BankRecord[]): BankCategoryTotalsSummary {
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals: Record<string, number> = Object.fromEntries(
    BANK_SERVICE_CATEGORIES.map((category) => [category, 0]),
  );

  for (const record of records) {
    const category = String(record.category ?? "").trim();
    const amount = toNumber(record.amount);

    if (isIncomeCategory(category)) {
      totalIncome += amount;
      if (category in categoryTotals) {
        categoryTotals[category] += amount;
      } else if (category) {
        categoryTotals[category] = (categoryTotals[category] ?? 0) + amount;
      }
    } else {
      const expenseAmount = Math.abs(amount);
      totalExpenses += expenseAmount;
      if (category) {
        categoryTotals[category] = (categoryTotals[category] ?? 0) + expenseAmount;
      }
    }
  }

  return {
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_balance: totalIncome - totalExpenses,
    category_totals: categoryTotals,
  };
}
