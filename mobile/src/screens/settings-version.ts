import { appVersionLabel } from "../app-state.js";

export function settingsVersionScreen(): string {
  return `
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Version</h1>
    <section class="card settings-panel">
      <div class="settings-version-row"><span>Mobile version</span><b>${appVersionLabel}</b></div>
      <div class="settings-version-row"><span>Mobile release tags</span><b>mobile-vX.Y.Z</b></div>
      <div class="settings-version-row"><span>Desktop release tags</span><b>desktop-vX.Y.Z</b></div>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `;
}
