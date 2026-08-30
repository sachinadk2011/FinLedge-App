import { getProfileName } from "../app-state.js";

export function settingsProfileScreen(): string {
  const name = getProfileName();
  return `
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Profile</h1>
    <section class="card settings-panel">
      <div class="section-title"><h3>Name on this phone</h3><span class="settings-pill">${name || "Not set"}</span></div>
      <form class="profile-form" data-profile-form>
        <input name="profileName" type="text" value="${name}" placeholder="Your name" autocomplete="name">
        <button class="btn-primary" type="submit">Save profile</button>
      </form>
    </section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `;
}
