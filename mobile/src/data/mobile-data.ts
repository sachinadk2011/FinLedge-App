import {
  buildBankServicesSyncRecords,
  buildShareSyncRecords,
  type PersonalFinanceRecord,
} from "../../services/personal-finance-sync-row-computation.js";
import { toNumber } from "../../services/bank-category-totals.js";
import { bankRecords, manualExpenseRows, shareRecords, transferRows } from "./demo-data.js";
import type { Totals } from "../types.js";
import { monthKey, toDateKey, today } from "../utils/date.js";

export function currentPersonalFinanceRows(): PersonalFinanceRecord[] {
  return [
    ...manualExpenseRows,
    ...buildShareSyncRecords(shareRecords),
    ...buildBankServicesSyncRecords(bankRecords),
  ];
}

export function manualRowsForCurrentMonth(): PersonalFinanceRecord[] {
  const currentMonth = monthKey(today());
  return currentPersonalFinanceRows().filter((row) => row.source === "manual" && String(row.date).startsWith(currentMonth));
}

export function totalsForRows(rows: PersonalFinanceRecord[]): Totals {
  const income = rows.filter((row) => row.direction === "income").reduce((total, row) => total + Number(row.amount || 0), 0);
  const expense = rows.filter((row) => row.direction === "expense").reduce((total, row) => total + Number(row.amount || 0), 0);
  return { income, expense, net: income - expense };
}

export function currentMonthTotals(): Totals {
  return totalsForRows(manualRowsForCurrentMonth());
}

export function todayTotals(): Totals {
  return totalsForRows(currentPersonalFinanceRows().filter((row) => row.source === "manual" && row.date === toDateKey(today())));
}

export function sumRows(rows: PersonalFinanceRecord[]): number {
  return rows.reduce((total, row) => total + Number(row.amount || 0), 0);
}

export type TransferAdjustment = { bank: number; cash: number };

/**
 * Net effect of recorded transfers on the Bank and Cash flows, so a transfer
 * actually moves money between them in the flow balances:
 *   cash → bank  : bank +amount, cash −amount
 *   bank → cash  : bank −amount, cash +amount
 */
export function transferAdjustments(
  rows: Array<{ from_flow?: string | null; to_flow?: string | null; amount?: number | string | null }>,
): TransferAdjustment {
  let bank = 0;
  for (const row of rows) {
    const amount = Math.abs(toNumber(row.amount));
    const from = String(row.from_flow ?? "").trim();
    const to = String(row.to_flow ?? "").trim();
    if (from === "cash" && to === "bank") bank += amount;
    if (from === "bank" && to === "cash") bank -= amount;
  }
  return { bank, cash: -bank };
}

