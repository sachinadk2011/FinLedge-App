import { databaseName, DATABASE_VERSION } from "../config.js";

/** Mode-scoped SQLite database name (dev and prod use separate files). */
export const DATABASE_NAME = databaseName;
export { DATABASE_VERSION };

export const TABLE_NAMES = [
  "bank_transactions",
  "share_transactions",
  "personal_finance_bank_flow",
  "personal_finance_cash_flow",
  "transfers",
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

export const CREATE_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    cumulative_amount REAL NOT NULL,
    description TEXT,
    created_timestamp TEXT NOT NULL,
    last_updated_timestamp TEXT NOT NULL,
    updated_device TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS share_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    share_name TEXT NOT NULL,
    category TEXT NOT NULL,
    per_unit_price TEXT NOT NULL,
    asba_charge REAL NOT NULL,
    allotted INTEGER NOT NULL,
    buy_sell TEXT NOT NULL,
    total_amount TEXT NOT NULL,
    profit_loss TEXT NOT NULL,
    cumulative_profit REAL NOT NULL,
    created_timestamp TEXT NOT NULL,
    last_updated_timestamp TEXT NOT NULL,
    updated_device TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS personal_finance_bank_flow (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    flow_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    signed_amount REAL NOT NULL,
    description TEXT,
    source TEXT NOT NULL,
    created_timestamp TEXT NOT NULL,
    last_updated_timestamp TEXT NOT NULL,
    source_ref TEXT,
    updated_device TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS personal_finance_cash_flow (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    flow_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    signed_amount REAL NOT NULL,
    description TEXT,
    source TEXT NOT NULL,
    created_timestamp TEXT NOT NULL,
    last_updated_timestamp TEXT NOT NULL,
    source_ref TEXT,
    updated_device TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    from_flow TEXT NOT NULL CHECK (from_flow IN ('bank', 'cash')),
    to_flow TEXT NOT NULL CHECK (to_flow IN ('bank', 'cash')),
    amount REAL NOT NULL CHECK (amount > 0),
    description TEXT,
    created_timestamp TEXT NOT NULL,
    last_updated_timestamp TEXT NOT NULL,
    updated_device TEXT NOT NULL,
    CHECK (from_flow <> to_flow)
  );`,
] as const;
