import { signedAmount } from "../../services/personal-finance-sync-row-computation.js";
import { recomputeShareRecords, type ShareRecord } from "../../services/share-fifo-lot-matching.js";
import { deviceName } from "../app-state.js";

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

/**
 * Delete a bank transaction, then recompute `cumulative_amount` for every
 * remaining row in id order so the running total stays correct.
 */
export async function deleteBankTransaction(db: SqlExecutor, id: number): Promise<void> {
  await db.run("DELETE FROM bank_transactions WHERE id = ?", [id]);
  const rows = await db.query<{ id: number | string; amount: number }>(
    "SELECT id, amount FROM bank_transactions ORDER BY id ASC",
  );
  let cumulative = 0;
  for (const row of getValues(rows)) {
    cumulative += Number(row.amount ?? 0);
    await db.run("UPDATE bank_transactions SET cumulative_amount = ? WHERE id = ?", [cumulative, row.id]);
  }
}

/**
 * Delete a share transaction, then recompute every remaining row through the
 * shared FIFO lot-matching service and persist the derived columns (per unit
 * price, ASBA charge, total, profit/loss, cumulative profit). This keeps the
 * mobile history identical to the desktop calculation.
 */
export async function deleteShareTransaction(db: SqlExecutor, id: number): Promise<void> {
  await db.run("DELETE FROM share_transactions WHERE id = ?", [id]);
  const rows = await db.query<ShareRecord>("SELECT * FROM share_transactions ORDER BY id ASC");
  const recomputed = recomputeShareRecords(getValues(rows));
  for (const record of recomputed) {
    if (record.id == null) {
      continue;
    }
    await db.run(
      `UPDATE share_transactions
        SET per_unit_price = ?, asba_charge = ?, allotted = ?, buy_sell = ?,
            total_amount = ?, profit_loss = ?, cumulative_profit = ?
        WHERE id = ?`,
      [
        String(record.per_unit_price),
        record.asba_charge,
        record.allotted,
        record.buy_sell,
        String(record.total_amount),
        String(record.profit_loss),
        record.cumulative_profit,
        record.id,
      ],
    );
  }
}

export async function deletePersonalFinanceRecord(
  db: SqlExecutor,
  id: number,
  flowType: "bank" | "cash",
): Promise<void> {
  await db.run(`DELETE FROM ${personalFinanceTable(flowType)} WHERE id = ?`, [id]);
}

export async function deleteTransfer(db: SqlExecutor, id: number): Promise<void> {
  await db.run("DELETE FROM transfers WHERE id = ?", [id]);
}

export type BankTransactionUpdate = Partial<BankTransactionInput>;

/**
 * Update a bank transaction, then recompute `cumulative_amount` for every row
 * in id order so the running total stays correct (same math as delete).
 */
export async function updateBankTransaction(db: SqlExecutor, id: number, patch: BankTransactionUpdate): Promise<void> {
  const rows = getValues(
    await db.query<{ id: number | string; date: string; category: string; amount: number; description: string | null }>(
      "SELECT id, date, category, amount, description FROM bank_transactions ORDER BY id ASC",
    ),
  );
  const index = rows.findIndex((row) => String(row.id) === String(id));
  if (index === -1) {
    throw new Error("Bank entry not found.");
  }
  if (patch.date !== undefined) rows[index].date = patch.date;
  if (patch.category !== undefined) rows[index].category = patch.category;
  if (patch.amount !== undefined) rows[index].amount = patch.amount;
  if (patch.description !== undefined) rows[index].description = patch.description?.trim() || "";

  const now = currentTimestamp();
  let cumulative = 0;
  for (const row of rows) {
    cumulative += Number(row.amount ?? 0);
    await db.run(
      "UPDATE bank_transactions SET cumulative_amount = ?, last_updated_timestamp = ? WHERE id = ?",
      [cumulative, now, row.id],
    );
  }
  const edited = rows[index];
  await db.run(
    `UPDATE bank_transactions
      SET date = ?, category = ?, amount = ?, description = ?, updated_device = ?
      WHERE id = ?`,
    [edited.date, edited.category, edited.amount, edited.description?.trim() || null, deviceName, id],
  );
}

