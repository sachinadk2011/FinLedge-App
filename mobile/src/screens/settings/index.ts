import type { ScreenId } from "../../types.js";

type SettingsGroup = { title: string; rows: Array<[ScreenId, string, string, string]> };

const settingsGroups: SettingsGroup[] = [
  {
    title: "Account",
    rows: [
      ["settings-profile", "Profile", "", "👤"],
    ],
  },
  {
    title: "Data & storage",
    rows: [
      ["settings-import-export", "Import / Export", "", "📥"],
      ["settings-backup-sync", "Backup & sync", "", "☁"],
      ["settings-privacy", "Privacy", "", "🔒"],
    ],
  },
  {
    title: "About",
    rows: [
      ["settings-investment", "Investment", "", "📈"],
      ["settings-how-to-use", "How To Use", "", "?"],
      ["settings-about", "About", "", "ℹ"],
      ["settings-version", "Version", "", "#"],
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
        ${detail ? `<span>${detail}</span>` : ""}
      </span>
      <span class="settings-chevron" aria-hidden="true">›</span>
    </button>
  `;
}
