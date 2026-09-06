/**
 * Demo-data facade.
 *
 * These names were previously the static demo arrays. They now re-export the
 * LIVE, SQLite-backed store arrays (see `./store.ts`), so every screen reads
 * current data automatically. The demo rows themselves are only inserted once
 * into a brand-new development database.
 */

export { bankRecords, manualExpenseRows, shareRecords, transferRows } from "./store.js";