import { insertBankTransaction, insertPersonalFinanceRecord, insertShareTransaction, type SqlExecutor } from "../src/data/repositories.js";
import { deviceName } from "../src/app-state.js";
import type { StagedEntry } from "./keep-notes-parser.js";

/**
 * Keep Notes commit path (keepNotesImport.md §6).
 *
 * Every confirmed staged row is written through the SAME repository/service
 * layer used by manual entries — never raw SQL bypassing the layer. This
 * carries the service-layer validation/computation and stamps the standard
 * timestamps + `updated_device` columns automatically.
 *
 * A row is only written here if it is confirmed (not flagged-pending). Flagged
 * rows must be resolved (edited or explicitly confirmed) in the review screen
 * before commit.
 */

export type CommitReport = {
  written: number;
  skipped: string[];
};

/** Write the confirmed staged entries via the repository layer. */
export async function commitKeepNotes(db: SqlExecutor, entries: StagedEntry[]): Promise<CommitReport> {
  const confirmationGate = (entry: StagedEntry): boolean =>
    !entry.flags.some((f) => f.kind === "ambiguous" || f.kind === "checksum");
  const report: CommitReport = { written: 0, skipped: [] };

  for (const entry of entries) {
    if (!confirmationGate(entry)) {
      report.skipped.push(`${entry.label || entry.description || "(untitled)"} — needs review before commit`);
      continue;
    }
    await writeEntry(db, entry);
    report.written += 1;
  }
  return report;
}

async function writeEntry(db: SqlExecutor, entry: StagedEntry): Promise<void> {
  const description = entry.description || entry.label || null;

  switch (entry.module) {
    case "bank":
      await insertBankTransaction(db, {
        date: entry.date,
        category: entry.category || "Other Charges",
        amount: entry.direction === "income" ? entry.amount : -entry.amount,
        description,
        updated_device: deviceName,
      });
      return;
    case "share":
      // Share records require a price + quantity; a bulk capture defaults to a
      // single-lot purchase of `allotted=1`, so the total reflects the import
      // amount. Users refine quantity/price in the review screen's edit when
      // the source note carried that detail.
      await insertShareTransaction(db, {
        date: entry.date,
        share_name: entry.label || description || "UNKNOWN",
        category: "ipo",
        per_unit_price: entry.amount,
        allotted: 1,
        buy_sell: "ipo",
        total_amount: entry.amount,
        updated_device: deviceName,
      });
      return;
    case "personal":
    default:
      await insertPersonalFinanceRecord(db, {
        date: entry.date,
        flow_type: entry.flow,
        direction: entry.direction,
        category: entry.category || "Other",
        amount: entry.amount,
        description,
        source: "manual",
        updated_device: deviceName,
      });
      return;
  }
}