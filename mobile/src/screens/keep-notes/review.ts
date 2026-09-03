import { appState } from "../../app-state.js";
import type { ImportFlag, ImportModule, StagedEntry } from "../../../services/keep-notes-parser.js";
import { escapeAttr, escapeHtml } from "../../utils/html.js";
import { money } from "../../utils/format.js";
import {
  BANK_CATEGORIES,
  PERSONAL_FINANCE_DIRECTIONS,
  PERSONAL_FINANCE_EXPENSE_CATEGORIES,
  PERSONAL_FINANCE_FLOWS,
  PERSONAL_FINANCE_INCOME_CATEGORIES,
  SHARE_CATEGORIES,
} from "../../constants/options.js";

const MODULE_LABEL: Record<ImportModule, string> = {
  share: "Share",
  bank: "Bank",
  personal: "Personal",
};

/**
 * Notes import — step 2: full-screen review of the staged list.
 * Rendered as a normal screen (whole viewport), not a modal. Every staged row
 * is editable/splittable/deletable; flagged rows must be confirmed before the
 * commit button will enable. Nothing writes until "Commit all".
 */
export function importReviewScreen(): string {
  const rows = appState.importEntries;
  const query = appState.importReviewQuery.toLowerCase();
  const filtered = query ? rows.filter((r) => filterMatch(r, query)) : rows;
  const confirmable = rows.some(needsConfirm);

  return `
    <p class="eyebrow">Import / Export</p>
    <h1 class="pagehead">Review parsed entries</h1>
    <p class="sub">${rows.length} staged row${rows.length === 1 ? "" : "s"}. Edit, split, delete, or add before committing.</p>

    <section class="card import-toolbar">
      <input class="search-input" type="search" data-import-search placeholder="Search staged entries" value="${escapeAttr(appState.importReviewQuery)}" autocomplete="off">
      <button class="btn-soft" type="button" data-import-add-row>+ Add row</button>
    </section>

    ${filtered.length === 0 ? `<p class="sub">${query ? "No staged rows match your search." : "Nothing staged yet."}</p>` : ""}

    <div class="import-rows">
      ${filtered.map((entry) => stagedRowHtml(entry)).join("")}
    </div>

    <section class="card import-summary">
      <div><span>Total</span><b class="money">${money(rows.reduce((s, e) => s + e.amount, 0))}</b></div>
      <div><span>Confirmed</span><b>${rows.filter((r) => !needsConfirm(r)).length} / ${rows.length}</b></div>
    </section>

    <div class="btn-stack">
      <button class="btn-primary btn-block" type="button" data-import-commit ${confirmable ? "data-disabled" : ""}>Commit ${rows.length} rows</button>
      <div class="btn-row btn-row-2">
        <button class="btn-secondary" type="button" data-back>Back</button>
        <button class="btn-secondary" type="button" data-nav="home">Home</button>
      </div>
    </div>
  `;
}

function filterMatch(row: StagedEntry, query: string): boolean {
  return [row.label, row.description, row.category, row.date, String(row.amount), MODULE_LABEL[row.module]]
    .join(" ").toLowerCase().includes(query);
}

/** A row requires explicit confirmation when flagged ambiguous or checksum-mismatched. */
function needsConfirm(row: StagedEntry): boolean {
  return row.flags.some((f) => f.kind === "ambiguous" || f.kind === "checksum");
}

function stagedRowHtml(row: StagedEntry): string {
  return `
    <section class="card import-row ${row.edited ? "import-edited" : ""}" data-import-row="${row.id}">
      <div class="import-row-head">
        <div class="import-row-title">
          <b>${escapeHtml(row.label || row.description || "Untitled")}</b>
          <span class="import-row-meta">${escapeHtml(row.date)} · ${escapeHtml(row.category)}</span>
        </div>
        <div class="money import-amount ${row.direction === "income" ? "pos" : "neg"}">${money(row.amount, { sign: row.direction === "income" })}</div>
      </div>
      ${flagChips(row.flags)}
      <div class="import-row-fields">
        <label class="field">Date<input type="date" data-import-date value="${escapeAttr(row.date)}"></label>
        <label class="field">${row.module === "share" ? "Share name" : "Label"}<input type="text" data-import-label value="${escapeAttr(row.label)}"></label>
        <label class="field">Amount<input type="number" inputmode="decimal" value="${row.amount}"></label>
        <label class="field">Module<select data-import-module>${moduleOptions(row)}</select></label>
        <label class="field" data-import-flow-field>Flow<select data-import-flow>${flowOptions(row)}</select></label>
        <label class="field">Type<select data-import-direction>${directionOptions(row)}</select></label>
        <label class="field">Category<select data-import-category>${categoryOptions(row)}</select></label>
        <label class="field full">Description<input type="text" data-import-description value="${escapeAttr(row.description)}"></label>
      </div>
      <div class="import-row-actions">
        <button class="btn-soft btn-sm" type="button" data-import-confirm ${needsConfirm(row) ? "" : "hidden"}>Confirm</button>
        <button class="btn-soft btn-sm" type="button" data-import-split>Split</button>
        <button class="btn-soft btn-sm" type="button" data-import-undo-split ${row.splitGroup ? "" : "hidden"}>Undo split</button>
        <button class="btn-soft btn-sm" type="button" data-import-delete>Delete</button>
      </div>
    </section>
  `;
}

function flagChips(flags: ImportFlag[]): string {
  if (!flags.length) return "";
  return flags.map((f) => `<span class="import-flag ${f.kind}">${escapeHtml(f.message)}</span>`).join("");
}

function moduleOptions(row: StagedEntry): string {
  return (["share", "bank", "personal"] as ImportModule[])
    .map((m) => `<option value="${m}" ${row.module === m ? "selected" : ""}>${MODULE_LABEL[m]}</option>`)
    .join("");
}

function flowOptions(row: StagedEntry): string {
  return PERSONAL_FINANCE_FLOWS.map((f) => `<option value="${f.value}" ${row.flow === f.value ? "selected" : ""}>${f.label}</option>`).join("");
}

function directionOptions(row: StagedEntry): string {
  return PERSONAL_FINANCE_DIRECTIONS.map((d) => `<option value="${d.value}" ${row.direction === d.value ? "selected" : ""}>${d.label}</option>`).join("");
}

function categoryOptions(row: StagedEntry): string {
  const list = categoryListFor(row);
  const hasCurrent = list.includes(row.category);
  const options = list.map((c) => `<option value="${escapeAttr(c)}" ${row.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
  const current = hasCurrent ? "" : `<option value="${escapeAttr(row.category)}" selected>${escapeHtml(row.category || "Other")}</option>`;
  return current + options;
}

function categoryListFor(row: StagedEntry): string[] {
  if (row.module === "bank") return BANK_CATEGORIES;
  if (row.module === "share") return SHARE_CATEGORIES;
  return row.direction === "income" ? PERSONAL_FINANCE_INCOME_CATEGORIES : PERSONAL_FINANCE_EXPENSE_CATEGORIES;
}