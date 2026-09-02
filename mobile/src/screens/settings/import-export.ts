import { CREATE_TABLE_STATEMENTS } from "../../data/schema.js";
import { settingsSubScreen } from "./layout.js";

export function settingsImportExportScreen(): string {
  return settingsSubScreen(
    "Import / Export",
    `<section class="card settings-menu">
      <button class="settings-row settings-nav-row">
        <span class="settings-icon">📋</span>
        <span class="settings-row-main"><b>Import by pasting</b><span>Keep Notes paste flow: paste, review, confirm, commit.</span></span>
        <span class="settings-tag">Phase 5</span>
      </button>
      <button class="settings-row settings-nav-row">
        <span class="settings-icon">📄</span>
        <span class="settings-row-main"><b>Import from Excel</b><span>Bring desktop-compatible workbooks into local SQLite.</span></span>
        <span class="settings-tag muted">Planned</span>
      </button>
      <button class="settings-row settings-nav-row">
        <span class="settings-icon">↗</span>
        <span class="settings-row-main"><b>Export SQLite to Excel</b><span>Create desktop-compatible Bank, Share, Bank Flow, and Cash Flow workbooks.</span></span>
        <span class="settings-tag">Phase 6</span>
      </button>
    </section>
    <section class="card"><h3>SQLite schema</h3><p class="sub">${CREATE_TABLE_STATEMENTS.length} local tables ready for mobile storage.</p></section>`,
  );
}