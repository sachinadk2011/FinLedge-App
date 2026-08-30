import {
  buildBankServicesSyncRecords,
  buildShareSyncRecords,
  type PersonalFinanceRecord,
} from "../../services/personal-finance-sync-row-computation.js";
import { bankRecords, manualExpenseRows, shareRecords } from "./demo-data.js";
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

