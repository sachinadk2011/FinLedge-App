import { getStorageInfoSnapshot } from "../../data/storage.js";
import { escapeHtml } from "../../utils/html.js";
import { settingsSubScreen } from "./layout.js";

export function settingsBackupSyncScreen(): string {
  const info = getStorageInfoSnapshot();

  const storageCard = info
    ? `<section class="card">
      <h3>Storage</h3>
      <p class="sub">Everything stays on this device — no account needed.</p>
      <div class="field"><label>Database</label><input type="text" value="${escapeHtml(info.databaseName)}" readonly></div>
      <div class="field"><label>Folder (app-private)</label><input type="text" value="${escapeHtml(info.rootFolder)}" readonly></div>
      <div class="field"><label>Database folder</label><input type="text" value="${escapeHtml(info.databaseFolder)}" readonly></div>
      <div class="field"><label>Backup folder</label><input type="text" value="${escapeHtml(info.backupFolder)}" readonly></div>
      <div class="field"><label>Aggregate save</label><input type="text" value="${escapeHtml(info.fullSavePath)} (${info.hasFullSave ? "written" : "pending"})" readonly></div>
      <div class="field"><label>Backup files</label><input type="text" value="${escapeHtml(info.backupFiles.length ? info.backupFiles.join(", ") : "none yet")}" readonly></div>
      <div class="field"><label>Last backup</label><input type="text" value="${escapeHtml(info.lastBackupDate ? `${info.lastBackupDate} at ${info.lastBackupAt ?? "?"}` : "not run yet")}" readonly></div>
      <button class="btn-primary" data-backup-now>Run backup now</button>
    </section>`
    : `<section class="card">
      <h3>Storage</h3>
      <p class="sub">Storage info will appear here once the app has opened the database.</p>
    </section>`;

  return settingsSubScreen(
    "Backup & sync",
    `
    <section class="card">
      <h3>Local first</h3>
      <p class="sub">Mobile data lives in on-device SQLite. A daily incremental backup is written to the backup folder on first open of each day — full save, then only the new rows since the last backup.</p>
    </section>
    ${storageCard}
    `,
  );
}