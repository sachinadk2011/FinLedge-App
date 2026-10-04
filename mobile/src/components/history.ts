import { escapeAttr, escapeHtml } from "../utils/html.js";
import { money } from "../utils/format.js";
import { filterRows, searchQuery } from "./search.js";

const SEARCH_FIELDS = ["description", "category", "flow_type", "date"] as const;

/**
 * Scrollable list of transaction-style rows with an optional search filter.
 * module is the search module key; "" means no search applied.
 *
 * Rows that carry `_table` + `_id` get working edit/delete buttons wired to the
 * SQL store. Read-only summaries can hide actions entirely.
 */
export function historyRows(
  rows: Array<Record<string, unknown>>,
  wrap = true,
  module = "",
  options: { actions?: boolean } = {},
): string {
  const showActions = options.actions !== false;
  const filtered = (module ? filterRows(rows, module, SEARCH_FIELDS) : rows)
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compareHistoryRows(a.row, b.row, a.index, b.index));
  const query = module ? searchQuery(module) : "";
  const countLabel = `<p class="sub" style="margin:0 0 8px;font-size:11px;">Showing ${filtered.length} entr${filtered.length === 1 ? "y" : "ies"}${query ? ` matching "${escapeHtml(query)}"` : ""}</p>`;
  const content = filtered.length
    ? filtered.map(({ row, index }) => {
        const inferDir = Number(row.amount ?? 0) >= 0 ? "income" : "expense";
        const direction = row._neutral ? "neutral" : String(row.direction ?? inferDir);
        const amount = Number(row.amount ?? 0);
        const displayAmount = direction === "income"
          ? Math.abs(amount)
          : direction === "expense"
            ? -Math.abs(amount)
            : amount;
        const primary = escapeHtml(String(row.description ?? row.category ?? "Entry"));
        const sub = [row.category, row.date].filter(Boolean).map((v) => escapeHtml(String(v))).join(" · ");
        const table = row._table ? String(row._table) : "";
        const rowId = row._id;
        const historyKey = historyRowKey(row, index);
        const deletable = Boolean(table && rowId != null && rowId !== "");
        const editBtn = deletable
          ? `<button style="width:26px;height:26px;border-radius:7px;background:var(--bg-surface-2);border:1px solid var(--border);color:var(--text-2);font-size:11px;" data-edit data-table="${escapeAttr(table)}" data-id="${escapeAttr(String(rowId))}" title="Edit">✎</button>`
          : `<button style="width:26px;height:26px;border-radius:7px;background:var(--bg-surface-2);border:1px solid var(--border);color:var(--text-2);font-size:11px;" disabled title="Edit (coming soon)">✎</button>`;
        const deleteBtn = deletable
          ? `<button style="width:26px;height:26px;border-radius:7px;background:var(--bg-surface-2);border:1px solid var(--border);color:var(--text-2);font-size:11px;" data-delete data-table="${escapeAttr(table)}" data-id="${escapeAttr(String(rowId))}" title="Delete">🗑</button>`
          : `<button style="width:26px;height:26px;border-radius:7px;background:var(--bg-surface-2);border:1px solid var(--border);color:var(--text-2);font-size:11px;" disabled title="Delete (coming soon)">🗑</button>`;
        const actions = showActions
          ? `<div style="display:flex;gap:4px;flex-shrink:0;">
            ${editBtn}
            ${deleteBtn}
          </div>`
          : "";
        return `<div class="history-row" data-history-key="${escapeAttr(historyKey)}">
          <div class="meta"><b>${primary}</b><span>${sub}</span></div>
          <div class="money ${direction === "income" ? "pos" : direction === "neutral" ? "neu" : "neg"}">${money(displayAmount, { sign: direction !== "neutral" })}</div>
          ${actions}
        </div>`;
      }).join("")
    : `<p class="sub">${query ? "No entries match your search." : "No entries yet."}</p>`;
  const scrollList = `<div style="max-height:300px;overflow-y:auto;-webkit-overflow-scrolling:touch;">${content}</div>`;
  return wrap ? `<section class="card">${countLabel}${scrollList}</section>` : `${countLabel}${scrollList}`;
}

function compareHistoryRows(a: Record<string, unknown>, b: Record<string, unknown>, aIndex: number, bIndex: number): number {
  const aParts = historyDateParts(a);
  const bParts = historyDateParts(b);
  for (let i = 0; i < aParts.length; i += 1) {
    if (aParts[i] !== bParts[i]) return bParts[i] - aParts[i];
  }
  return aIndex - bIndex;
}

function historyRowKey(row: Record<string, unknown>, index: number): string {
  const created = row.created_timestamp ?? row.timestamp ?? "";
  const updated = row.last_updated_timestamp ?? "";
  return [
    row.date ?? "",
    created,
    updated,
    row._table ?? "",
    row._id ?? "",
    index,
  ].map((part) => String(part)).join("|");
}

function historyDateParts(row: Record<string, unknown>): [number, number, number] {
  return [
    dateValue(row.date),
    dateValue(row.created_timestamp ?? row.timestamp),
    dateValue(row.last_updated_timestamp),
  ];
}

function dateValue(value: unknown): number {
  const raw = String(value ?? "");
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}