export type PersonalFinanceUpdate = Partial<Omit<PersonalFinanceInput, "flow_type">> & {
  direction?: "income" | "expense";
};

/** Update a personal finance row and recompute its signed_amount. */
export async function updatePersonalFinanceRecord(
  db: SqlExecutor,
  id: number,
  flowType: "bank" | "cash",
  patch: PersonalFinanceUpdate,
): Promise<void> {
  const table = personalFinanceTable(flowType);
  const rows = getValues(
    await db.query<{ id: number | string; date: string; direction: string; category: string; amount: number; description: string | null }>(
      `SELECT id, date, direction, category, amount, description FROM ${table} WHERE id = ?`,
      [id],
    ),
  );
  if (!rows.length) {
    throw new Error("Entry not found.");
  }
  const direction = patch.direction ?? (rows[0].direction as "income" | "expense");
  const amount = patch.amount ?? rows[0].amount;
  await db.run(
    `UPDATE ${table}
      SET date = ?, direction = ?, category = ?, amount = ?, signed_amount = ?,
          description = ?, last_updated_timestamp = ?, updated_device = ?
      WHERE id = ?`,
    [
      patch.date ?? rows[0].date,
      direction,
      patch.category ?? rows[0].category,
      amount,
      signedAmount(direction, amount),
      patch.description?.trim() || null,
      currentTimestamp(),
      deviceName,
      id,
    ],
  );
}

export type TransferUpdate = Partial<Omit<TransferInput, "from_flow" | "to_flow">> & {
  from_flow?: "bank" | "cash";
  to_flow?: "bank" | "cash";
};

/** Update a transfer row (amount kept unsigned). */
export async function updateTransfer(db: SqlExecutor, id: number, patch: TransferUpdate): Promise<void> {
  const rows = getValues(
    await db.query<{ id: number | string; from_flow: string; to_flow: string; date: string; amount: number; description: string | null }>(
      "SELECT id, date, from_flow, to_flow, amount, description FROM transfers WHERE id = ?",
      [id],
    ),
  );
  if (!rows.length) {
    throw new Error("Transfer not found.");
  }
  const fromFlow = patch.from_flow ?? rows[0].from_flow;
  const toFlow = patch.to_flow ?? rows[0].to_flow;
  if (fromFlow === toFlow) {
    throw new Error("Transfer flows must differ.");
  }
  await db.run(
    `UPDATE transfers
      SET date = ?, from_flow = ?, to_flow = ?, amount = ?, description = ?,
          last_updated_timestamp = ?, updated_device = ?
      WHERE id = ?`,
    [
      patch.date ?? rows[0].date,
      fromFlow,
      toFlow,
      Math.abs(patch.amount ?? rows[0].amount),
      patch.description?.trim() || null,
      currentTimestamp(),
      deviceName,
      id,
    ],
  );
}

/**
 * Rewrite every share row through the shared FIFO lot-matching service after a
 * patch, persisting the derived columns (per unit price, ASBA, total,
 * profit/loss, cumulative profit) so mobile stays identical to desktop math.
 */
async function rewriteShareRows(db: SqlExecutor, rows: ShareRecord[], updatedDevice: Record<string, string>): Promise<void> {
  const recomputed = recomputeShareRecords(rows);
  const now = currentTimestamp();
  for (const record of recomputed) {
    if (record.id == null) {
      continue;
    }
    await db.run(
      `UPDATE share_transactions
        SET date = ?, share_name = ?, category = ?, per_unit_price = ?, asba_charge = ?,
            allotted = ?, buy_sell = ?, total_amount = ?, profit_loss = ?,
            cumulative_profit = ?, last_updated_timestamp = ?, updated_device = ?
        WHERE id = ?`,
      [
        record.date,
        String(record.share_name).toUpperCase(),
        record.category,
        String(record.per_unit_price),
        record.asba_charge,
        record.allotted,
        record.buy_sell,
        String(record.total_amount),
        String(record.profit_loss),
        record.cumulative_profit,
        now,
        updatedDevice[String(record.id)] ?? deviceName,
        record.id,
      ],
    );
  }
}

