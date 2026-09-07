import { appState } from "../app-state.js";
import { field, selectWithCurrent } from "../components/forms.js";
import { bottomNav } from "../components/shell.js";
import { bankRecords, manualExpenseRows, shareRecords, transferRows } from "../data/demo-data.js";
import {
  BANK_CATEGORIES,
  PERSONAL_FINANCE_DIRECTIONS,
  PERSONAL_FINANCE_EXPENSE_CATEGORIES,
  PERSONAL_FINANCE_INCOME_CATEGORIES,
  SHARE_CATEGORIES,
  SHARE_CATEGORY_LABELS,
} from "../constants/options.js";
import { escapeAttr } from "../utils/html.js";

/**
 * Edit an existing stored row (opened from the ✎ button on any deletable
 * history row, or the Shares quick-update cards). Saving runs the repository
 * update (with recomputes) — a real SQL write, not a fake placeholder.
 */
export function entryEditScreen(): string {
  const editing = appState.editingEntry;
  if (!editing) {
    return `
      <p class="eyebrow">Edit</p>
      <h1 class="pagehead">Edit entry</h1>
      <p class="sub">Pick an entry from a history list to edit it.</p>
      <button class="btn-secondary" data-back="home">Back to Home</button>
    `;
  }

  const form = editFormFor(editing.table, Number(editing.id));
  return `
    <p class="eyebrow">Edit entry</p>
    <h1 class="pagehead">Edit entry</h1>
    <p class="sub">Changes are saved straight to the on-device database.</p>
    <section class="card" data-entry-edit-form="${escapeAttr(editing.table)}" data-entry-edit-id="${escapeAttr(String(editing.id))}">
      ${form}
      <button class="btn-primary" data-entry-edit-save>Save changes</button>
    </section>
    ${bottomNav("home", "home")}
  `;
}

function editFormFor(table: string, id: number): string {
  if (table === "bank_transactions") {
    const row = bankRecords.find((r) => String(r.id) === String(id));
    if (!row) return missingRowHtml("Bank entry");
    return `
      ${field("Date", "date", String(row.date ?? ""), "date")}
      <div class="field"><label>Category</label><select name="category">${selectWithCurrent(BANK_CATEGORIES, String(row.category ?? ""))}</select></div>
      ${field("Amount (negative = charge)", "number", String(Number(row.amount ?? 0)), "amount")}
      ${field("Description (optional)", "text", String(row.description ?? ""), "description")}
    `;
  }
  if (table === "share_transactions") {
    const row = shareRecords.find((r) => String(r.id) === String(id));
    if (!row) return missingRowHtml("Share entry");
    const currentCategory = String(row.category ?? "");
    return `
      ${field("Date", "date", String(row.date ?? ""), "date")}
      <div class="field"><label>Share name</label><input type="text" name="share_name" value="${escapeAttr(String(row.share_name ?? ""))}"></div>
      <div class="field"><label>Category</label><select name="category">${selectWithCurrent(SHARE_CATEGORIES, currentCategory, SHARE_CATEGORY_LABELS)}</select></div>
      ${field("Per unit price", "number", String(Number(row.per_unit_price ?? 0)), "per_unit_price")}
      ${field("Allotted", "number", String(Number(row.allotted ?? 0)), "allotted")}
      <p class="sub" style="margin:0;font-size:11px;color:var(--text-3);">Total, ASBA and profit/loss are recomputed automatically.</p>
    `;
  }
  if (table === "personal_finance_bank_flow" || table === "personal_finance_cash_flow") {
    const run = table === "personal_finance_bank_flow";
    // Bank and cash rows live in separate SQLite tables with independent
    // autoincrement ids (both start at 1), so a raw id-only lookup in the
    // merged array can hit the WRONG flow's row. Scope the search to the
    // flow this edit row actually belongs to.
    const pool = manualExpenseRows.filter((r) => r.flow_type === (run ? "bank" : "cash"));
    const row = pool.find((r) => String(r.id) === String(id));
    if (!row) return missingRowHtml("Expense entry");
    const direction = String(row.direction ?? "expense").toLowerCase();
    const categories = direction === "income" ? PERSONAL_FINANCE_INCOME_CATEGORIES : PERSONAL_FINANCE_EXPENSE_CATEGORIES;
    return `
      ${field("Date", "date", String(row.date ?? ""), "date")}
      <div class="field"><label>Flow</label><select name="flow">${flowOptions(run)}</select></div>
      <div class="field"><label>Type</label><select name="direction">${directionOptions(direction)}</select></div>
      <div class="field"><label>Category</label><select name="category">${selectWithCurrent(categories, String(row.category ?? ""))}</select></div>
      ${field("Amount", "number", String(Number(row.amount ?? 0)), "amount")}
      ${field("Description (optional)", "text", String(row.description ?? ""), "description")}
    `;
  }
  if (table === "transfers") {
    const row = transferRows.find((r) => String(r.id) === String(id));
    if (!row) return missingRowHtml("Transfer");
    const fromBank = String(row.from_flow ?? "") === "bank";
    return `
      ${field("Date", "date", String(row.date ?? ""), "date")}
      <div class="chip-row">
        <button type="button" class="chip ${fromBank ? "active" : ""}" data-edit-transfer-direction="bank-to-cash">Bank to Cash</button>
        <button type="button" class="chip ${fromBank ? "" : "active"}" data-edit-transfer-direction="cash-to-bank">Cash to Bank</button>
      </div>
      ${field("Amount", "number", String(Math.abs(Number(row.amount ?? 0))), "amount")}
      ${field("Note", "text", String(row.description ?? ""), "note")}
    `;
  }
  return missingRowHtml("Entry");
}

function missingRowHtml(kind: string): string {
  return `<p class="sub">That ${kind.toLowerCase()} could not be found. It may have been deleted.</p>`;
}

function directionOptions(current: string): string {
  return PERSONAL_FINANCE_DIRECTIONS.map(
    (d) => `<option value="${d.value}" ${d.value === current ? "selected" : ""}>${d.label}</option>`,
  ).join("");
}

/** Flow selector — values match the add-entry form ("Bank Flow" / "Cash Flow"). */
function flowOptions(runBank: boolean): string {
  return `<option value="Bank Flow" ${runBank ? "selected" : ""}>Bank Flow</option><option value="Cash Flow" ${runBank ? "" : "selected"}>Cash Flow</option>`;
}