/**
 * Live, SQLite-backed data store.
 *
 * Every screen reads from the module-level arrays exported here (via the
 * `demo-data.js` facade). After any mutation the array contents are replaced
 * in place so already-imported references always reflect the current database.
 *
 * The store mirrors the desktop backend's layout:
 *   - reads are always from the on-device SQLite database
 *   - the dev database is seeded with demo rows only on first open (dev mode),
 *     production starts clean
 *   - every insert/delete goes through the same repository layer the
 *     Keep Notes import uses, so calculated values (bank cumulative, share
 *     FIFO profit/loss) stay identical to the desktop
 */

import { toNumber } from "../../services/bank-category-totals.js";
import type { BankRecord } from "../../services/bank-category-totals.js";
import type { PersonalFinanceRecord } from "../../services/personal-finance-sync-row-computation.js";
import {
  recomputeShareRecords,
  type ShareRecord,
} from "../../services/share-fifo-lot-matching.js";
import { deviceName } from "../app-state.js";
import { finledgeMode } from "../config.js";
import { TABLE_NAMES } from "./schema.js";
import { openMobileDatabase } from "./sqlite.js";
import {
  insertBankTransaction,
  insertPersonalFinanceRecord,
  insertShareTransaction,
  insertTransfer,
  listRows,
  type SqlExecutor,
} from "./repositories.js";

export type TransferRow = {
  id?: number | string;
  date?: string | null;
  from_flow?: string | null;
  to_flow?: string | null;
  amount?: number | string | null;
  description?: string | null;
};

type DbRow = Record<string, unknown>;

/** Live arrays — imported by screens through the `demo-data.js` facade. */
export const bankRecords: BankRecord[] = [];
export const shareRecords: ShareRecord[] = [];
export const manualExpenseRows: PersonalFinanceRecord[] = [];
export const transferRows: TransferRow[] = [];

/** True once the store has been populated (from DB or demo fallback). */
export let storeReady = false;

/** True when the store is backed by the real on-device SQLite database. */
export let dbAvailable = false;

type SeedBank = { date: string; category: string; amount: number; description: string | null };
type SeedShare = {
  date: string;
  share_name: string;
  category: string;
  per_unit_price: number;
  allotted: number;
  buy_sell: string;
  total_amount: number;
};
type SeedPersonal = {
  date: string;
  flow_type: "bank" | "cash";
  direction: "income" | "expense";
  category: string;
  amount: number;
  description: string | null;
};
type SeedTransfer = {
  date: string;
  from_flow: "bank" | "cash";
  to_flow: "bank" | "cash";
  amount: number;
  description: string | null;
};

function buildDemoSeed(): {
  bank: SeedBank[];
  shares: SeedShare[];
  personal: SeedPersonal[];
  transfers: SeedTransfer[];
} {
  return {
    bank: [
      { date: "2026-08-01", category: "Interest Earned", amount: 820, description: "Savings" },
      { date: "2026-08-04", category: "Mobile Banking Charge", amount: -25, description: "Monthly" },
      { date: "2026-08-10", category: "Demat Renewal", amount: -150, description: "Renewal" },
    ],
    shares: [
      { date: "2026-08-03", share_name: "NABIL", category: "ipo", per_unit_price: 100, allotted: 10, buy_sell: "ipo", total_amount: 1000 },
      { date: "2026-08-06", share_name: "NABIL", category: "sell", per_unit_price: 160, allotted: 4, buy_sell: "sell", total_amount: 640 },
      { date: "2026-08-07", share_name: "NIBL", category: "sip", per_unit_price: 1000, allotted: 20, buy_sell: "installment", total_amount: 1000 },
    ],
    personal: [
      { date: "2026-08-20", flow_type: "cash", direction: "expense", category: "Food", amount: 560, description: "Grocery top-up" },
      { date: "2026-08-01", flow_type: "bank", direction: "income", category: "Salary", amount: 45000, description: "Salary" },
      { date: "2026-08-18", flow_type: "cash", direction: "expense", category: "Entertainment", amount: 900, description: "Movie night" },
    ],
    transfers: [{ date: "2026-08-22", from_flow: "cash", to_flow: "bank", amount: 2000, description: "Deposit" }],
  };
}

async function seedDatabase(db: SqlExecutor): Promise<void> {
  const seed = buildDemoSeed();
  for (const row of seed.bank) {
    await insertBankTransaction(db, { ...row, updated_device: deviceName });
  }
  for (const row of seed.shares) {
    await insertShareTransaction(db, { ...row, updated_device: deviceName });
  }
  for (const row of seed.personal) {
    await insertPersonalFinanceRecord(db, { ...row, source: "manual", updated_device: deviceName });
  }
  for (const row of seed.transfers) {
    await insertTransfer(db, { ...row, updated_device: deviceName });
  }
}

async function countRows(db: SqlExecutor): Promise<number> {
  let total = 0;
  for (const table of TABLE_NAMES) {
    const result = await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
    total += Number(result.values?.[0]?.n ?? 0);
  }
  return total;
}

