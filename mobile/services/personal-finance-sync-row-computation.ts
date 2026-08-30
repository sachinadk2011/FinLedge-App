import { type BankRecord, isIncomeCategory, toNumber } from "./bank-category-totals.js";
import { type ShareRecord } from "./share-fifo-lot-matching.js";

export type PersonalFinanceRecord = {
  id?: number | string;
  display_id?: string;
  date?: string | null;
  flow_type?: string | null;
  direction?: string | null;
  category?: string | null;
  amount?: number | string | null;
  signed_amount?: number | string | null;
  description?: string | null;
  source?: string | null;
  timestamp?: string | null;
  source_ref?: string | null;
};

export type FlowSummary = {
  income: number;
  expenses: number;
  investment_expense: number;
  investment_income: number;
  interest_earned: number;
  service_cost: number;
  total_income: number;
  total_expenses: number;
  net: number;
  income_breakdown: Record<string, number>;
  expense_breakdown: Record<string, number>;
};

export type PersonalFinanceSummary = {
  bank: FlowSummary;
  cash: FlowSummary;
  combined: {
    overall_income: number;
    overall_expenses: number;
    overall_net: number;
    bank: FlowSummary;
    cash: FlowSummary;
  };
};

export function signedAmount(direction: string, amount: number | string): number {
  const value = toNumber(amount);
  return direction === "income" ? value : -value;
}

export function shareSyncMapping(record: Pick<ShareRecord, "category" | "buy_sell">): [string, string] | null {
  const category = String(record.category ?? "").trim().toLowerCase();
  const buySell = String(record.buy_sell ?? "").trim().toLowerCase();

  if (category === "ipo" || category === "buy") {
    return ["expense", "Investment Expense"];
  }
  if (category === "sip" && (buySell === "redeem" || buySell === "redeemed")) {
    return ["income", "Investment Income"];
  }
  if (category === "sip") {
    return ["expense", "Investment Expense"];
  }
  if (category === "sell") {
    return ["income", "Investment Income"];
  }
  if (category === "dividend" && buySell === "cash") {
    return ["income", "Investment Income"];
  }
  return null;
}

export function buildShareSyncRecords(sourceRecords: ShareRecord[]): PersonalFinanceRecord[] {
  const eventLabels = new Map<string, string>([
    ["ipo:ipo", "IPO"],
    ["buy:buy", "Secondary buy"],
    ["sell:sell", "Share sell"],
    ["sip:installment", "SIP installment"],
    ["sip:redeem", "SIP redeem"],
    ["sip:redeemed", "SIP redeem"],
    ["dividend:cash", "Cash dividend"],
  ]);

  const records: PersonalFinanceRecord[] = [];
  for (const sourceRecord of sourceRecords) {
    const mapping = shareSyncMapping(sourceRecord);
    const amount = Math.abs(toNumber(sourceRecord.total_amount));
    if (!mapping || amount <= 0) {
      continue;
    }

    const [direction, category] = mapping;
    const shareCategory = String(sourceRecord.category ?? "").trim().toLowerCase();
    const buySell = String(sourceRecord.buy_sell ?? "").trim().toLowerCase();
    const sourceId = Number(sourceRecord.id ?? 0);
    const shareName = String(sourceRecord.share_name ?? "").trim().toUpperCase();
    const label = eventLabels.get(`${shareCategory}:${buySell}`) ?? titleCase(shareCategory);

    records.push({
      id: `share-${sourceId}`,
      display_id: `S-${sourceId}`,
      date: String(sourceRecord.date ?? ""),
      flow_type: "bank",
      direction,
      category,
      amount,
      signed_amount: signedAmount(direction, amount),
      description: `${label}: ${shareName}`,
      source: "share-sync",
      timestamp: String(sourceRecord.timestamp ?? ""),
      source_ref: String(sourceRecord.sync_ref ?? `share:${sourceId}`),
    });
  }

  return records;
}

