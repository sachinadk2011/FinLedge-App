import { appVersionLabel } from "../../app-state.js";
import { escapeHtml } from "../../utils/html.js";
import { settingsSubScreen } from "./layout.js";

export function settingsVersionScreen(): string {
  return settingsSubScreen(
    "Version",
    `<section class="card settings-panel">
      <div class="settings-version-row"><span>Mobile version</span><b>${escapeHtml(appVersionLabel)}</b></div>
      <div class="settings-version-row"><span>Mobile release tags</span><b>mobile-vX.Y.Z</b></div>
      <div class="settings-version-row"><span>Desktop release tags</span><b>desktop-vX.Y.Z</b></div>
    </section>`,
  );
}