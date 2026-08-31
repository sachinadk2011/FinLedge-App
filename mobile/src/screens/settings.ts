import type { ScreenId } from "../types.js";

const settingsRows: Array<[ScreenId, string, string, string]> = [
  ["settings-profile", "Profile", "Edit your name and profile initials.", "👤"],
  ["settings-import-export", "Import / Export", "Paste import, Excel import, and Excel export.", "📥"],
  ["settings-investment", "Investment", "Share portfolio rules and SIP notes.", "📈"],
  ["settings-backup-sync", "Backup & sync", "Local backup status and future sync entry point.", "☁"],
  ["settings-privacy", "Privacy", "On-device SQLite storage and data controls.", "🔒"],
  ["settings-about", "About", "Mobile runtime and desktop/mobile differences.", "ℹ"],
  ["settings-how-to-use", "How To Use", "Mobile navigation and entry guidance.", "?"],
  ["settings-version", "Version", "Mobile and desktop release tag details.", "#"],
];

export function settingsScreen(): string {
  return `
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">General</h1>
    <section class="card settings-menu" style="padding:6px 16px;">
      ${settingsRows.map(([target, label, detail, icon]) => settingsNavRow(target, label, detail, icon)).join("")}
    </section>

    <section class="card" style="border-color:var(--accent-green);background:var(--accent-green-dim);margin-bottom:30px;">
      <h3 style="color:var(--accent-green);">Import from Keep Notes</h3>
      <p class="sub">Paste unstructured notes and map them to categories before import — with smart defaults you can override per line.</p>
      <button class="btn-primary" data-nav="settings-import-export" style="margin:0;">Start import</button>
    </section>
  `;
}

function settingsNavRow(target: ScreenId, label: string, detail: string, icon: string): string {
  return `
    <button class="settings-row settings-nav-row" data-nav="${target}">
      <span class="settings-row-left"><span class="settings-icon">${icon}</span><span><b>${label}</b><span>${detail}</span></span></span>
      <span class="chevron">›</span>
    </button>
  `;
}