export function buildBankServicesSyncRecords(sourceRecords: BankRecord[]): PersonalFinanceRecord[] {
  const records: PersonalFinanceRecord[] = [];

  for (const sourceRecord of sourceRecords) {
    const originalCategory = String(sourceRecord.category ?? "").trim();
    const amount = Math.abs(toNumber(sourceRecord.amount));
    if (amount <= 0) {
      continue;
    }

    const direction = isIncomeCategory(originalCategory) ? "income" : "expense";
    const category = direction === "income" ? "Interest Earned" : "Service Cost";
    const sourceId = Number((sourceRecord as { id?: number | string }).id ?? 0);
    const description = String((sourceRecord as { description?: string | null }).description ?? "").trim();
    const label = originalCategory || category;

    records.push({
      id: `bank-services-${sourceId}`,
      display_id: `BS-${sourceId}`,
      date: String((sourceRecord as { date?: string | null }).date ?? ""),
      flow_type: "bank",
      direction,
      category,
      amount,
      signed_amount: signedAmount(direction, amount),
      description: `${label}${description ? `: ${description}` : ""}`,
      source: "bank-services-sync",
      timestamp: String((sourceRecord as { timestamp?: string | null }).timestamp ?? ""),
      source_ref: `bank-services:${sourceId}`,
    });
  }

  return records;
}

export function summarizePersonalFinanceRecords(records: PersonalFinanceRecord[]): PersonalFinanceSummary {
  const flowSummaries = {
    bank: emptyFlowSummary(),
    cash: emptyFlowSummary(),
  };

  for (const record of records) {
    const flowType = String(record.flow_type ?? "").trim().toLowerCase();
    if (flowType !== "bank" && flowType !== "cash") {
      continue;
    }

    const direction = String(record.direction ?? "").trim().toLowerCase();
    const category = String(record.category ?? "").trim() || "Uncategorized";
    const amount = Math.abs(toNumber(record.amount));
    const source = String(record.source ?? "manual").trim().toLowerCase();
    const categoryKey = category.toLowerCase();
    const summary = flowSummaries[flowType];

    if (direction === "income") {
      summary.total_income += amount;
      summary.income_breakdown[category] = (summary.income_breakdown[category] ?? 0) + amount;
      if (flowType === "bank" && source === "bank-services-sync") {
        summary.interest_earned += amount;
      } else if (flowType === "bank" && categoryKey === "investment income") {
        summary.investment_income += amount;
      } else {
        summary.income += amount;
      }
    } else {
      summary.total_expenses += amount;
      summary.expense_breakdown[category] = (summary.expense_breakdown[category] ?? 0) + amount;
      if (flowType === "bank" && source === "bank-services-sync") {
        summary.service_cost += amount;
      } else if (
        flowType === "bank" &&
        ["investment expense", "investment", "sip", "share market"].includes(categoryKey)
      ) {
        summary.investment_expense += amount;
      } else {
        summary.expenses += amount;
      }
    }
  }

  for (const summary of Object.values(flowSummaries)) {
    summary.net = summary.total_income - summary.total_expenses;
  }

  const combined = {
    overall_income: flowSummaries.bank.total_income + flowSummaries.cash.total_income,
    overall_expenses: flowSummaries.bank.total_expenses + flowSummaries.cash.total_expenses,
    overall_net: 0,
    bank: flowSummaries.bank,
    cash: flowSummaries.cash,
  };
  combined.overall_net = combined.overall_income - combined.overall_expenses;

  return {
    bank: flowSummaries.bank,
    cash: flowSummaries.cash,
    combined,
  };
}

function emptyFlowSummary(): FlowSummary {
  return {
    income: 0,
    expenses: 0,
    investment_expense: 0,
    investment_income: 0,
    interest_earned: 0,
    service_cost: 0,
    total_income: 0,
    total_expenses: 0,
    net: 0,
    income_breakdown: {},
    expense_breakdown: {},
  };
}

function titleCase(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}