function replaceInPlace<T>(target: T[], next: T[]): void {
  target.splice(0, target.length, ...next);
}

function rowId(row: DbRow): string | number | undefined {
  const id = row.id;
  return typeof id === "string" || typeof id === "number" ? id : undefined;
}

function mapBank(row: DbRow): BankRecord {
  return {
    id: rowId(row),
    date: String(row.date ?? ""),
    category: row.category == null ? null : String(row.category),
    amount: toNumber(row.amount),
    description: row.description == null ? null : String(row.description),
    timestamp: row.created_timestamp == null ? null : String(row.created_timestamp),
  };
}

function mapShare(row: DbRow): ShareRecord {
  return {
    id: rowId(row),
    date: String(row.date ?? ""),
    share_name: row.share_name == null ? null : String(row.share_name),
    category: row.category == null ? null : String(row.category),
    per_unit_price: toNumber(row.per_unit_price),
    asba_charge: toNumber(row.asba_charge),
    allotted: toNumber(row.allotted),
    buy_sell: row.buy_sell == null ? null : String(row.buy_sell),
    total_amount: toNumber(row.total_amount),
    profit_loss: toNumber(row.profit_loss),
    cumulative_profit: toNumber(row.cumulative_profit),
    timestamp: row.created_timestamp == null ? null : String(row.created_timestamp),
  };
}

function mapPersonal(flow: "bank" | "cash", row: DbRow): PersonalFinanceRecord {
  const amount = toNumber(row.amount);
  const direction = String(row.direction ?? "expense").toLowerCase();
  return {
    id: rowId(row),
    display_id: `${flow === "bank" ? "B" : "C"}-${String(row.id ?? "")}`,
    date: String(row.date ?? ""),
    flow_type: flow,
    direction,
    category: row.category == null ? null : String(row.category),
    amount,
    signed_amount: toNumber(row.signed_amount),
    description: row.description == null ? null : String(row.description),
    source: "manual",
    timestamp: row.created_timestamp == null ? null : String(row.created_timestamp),
  };
}

function mapTransfer(row: DbRow): TransferRow {
  return {
    id: rowId(row),
    date: String(row.date ?? ""),
    from_flow: row.from_flow == null ? null : String(row.from_flow),
    to_flow: row.to_flow == null ? null : String(row.to_flow),
    amount: toNumber(row.amount),
    description: row.description == null ? null : String(row.description),
  };
}

function resultValues<T = DbRow>(result: { values?: T[] }): T[] {
  return Array.isArray(result.values) ? result.values : [];
}

/**
 * Reload every table from SQLite into the live arrays.
 * Safe to call any time; the shared array references are preserved.
 */
export async function reloadStore(): Promise<void> {
  const db = await openMobileDatabase();
  const [bank, shares, pfBank, pfCash, transfers] = await Promise.all([
    listRows<DbRow>(db, "bank_transactions"),
    listRows<DbRow>(db, "share_transactions"),
    listRows<DbRow>(db, "personal_finance_bank_flow"),
    listRows<DbRow>(db, "personal_finance_cash_flow"),
    listRows<DbRow>(db, "transfers"),
  ]);
  replaceInPlace(bankRecords, bank.map(mapBank));
  replaceInPlace(shareRecords, shares.map(mapShare));
  replaceInPlace(manualExpenseRows, [...pfBank.map((row) => mapPersonal("bank", row)), ...pfCash.map((row) => mapPersonal("cash", row))]);
  replaceInPlace(transferRows, transfers.map(mapTransfer));
  dbAvailable = true;
  storeReady = true;
}

/**
 * Open the database, seed demo rows on the first ever open (dev only), and
 * hydrate the live store. Throws if SQLite is unavailable.
 */
export async function hydrateStore(options: { seedIfEmpty?: boolean } = {}): Promise<void> {
  const db = await openMobileDatabase();
  if (options.seedIfEmpty) {
    const total = await countRows(db);
    if (total === 0 && finledgeMode === "development") {
      await seedDatabase(db);
    }
  }
  await reloadStore();
}

/**
 * Browser/dev fallback: fill the live arrays with the same demo seed without a
 * database. Mutations are then unavailable (dbAvailable stays false).
 */
export async function hydrateDemoStore(): Promise<void> {
  const seed = buildDemoSeed();
  replaceInPlace(
    bankRecords,
    seed.bank.map((row) => ({ id: undefined, ...row })),
  );
  replaceInPlace(shareRecords, recomputeShareRecords(seed.shares));
  replaceInPlace(
    manualExpenseRows,
    seed.personal.map((row) => ({
      id: undefined,
      display_id: `${row.flow_type === "bank" ? "B" : "C"}-demo`,
      flow_type: row.flow_type,
      direction: row.direction,
      category: row.category,
      amount: row.amount,
      signed_amount: row.direction === "income" ? row.amount : -row.amount,
      description: row.description,
      source: "manual",
      timestamp: `${row.date}T00:00:00`,
    })),
  );
  replaceInPlace(transferRows, seed.transfers.map((row) => ({ id: undefined, ...row })));
  dbAvailable = false;
  storeReady = true;
}