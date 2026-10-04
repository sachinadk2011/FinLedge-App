import { toNumber } from "./bank-category-totals.js";
import type { PersonalFinanceRecord } from "./personal-finance-sync-row-computation.js";

export type TransferBalanceRecord = {
  id?: number | string;
  date?: string | null;
  transfer_direction?: string | null;
  from_flow?: string | null;
  to_flow?: string | null;
  amount?: number | string | null;
  description?: string | null;
  timestamp?: string | null;
  created_timestamp?: string | null;
  last_updated_timestamp?: string | null;
};

export type TransferRunningBalanceConflict = {
  flow_type: "bank" | "cash";
  date: string;
  amount: number;
  balance: number;
  label: string;
};

export function findTransferRunningBalanceConflict(
  manualRecords: PersonalFinanceRecord[],
  transferRecords: TransferBalanceRecord[],
): TransferRunningBalanceConflict | null {
  for (const flowType of ["bank", "cash"] as const) {
    const events = balanceEventsForFlow(flowType, manualRecords, transferRecords);
    let balance = 0;
    for (const event of events.sort(compareBalanceEvents)) {
      balance += event.signed;
      if (event.source === "transfer" && event.signed < 0 && balance < -0.000001) {
        return {
          flow_type: flowType,
          date: event.date,
          amount: event.amount,
          balance,
          label: event.label,
        };
      }
    }
  }
  return null;
}

export function transferConflictMessage(action: string, conflict: TransferRunningBalanceConflict): string {
  const available = Math.max(0, conflict.amount + conflict.balance);
  return `Not enough ${flowLabel(conflict.flow_type)} income. Available: ${formatNpr(available)}.`;
}

type BalanceEvent = {
  date: string;
  timestamp: string;
  signed: number;
  amount: number;
  label: string;
  source: "manual" | "transfer";
  order: number;
};

function balanceEventsForFlow(
  flowType: "bank" | "cash",
  manualRecords: PersonalFinanceRecord[],
  transferRecords: TransferBalanceRecord[],
): BalanceEvent[] {
  const events: BalanceEvent[] = [];
  let order = 0;

  for (const record of manualRecords) {
    if (String(record.flow_type ?? "").trim().toLowerCase() !== flowType) continue;
    if (String(record.source ?? "manual").trim().toLowerCase() !== "manual") continue;
    const direction = String(record.direction ?? "").trim().toLowerCase();
    if (direction !== "income") continue;
    const signed = toNumber(record.amount);
    const amount = Math.abs(signed);
    if (amount <= 0) continue;
    order += 1;
    events.push({
      date: String(record.date ?? ""),
      timestamp: String(record.last_updated_timestamp ?? record.timestamp ?? record.created_timestamp ?? ""),
      signed,
      amount,
      label: `${String(record.category ?? "Entry").trim() || "Entry"} income`,
      source: "manual",
      order,
    });
  }

  for (const record of transferRecords) {
    const amount = Math.abs(toNumber(record.amount));
    if (amount <= 0) continue;
    const direction = transferDirection(record);
    const signed = transferSignedForFlow(direction, flowType, amount);
    if (!signed) continue;
    order += 1;
    events.push({
      date: String(record.date ?? ""),
      timestamp: String(record.last_updated_timestamp ?? record.timestamp ?? record.created_timestamp ?? ""),
      signed,
      amount,
      label: transferLabel(direction),
      source: "transfer",
      order,
    });
  }

  return events;
}

function transferDirection(record: TransferBalanceRecord): string {
  const explicit = String(record.transfer_direction ?? "").trim().toLowerCase();
  if (explicit === "bank_to_cash" || explicit === "cash_to_bank") return explicit;
  const from = String(record.from_flow ?? "").trim().toLowerCase();
  const to = String(record.to_flow ?? "").trim().toLowerCase();
  if (from === "bank" && to === "cash") return "bank_to_cash";
  if (from === "cash" && to === "bank") return "cash_to_bank";
  return "";
}

function transferSignedForFlow(direction: string, flowType: "bank" | "cash", amount: number): number {
  if (direction === "bank_to_cash") return flowType === "bank" ? -amount : amount;
  if (direction === "cash_to_bank") return flowType === "cash" ? -amount : amount;
  return 0;
}

function transferLabel(direction: string): string {
  return direction === "bank_to_cash" ? "Bank→Cash transfer" : "Cash→Bank transfer";
}

function flowLabel(flowType: "bank" | "cash"): string {
  return flowType === "bank" ? "Bank" : "Cash";
}

function formatNpr(value: number): string {
  const amount = Math.abs(value);
  const rounded = Math.round(amount * 100) / 100;
  const text = Number.isInteger(rounded)
    ? rounded.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : rounded.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `NPR ${text}`;
}

function compareBalanceEvents(
  a: { date: string; timestamp: string; order: number },
  b: { date: string; timestamp: string; order: number },
): number {
  return (
    a.date.localeCompare(b.date) ||
    a.timestamp.localeCompare(b.timestamp) ||
    a.order - b.order
  );
}
