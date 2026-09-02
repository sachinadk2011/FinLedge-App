import { getProfileName } from "../../app-state.js";
import { escapeAttr } from "../../utils/html.js";
import { settingsSubScreen } from "./layout.js";

export function settingsProfileScreen(): string {
  const name = getProfileName();
  return settingsSubScreen(
    "Profile",
    `<section class="card settings-panel">
      <div class="section-title"><h3>Name on this phone</h3><span class="settings-pill">${name || "Not set"}</span></div>
      <form class="profile-form" data-profile-form>
        <input name="profileName" type="text" value="${escapeAttr(name)}" placeholder="Your name" autocomplete="name">
        <button class="btn-primary" type="submit">Save profile</button>
      </form>
    </section>`,
  );
}