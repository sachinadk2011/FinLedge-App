import { signedAmount } from "../../services/personal-finance-sync-row-computation.js";
import { recomputeShareRecords, type ShareRecord } from "../../services/share-fifo-lot-matching.js";

export type SqlValue = string | number | null;

export type SqlExecutor = {
  run(statement: string, values?: SqlValue[]): Promise<unknown>;
  query<T = Record<string, unknown>>(statement: string, values?: SqlValue[]): Promise<{ values?: T[] }>;
};

export type BankTransactionInput = {
  date: string;
  category: string;
  amount: number;
  description?: string | null;
  updated_device: string;
};

export type PersonalFinanceInput = {
  date: string;
  flow_type: "bank" | "cash";
  direction: "income" | "expense";
  category: string;
  amount: number;
  description?: string | null;
  source?: "manual";
  updated_device: string;
};

export type TransferInput = {
  date: string;
  from_flow: "bank" | "cash";
  to_flow: "bank" | "cash";
  amount: number;
  description?: string | null;
  updated_device: string;
};

export async function insertBankTransaction(db: SqlExecutor, input: BankTransactionInput): Promise<void> {
  const previous = await db.query<{ cumulative_amount: number }>(
    "SELECT cumulative_amount FROM bank_transactions ORDER BY id DESC LIMIT 1",
  );
  const previousCumulative = Number(previous.values?.[0]?.cumulative_amount ?? 0);
  const now = currentTimestamp();
  await db.run(
    `INSERT INTO bank_transactions
      (date, category, amount, cumulative_amount, description, created_timestamp, last_updated_timestamp, updated_device)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.date,
      input.category,
      input.amount,
      previousCumulative + input.amount,
      input.description?.trim() || null,
      now,
      now,
      input.updated_device,
    ],
  );
}

export async function insertShareTransaction(db: SqlExecutor, input: ShareRecord & { updated_device: string }): Promise<void> {
  const rows = await db.query<ShareRecord>("SELECT * FROM share_transactions ORDER BY id ASC");
  const recomputed = recomputeShareRecords([...getValues(rows), input]);
  const computed = recomputed[recomputed.length - 1];
  const now = currentTimestamp();
  await db.run(
    `INSERT INTO share_transactions
      (date, share_name, category, per_unit_price, asba_charge, allotted, buy_sell, total_amount, profit_loss, cumulative_profit, created_timestamp, last_updated_timestamp, updated_device)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      computed.date,
      String(computed.share_name).toUpperCase(),
      computed.category,
      String(computed.per_unit_price),
      computed.asba_charge,
      computed.allotted,
      computed.buy_sell,
      String(computed.total_amount),
      String(computed.profit_loss),
      computed.cumulative_profit,
      now,
      now,
      input.updated_device,
    ],
  );
}

export async function insertPersonalFinanceRecord(db: SqlExecutor, input: PersonalFinanceInput): Promise<void> {
  const table = personalFinanceTable(input.flow_type);
  const now = currentTimestamp();
  await db.run(
    `INSERT INTO ${table}
      (date, flow_type, direction, category, amount, signed_amount, description, source, created_timestamp, last_updated_timestamp, source_ref, updated_device)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.date,
      input.flow_type,
      input.direction,
      input.category,
      input.amount,
      signedAmount(input.direction, input.amount),
      input.description?.trim() || null,
      input.source ?? "manual",
      now,
      now,
      null,
      input.updated_device,
    ],
  );
}

export async function insertTransfer(db: SqlExecutor, input: TransferInput): Promise<void> {
  if (input.from_flow === input.to_flow) {
    throw new Error("Transfer flows must differ.");
  }

  const now = currentTimestamp();
  await db.run(
    `INSERT INTO transfers
      (date, from_flow, to_flow, amount, description, created_timestamp, last_updated_timestamp, updated_device)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.date,
      input.from_flow,
      input.to_flow,
      Math.abs(input.amount),
      input.description?.trim() || null,
      now,
      now,
      input.updated_device,
    ],
  );
}

export async function listRows<T>(db: SqlExecutor, table: string): Promise<T[]> {
  const result = await db.query<T>(`SELECT * FROM ${table} ORDER BY id ASC`);
  return getValues(result);
}

function personalFinanceTable(flowType: "bank" | "cash"): string {
  return flowType === "bank" ? "personal_finance_bank_flow" : "personal_finance_cash_flow";
}

function getValues<T>(result: { values?: T[] }): T[] {
  return Array.isArray(result.values) ? result.values : [];
}

function currentTimestamp(): string {
  return new Date().toISOString().slice(0, 19);
}
