import { settingsSubScreen } from "./layout.js";

export function settingsPrivacyScreen(): string {
  return settingsSubScreen(
    "Privacy",
    `<section class="card">
      <h3>Device storage</h3>
      <p class="sub">FinLedge Mobile keeps records in local SQLite on this device. No live bank-flow sync is enabled in mobile-v1.0.0.</p>
    </section>`,
  );
}