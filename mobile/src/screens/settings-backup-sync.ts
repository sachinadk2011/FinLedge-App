export function settingsBackupSyncScreen(): string {
  return `
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Backup & sync</h1>
    <section class="card">
      <h3>Local first</h3>
      <p class="sub">Mobile data is stored in on-device SQLite. Drive sync ships only in its own future phase.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `;
}
