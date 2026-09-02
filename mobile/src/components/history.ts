import { escapeHtml } from "../utils/html.js";
import { money } from "../utils/format.js";
import { filterRows, searchQuery } from "./search.js";

const SEARCH_FIELDS = ["description", "category", "flow_type", "date"] as const;

/**
 * Scrollable list of transaction-style rows with an optional search filter.
 * module is the search module key; "" means no search applied.
 */
export function historyRows(rows: Array<Record<string, unknown>>, wrap = true, module = ""): string {
  const filtered = module ? filterRows(rows, module, SEARCH_FIELDS) : rows;
  const query = module ? searchQuery(module) : "";
  const countLabel = `<p class="sub" style="margin:0 0 8px;font-size:11px;">Showing ${filtered.length} entr${filtered.length === 1 ? "y" : "ies"}${query ? ` matching "${escapeHtml(query)}"` : ""}</p>`;
  const content = filtered.length
    ? filtered.map((row) => {
        const inferDir = Number(row.amount ?? 0) >= 0 ? "income" : "expense";
        const direction = String(row.direction ?? inferDir);
        const amount = Number(row.amount ?? 0);
        const primary = escapeHtml(String(row.description ?? row.category ?? "Entry"));
        const sub = [row.category, row.date].filter(Boolean).map((v) => escapeHtml(String(v))).join(" · ");
        return `<div class="history-row">
          <div class="meta"><b>${primary}</b><span>${sub}</span></div>
          <div class="money ${direction === "income" ? "pos" : "neg"}">${money(amount, { sign: true })}</div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button style="width:26px;height:26px;border-radius:7px;background:var(--bg-surface-2);border:1px solid var(--border);color:var(--text-2);font-size:11px;" disabled title="Edit (coming soon)">✎</button>
            <button style="width:26px;height:26px;border-radius:7px;background:var(--bg-surface-2);border:1px solid var(--border);color:var(--text-2);font-size:11px;" disabled title="Delete (coming soon)">🗑</button>
          </div>
        </div>`;
      }).join("")
    : `<p class="sub">${query ? "No entries match your search." : "No entries yet."}</p>`;
  const scrollList = `<div style="max-height:300px;overflow-y:auto;-webkit-overflow-scrolling:touch;">${content}</div>`;
  return wrap ? `<section class="card">${countLabel}${scrollList}</section>` : `${countLabel}${scrollList}`;
}