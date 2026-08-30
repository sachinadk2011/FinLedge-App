import { CREATE_TABLE_STATEMENTS } from "../data/schema.js";

export function settingsImportExportScreen(): string {
  return `
    <p class="eyebrow">Settings</p>
    <h1 class="pagehead">Import / Export</h1>
    <section class="card settings-menu">
      <button class="settings-row settings-nav-row">
        <span class="settings-row-left"><span class="settings-icon">📋</span><span><b>Import by pasting</b><span>Keep Notes paste flow: paste, review, confirm, commit.</span></span></span>
        <span>Phase 5</span>
      </button>
      <button class="settings-row settings-nav-row">
        <span class="settings-row-left"><span class="settings-icon">📄</span><span><b>Import from Excel</b><span>Bring desktop-compatible workbooks into local SQLite.</span></span></span>
        <span>Planned</span>
      </button>
      <button class="settings-row settings-nav-row">
        <span class="settings-row-left"><span class="settings-icon">↗</span><span><b>Export SQLite to Excel</b><span>Create desktop-compatible Bank, Share, Bank Flow, and Cash Flow workbooks.</span></span></span>
        <span>Phase 6</span>
      </button>
    </section>
    <section class="card"><h3>SQLite schema</h3><p class="sub">${CREATE_TABLE_STATEMENTS.length} local tables ready for mobile storage.</p></section>
    <button class="btn-secondary" data-back="settings">Back to settings</button>
  `;
}
