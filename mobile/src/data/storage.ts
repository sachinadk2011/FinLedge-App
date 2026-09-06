/**
 * FinLedge on-device storage management (mirrors the desktop's backup-then-
 * replace pattern, dev-vs-prod data dir separation).
 *
 * Layout (inside the app-private `Data` directory so no storage permissions
 * are needed on any Android version):
 *
 *   <Data>/FinLedgeDev|FinLedge/
 *     database/  finledge_save.json   <- everyday aggregate save of all tables
 *     backup/    YYYY-MM-DD.json      <- one file per day, containing ONLY the
 *                                        rows not yet backed up (incremental)
 *
 * The live source of truth stays in on-device SQLite; the database folder
 * keeps the durable aggregate save, and the backup folder keeps the daily
 * incremental growth — exactly one backup per day, written lazily the first
 * time the app is opened that day.
 */

import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

import {
  databaseName,
  FINLEDGE_BACKUP_SUBDIR,
  FINLEDGE_DATABASE_SUBDIR,
  finledgeMode,
  finledgeRootFolder,
} from "../config.js";
import { TABLE_NAMES } from "./schema.js";
import { listRows, type SqlExecutor } from "./repositories.js";

const BASE_DIRECTORY = Directory.Data;

export const FULL_SAVE_NAME = "finledge_save.json";

const CURSORS_KEY = "finledge.backup.cursors";
const LAST_RUN_KEY = "finledge.backup.lastRun";

export type StorageInfo = {
  mode: string;
  databaseName: string;
  rootFolder: string;
  databaseFolder: string;
  backupFolder: string;
  fullSavePath: string;
  hasFullSave: boolean;
  lastBackupDate: string | null;
  lastBackupAt: string | null;
  backupFiles: string[];
  lastError: string | null;
};

export type BackupRun = {
  status: "done" | "skipped" | "error";
  date: string;
  newRows: number;
  error?: string;
};

type TableCursor = { id: number; at: string };
type LastRun = { date: string; at: string };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCursorMap(): Record<string, TableCursor> {
  try {
    return JSON.parse(window.localStorage.getItem(CURSORS_KEY) ?? "{}") as Record<string, TableCursor>;
  } catch {
    return {};
  }
}

function readLastRun(): LastRun {
  try {
    return JSON.parse(window.localStorage.getItem(LAST_RUN_KEY) ?? "{}") as LastRun;
  } catch {
    return { date: "", at: "" };
  }
}

let lastStorageInfo: StorageInfo | null = null;

export function getStorageInfoSnapshot(): StorageInfo | null {
  return lastStorageInfo;
}

/** Create the FinLedge root + database + backup folders. */
export async function ensureFinledgeFolders(): Promise<void> {
  await Filesystem.mkdir({ path: finledgeRootFolder, directory: BASE_DIRECTORY, recursive: true });
  await Filesystem.mkdir({
    path: `${finledgeRootFolder}/${FINLEDGE_DATABASE_SUBDIR}`,
    directory: BASE_DIRECTORY,
    recursive: true,
  });
  await Filesystem.mkdir({
    path: `${finledgeRootFolder}/${FINLEDGE_BACKUP_SUBDIR}`,
    directory: BASE_DIRECTORY,
    recursive: true,
  });
}

