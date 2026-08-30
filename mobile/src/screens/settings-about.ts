export function settingsAboutScreen(): string {
  return `
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">About FinLedge Mobile</h1>
    <section class="card settings-panel">
      <p class="sub">FinLedge Mobile is a Capacitor-wrapped Android app backed by on-device SQLite. It keeps day-to-day Bank Flow and Cash Flow tracking on the phone, with module dashboards matching desktop calculations where those modules overlap.</p>
      <p class="sub">The desktop app stores local Excel workbooks; the mobile app stores SQLite rows and will export/import compatible Excel files in its own phase.</p>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `;
}
