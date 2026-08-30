export function settingsPrivacyScreen(): string {
  return `
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Privacy</h1>
    <section class="card">
      <h3>Device storage</h3>
      <p class="sub">FinLedge Mobile keeps records in local SQLite on this device. No live bank-flow sync is enabled in mobile-v1.0.0.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `;
}
