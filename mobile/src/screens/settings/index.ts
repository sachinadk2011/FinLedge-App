import type { ScreenId } from "../../types.js";

type SettingsGroup = { title: string; rows: Array<[ScreenId, string, string, string]> };

const settingsGroups: SettingsGroup[] = [
  {
    title: "Account",
    rows: [
      ["settings-profile", "Profile", "Name and profile initials", "👤"],
    ],
  },
  {
    title: "Data & storage",
    rows: [
      ["settings-import-export", "Import / Export", "Notes paste, Excel import, Excel export", "📥"],
      ["settings-backup-sync", "Backup & sync", "Local backup status and future sync", "☁"],
      ["settings-privacy", "Privacy", "On-device SQLite storage and data controls", "🔒"],
    ],
  },
  {
    title: "About",
    rows: [
      ["settings-investment", "Investment", "Share portfolio rules and SIP notes", "📈"],
      ["settings-how-to-use", "How To Use", "Navigation and entry guidance", "?"],
      ["settings-about", "About", "Mobile runtime and desktop differences", "ℹ"],
      ["settings-version", "Version", "Mobile and desktop release tags", "#"],
    ],
  },
];

export function settingsScreen(): string {
  return `
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">General</h1>

    ${settingsGroups
      .map(
        (group) => `
        <div class="settings-group">
          <p class="settings-group-title">${group.title}</p>
          <section class="card settings-menu">
            ${group.rows.map(([target, label, detail, icon]) => settingsNavRow(target, label, detail, icon)).join("")}
          </section>
        </div>`,
      )
      .join("")}

    <section class="card settings-cta">
      <span class="settings-cta-icon">📝</span>
      <div>
        <h3>Import from notes</h3>
        <p class="settings-cta-text">Paste unstructured notes and map them to categories — with smart defaults you can override per line.</p>
      </div>
      <button class="btn-primary" data-nav="import-paste">Start import</button>
    </section>
  `;
}

function settingsNavRow(target: ScreenId, label: string, detail: string, icon: string): string {
  return `
    <button class="settings-row settings-nav-row" data-nav="${target}">
      <span class="settings-icon">${icon}</span>
      <span class="settings-row-main">
        <b>${label}</b>
        <span>${detail}</span>
      </span>
      <span class="settings-chevron" aria-hidden="true">›</span>
    </button>
  `;
}