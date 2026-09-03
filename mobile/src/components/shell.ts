import { appState, appVersionLabel, deviceName, getProfileName, greeting, profileInitial } from "../app-state.js";
import type { ScreenId } from "../types.js";
import { escapeHtml } from "../utils/html.js";

export function screen(id: ScreenId, body: string): string {
  return `<main class="screen ${appState.activeScreen === id ? "active" : ""}" data-screen="${id}">${body}</main>`;
}

export function topbar(): string {
  const name = getProfileName();
  return `
    <header class="topbar">
      <button class="icon-btn" data-open-drawer aria-label="Open navigation"><span class="hamburger-lines"></span></button>
      <div class="brand brand-centered brand-logo" data-nav="home" style="cursor:pointer;" title="Go to Home">
        <img class="brand-logo-img" src="./icon.png" alt="FinLedge logo">
        <div class="brand-text"><b>FinLedge</b><span>${greeting()}${name ? `, ${escapeHtml(name)}` : ""}</span></div>
      </div>
      <button class="avatar" data-nav="settings" aria-label="Open profile">${profileInitial()}</button>
    </header>
  `;
}

export function drawer(): string {
  const items: Array<[ScreenId, string, string, ScreenId[]]> = [
    ["home", "Home", "🏠", ["home"]],
    ["bank-add", "Bank Services", "🏦", ["bank-add", "bank-dash"]],
    ["shares-add", "Share Portfolio", "📈", ["shares-add", "shares-dash"]],
    ["expenses-add", "Personal Expenses", "💳", ["expenses-add", "expenses-dash", "transfer"]],
    ["summary", "Financial Summary", "📊", ["summary"]],
    ["settings", "Settings", "⚙", ["settings", "settings-profile", "settings-import-export", "settings-investment", "settings-backup-sync", "settings-privacy", "settings-about", "settings-how-to-use", "settings-version", "import-paste", "import-review"]],
  ];
  return `
    <div class="drawer-overlay" data-close-drawer></div>
    <nav class="drawer" aria-label="Mobile navigation">
      <div class="drawer-head"><img class="mark mark-img" src="./icon.png" alt="FinLedge logo"><div class="brand-text"><b>FinLedge</b><span>${appVersionLabel} / ${deviceName}</span></div></div>
      ${items.map(([id, label, icon, screens]) => `<button class="drawer-item ${screens.includes(appState.activeScreen) ? "active" : ""}" data-nav="${id}"><span>${icon}</span>${label}</button>`).join("")}
    </nav>
  `;
}

export function bottomNav(back: ScreenId, action?: ScreenId): string {
  const buttons = [
    `<button class="btn-secondary" type="button" data-back="${back}">Back</button>`,
    `<button class="btn-secondary" type="button" data-nav="home">Home</button>`,
  ];
  if (action) {
    const label = action.endsWith("dash") ? "View dashboard" : "Add entry";
    buttons.push(`<button class="btn-secondary" type="button" data-nav="${action}">${label}</button>`);
  }
  const colClass = action ? "btn-row-3" : "btn-row-2";
  return `<div class="btn-row ${colClass}">${buttons.join("")}</div>`;
}