export type ShareUpdate = Partial<Pick<ShareRecord, "date" | "share_name" | "category" | "per_unit_price" | "allotted" | "buy_sell">> &
  { buy_sell?: string; category?: string };

/** Update one share row and recompute the whole table (FIFO service). */
export async function updateShareTransaction(db: SqlExecutor, id: number, patch: ShareUpdate): Promise<void> {
  const rows = getValues(await db.query<ShareRecord>("SELECT * FROM share_transactions ORDER BY id ASC"));
  const index = rows.findIndex((row) => String(row.id) === String(id));
  if (index === -1) {
    throw new Error("Share entry not found.");
  }
  rows[index] = { ...rows[index], ...patch };
  const devices: Record<string, string> = {};
  for (const row of rows) {
    devices[String(row.id)] = String((row as unknown as { updated_device?: string }).updated_device ?? deviceName);
  }
  await rewriteShareRows(db, rows, devices);
}

/**
 * Update IPO allotment for a share: applies the new allotted quantity to the
 * newest IPO entry of that share and recomputes the portfolio (FIFO).
 */
export async function updateShareAllotment(db: SqlExecutor, shareName: string, allotted: number): Promise<void> {
  const target = String(shareName).trim();
  if (!target) {
    throw new Error("Share name is required.");
  }
  if (!Number.isFinite(allotted) || allotted < 0) {
    throw new Error("Allotment must be 0 or more.");
  }
  const rows = getValues(await db.query<ShareRecord>("SELECT * FROM share_transactions ORDER BY id ASC"));
  const match = rows
    .filter((row) => String(row.share_name ?? "").trim().toUpperCase() === target.toUpperCase())
    .filter((row) => String(row.category ?? "").trim().toLowerCase() === "ipo")
    .sort((a, b) => Number(b.id) - Number(a.id))[0];
  if (!match) {
    throw new Error(`No IPO entry found for ${target.toUpperCase()}.`);
  }
  match.allotted = Math.trunc(allotted);
  const devices: Record<string, string> = {};
  for (const row of rows) {
    devices[String(row.id)] = String((row as unknown as { updated_device?: string }).updated_device ?? deviceName);
  }
  await rewriteShareRows(db, rows, devices);
}

/**
 * Update SIP share quantity for a share: adjusts the newest SIP installment
 * row's allotted quantity so the total shares held equals the entered number,
 * then recomputes the portfolio.
 */
export async function updateSipQuantity(db: SqlExecutor, shareName: string, totalShares: number): Promise<void> {
  const target = String(shareName).trim();
  if (!target) {
    throw new Error("Share name is required.");
  }
  if (!Number.isFinite(totalShares) || totalShares < 0) {
    throw new Error("Total shares must be 0 or more.");
  }
  const rows = getValues(await db.query<ShareRecord>("SELECT * FROM share_transactions ORDER BY id ASC"));
  const installments = rows
    .filter((row) => String(row.share_name ?? "").trim().toUpperCase() === target.toUpperCase())
    .filter((row) => String(row.category ?? "").trim().toLowerCase() === "sip")
    .filter((row) => String(row.buy_sell ?? "").trim().toLowerCase() === "installment")
    .sort((a, b) => Number(a.id) - Number(b.id));
  if (!installments.length) {
    throw new Error(`No SIP installment found for ${target.toUpperCase()}.`);
  }
  const current = installments.reduce((sum, row) => sum + Math.trunc(Number(row.allotted ?? 0)), 0);
  const desired = Math.trunc(totalShares);
  const delta = desired - current;
  const last = installments[installments.length - 1];
  const targetRow = rows[rows.findIndex((row) => String(row.id) === String(last.id))];
  const revised = Math.max(0, Math.trunc(Number(targetRow.allotted ?? 0)) + delta);
  if (revised !== Math.trunc(Number(targetRow.allotted ?? 0)) + delta) {
    throw new Error(`Cannot reduce below the current ${current} shares.`);
  }
  targetRow.allotted = revised;
  const devices: Record<string, string> = {};
  for (const row of rows) {
    devices[String(row.id)] = String((row as unknown as { updated_device?: string }).updated_device ?? deviceName);
  }
  await rewriteShareRows(db, rows, devices);
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
