/**
 * Runtime data-storage mode, mirroring the desktop backend's `path_utils.py`
 * (FINLEDGE_MODE / FINLEDGE_DATA_DIR pattern).
 *
 * Resolution priority:
 *   1. `VITE_FINLEDGE_MODE` build-time override (mobile/.env), e.g. `production`
 *      for real releases.
 *   2. Default `development` — so a mistake never writes to production data.
 *
 * Development keeps a SEPARATE database name and a SEPARATE FinLedge folder
 * (both suffixed with "Dev") so testing on a real phone never touches the
 * production data set.
 */

export type FinledgeMode = "development" | "production";

function readMode(): FinledgeMode {
  // `import.meta.env` only exists under Vite; fall back when running under
  // plain Node (tests), where undefined is treated as development.
  const env: Record<string, unknown> =
    typeof import.meta !== "undefined" && typeof (import.meta as { env?: unknown }).env === "object"
      ? (import.meta as { env: Record<string, unknown> }).env
      : {};
  const raw = String(env.VITE_FINLEDGE_MODE ?? "").trim().toLowerCase();
  return raw === "production" ? "production" : "development";
}

export const finledgeMode: FinledgeMode = readMode();

/** The SQLite database file name (mode-scoped so dev never collides with prod). */
export const databaseName =
  finledgeMode === "production" ? "finledge_mobile" : "finledge_mobile_dev";

/** Root FinLedge managed folder (inside the app-private Data directory). */
export const finledgeRootFolder = finledgeMode === "production" ? "FinLedge" : "FinLedgeDev";

/** Sub-folder holding the everyday save file (the "database" folder). */
export const FINLEDGE_DATABASE_SUBDIR = "database";

/** Sub-folder holding the daily incremental backups (the "backup" folder). */
export const FINLEDGE_BACKUP_SUBDIR = "backup";

export const DATABASE_VERSION = 1;