/** Write the everyday aggregate save file (every table) into the database folder. */
export async function writeFinledgeSave(db: SqlExecutor): Promise<void> {
  await ensureFinledgeFolders();
  const payload: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    database: databaseName,
  };
  for (const table of TABLE_NAMES) {
    payload[table] = await listRows(db, table);
  }
  await Filesystem.writeFile({
    path: `${finledgeRootFolder}/${FINLEDGE_DATABASE_SUBDIR}/${FULL_SAVE_NAME}`,
    directory: BASE_DIRECTORY,
    data: JSON.stringify(payload),
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

/**
 * Daily incremental backup: once per day, write ONLY the rows that have not
 * been backed up yet (id above the last backup cursor, or updated after the
 * last backup run) into backup/<date>.json.
 */
export async function runDailyIncrementalBackup(db: SqlExecutor): Promise<BackupRun> {
  const date = todayKey();
  const lastRun = readLastRun();
  if (lastRun.date === date) {
    return { status: "skipped", date, newRows: 0 };
  }

  try {
    await ensureFinledgeFolders();
    const cursors = readCursorMap();
    const at = new Date().toISOString().slice(0, 19);
    const tables: Record<string, unknown[]> = {};
    let newRows = 0;

    for (const table of TABLE_NAMES) {
      const cursor = cursors[table] ?? { id: 0, at: "" };
      const result = await db.query(
        `SELECT * FROM ${table} WHERE id > ? OR last_updated_timestamp > ?`,
        [cursor.id, cursor.at],
      );
      const values = Array.isArray(result.values) ? result.values : [];
      if (values.length) {
        tables[table] = values;
        newRows += values.length;
        const maxId = Math.max(0, ...values.map((row) => Number((row as { id?: unknown }).id ?? 0)));
        cursors[table] = { id: Math.max(cursor.id, maxId), at };
      }
    }

    if (Object.keys(tables).length) {
      await Filesystem.writeFile({
        path: `${finledgeRootFolder}/${FINLEDGE_BACKUP_SUBDIR}/${date}.json`,
        directory: BASE_DIRECTORY,
        data: JSON.stringify({
          generatedAt: new Date().toISOString(),
          mode: finledgeMode,
          database: databaseName,
          backupOfDate: date,
          tables,
        }),
        encoding: Encoding.UTF8,
        recursive: true,
      });
      window.localStorage.setItem(CURSORS_KEY, JSON.stringify(cursors));
    }

    window.localStorage.setItem(LAST_RUN_KEY, JSON.stringify({ date, at }));
    return { status: "done", date, newRows };
  } catch (error) {
    return {
      status: "error",
      date,
      newRows: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Run folders + full save + daily incremental backup together. */
export async function runStorageMaintenance(
  db: SqlExecutor,
): Promise<{ saved: boolean; backup: BackupRun }> {
  let saved = false;
  try {
    await writeFinledgeSave(db);
    saved = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[storage] full save failed", message);
  }
  const backup = await runDailyIncrementalBackup(db);
  await refreshStorageInfo().catch(() => {});
  return { saved, backup };
}

/** Recompute + cache the storage info snapshot shown in Settings > Backup & sync. */
export async function refreshStorageInfo(): Promise<StorageInfo> {
  await ensureFinledgeFolders();
  const databaseFolder = `${finledgeRootFolder}/${FINLEDGE_DATABASE_SUBDIR}`;
  const backupFolder = `${finledgeRootFolder}/${FINLEDGE_BACKUP_SUBDIR}`;
  const fullSavePath = `${databaseFolder}/${FULL_SAVE_NAME}`;

  let hasFullSave = false;
  try {
    await Filesystem.stat({ path: fullSavePath, directory: BASE_DIRECTORY });
    hasFullSave = true;
  } catch {
    /* not written yet */
  }

  let backupFiles: string[] = [];
  try {
    const listing = await Filesystem.readdir({ path: backupFolder, directory: BASE_DIRECTORY });
    backupFiles = (listing.files ?? [])
      .map((file) => file.name)
      .filter((name) => name.endsWith(".json"))
      .sort();
  } catch {
    /* folder not ready yet */
  }

  const lastRun = readLastRun();
  lastStorageInfo = {
    mode: finledgeMode,
    databaseName,
    rootFolder: finledgeRootFolder,
    databaseFolder,
    backupFolder,
    fullSavePath,
    hasFullSave,
    lastBackupDate: lastRun.date || null,
    lastBackupAt: lastRun.at || null,
    backupFiles,
    lastError: null,
  };
  return lastStorageInfo;
}