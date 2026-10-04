import type { PersonalFinanceRecord } from "../../services/personal-finance-sync-row-computation.js";
import { toNumber } from "../../services/bank-category-totals.js";
import { manualExpenseRows, transferRows } from "./demo-data.js";
import type { Totals } from "../types.js";
import { monthKey, toDateKey, today } from "../utils/date.js";

function basePersonalFinanceRows(): PersonalFinanceRecord[] {
  return [...manualExpenseRows];
}

export function manualPersonalFinanceRows(): PersonalFinanceRecord[] {
  return basePersonalFinanceRows().filter((row) => row.source === "manual");
}

export function currentPersonalFinanceRows(): PersonalFinanceRecord[] {
  return [
    ...basePersonalFinanceRows(),
    ...buildTransferRecordsForCombined(transferRows),
  ];
}

export function personalFinanceSummaryRows(): PersonalFinanceRecord[] {
  return [
    ...basePersonalFinanceRows(),
    ...buildTransferRecordsForFlow(transferRows, "bank"),
    ...buildTransferRecordsForFlow(transferRows, "cash"),
  ];
}

export function personalFinanceRowsForView(view: "combined" | "bank" | "cash"): PersonalFinanceRecord[] {
  if (view === "combined") return currentPersonalFinanceRows();
  return [
    ...basePersonalFinanceRows().filter((row) => row.flow_type === view),
    ...buildTransferRecordsForFlow(transferRows, view),
  ];
}

export function manualRowsForCurrentMonth(): PersonalFinanceRecord[] {
  const currentMonth = monthKey(today());
  return manualPersonalFinanceRows().filter((row) => String(row.date).startsWith(currentMonth));
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
  return totalsForRows(basePersonalFinanceRows().filter((row) => row.source === "manual" && row.date === toDateKey(today())));
}

export function sumRows(rows: PersonalFinanceRecord[]): number {
  return rows.reduce((total, row) => total + Number(row.amount || 0), 0);
}

type TransferRowLike = {
  id?: number | string;
  date?: string | null;
  from_flow?: string | null;
  to_flow?: string | null;
  amount?: number | string | null;
  description?: string | null;
  created_timestamp?: string | null;
  last_updated_timestamp?: string | null;
};

export function buildTransferRecordsForFlow(rows: TransferRowLike[], flowType: "bank" | "cash"): PersonalFinanceRecord[] {
  return rows.flatMap((row) => {
    const amount = Math.abs(toNumber(row.amount));
    if (amount <= 0) return [];
    const from = String(row.from_flow ?? "").trim().toLowerCase();
    const to = String(row.to_flow ?? "").trim().toLowerCase();
    if (from !== "bank" && from !== "cash") return [];
    if (to !== "bank" && to !== "cash") return [];
    if (from === to) return [];

    const signed = from === flowType ? -amount : amount;
    const other = from === flowType ? to : from;
    const label = signed < 0
      ? `Transferred to ${flowLabel(other)}`
      : `Received from ${flowLabel(other)}`;
    const note = String(row.description ?? "").trim();

    return [{
      id: row.id,
      display_id: row.id == null ? "T-demo" : `T-${String(row.id)}`,
      date: String(row.date ?? ""),
      flow_type: flowType,
      direction: "transfer",
      category: "Transfer",
      amount,
      signed_amount: signed,
      description: `${label}${note ? `: ${note}` : ""}`,
      source: "transfer",
      timestamp: String(row.last_updated_timestamp ?? row.created_timestamp ?? ""),
      created_timestamp: row.created_timestamp ?? null,
      last_updated_timestamp: row.last_updated_timestamp ?? null,
      source_ref: row.id == null ? "" : `transfer:${String(row.id)}`,
    }];
  });
}

export function buildTransferRecordsForCombined(rows: TransferRowLike[]): PersonalFinanceRecord[] {
  return rows.flatMap((row) => {
    const amount = Math.abs(toNumber(row.amount));
    if (amount <= 0) return [];
    const from = String(row.from_flow ?? "").trim().toLowerCase();
    const to = String(row.to_flow ?? "").trim().toLowerCase();
    if ((from !== "bank" && from !== "cash") || (to !== "bank" && to !== "cash") || from === to) return [];
    const note = String(row.description ?? "").trim();
    return [{
      id: row.id,
      display_id: row.id == null ? "T-demo" : `T-${String(row.id)}`,
      date: String(row.date ?? ""),
      flow_type: from,
      direction: "transfer",
      category: "Transfer",
      amount,
      signed_amount: -amount,
      description: `Transferred to ${flowLabel(to)}${note ? `: ${note}` : ""}`,
      source: "transfer",
      timestamp: String(row.last_updated_timestamp ?? row.created_timestamp ?? ""),
      created_timestamp: row.created_timestamp ?? null,
      last_updated_timestamp: row.last_updated_timestamp ?? null,
      source_ref: row.id == null ? "" : `transfer:${String(row.id)}`,
    }];
  });
}

function flowLabel(flowType: string): string {
  return flowType === "cash" ? "Cash" : "Bank";
}

