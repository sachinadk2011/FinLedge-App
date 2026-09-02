import { settingsSubScreen } from "./layout.js";

export function settingsBackupSyncScreen(): string {
  return settingsSubScreen(
    "Backup & sync",
    `<section class="card">
      <h3>Local first</h3>
      <p class="sub">Mobile data is stored in on-device SQLite. Drive sync ships only in its own future phase.</p>
    </section>`,
  );
}