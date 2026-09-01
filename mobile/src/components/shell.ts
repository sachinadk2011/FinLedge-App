import { appState, appVersionLabel, deviceName, getProfileName, greeting, profileInitial } from "../app-state.js";
import {
  BANK_CATEGORIES,
  PERSONAL_FINANCE_DIRECTIONS,
  PERSONAL_FINANCE_EXPENSE_CATEGORIES,
  PERSONAL_FINANCE_FLOWS,
  PERSONAL_FINANCE_INCOME_CATEGORIES,
  SHARE_CATEGORIES,
  SHARE_CATEGORY_LABELS,
} from "../constants/options.js";
import { groupedBarsLegend, renderGroupedBars } from "./home-chart.js";
import type { ChartBucket, ChartRange, ScreenId } from "../types.js";
import { compactMoney, money } from "../utils/format.js";
import { addDays, daysBetween, monthKey, parseDateKey, toDateKey, today } from "../utils/date.js";

/** Today's date as YYYY-MM-DD, computed once per render. */
const todayStr = toDateKey(today());

// ─────────────────────────────────────────────────────────────────────────────
// Shell chrome
// ─────────────────────────────────────────────────────────────────────────────

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
        <div class="brand-text"><b>FinLedge</b><span>${greeting()}${name ? `, ${name}` : ""}</span></div>
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
    ["settings", "Settings", "⚙", ["settings", "settings-profile", "settings-import-export", "settings-investment", "settings-backup-sync", "settings-privacy", "settings-about", "settings-how-to-use", "settings-version"]],
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

export function addFormScreen(eyebrow: string, title: string, fields: string[][], submit: string, next: ScreenId): string {
  return `<p class="eyebrow">${eyebrow}</p><h1 class="pagehead">${title}</h1><p class="sub">Stored locally on this device.</p>${formCard(fields, submit)}${bottomNav("home", next)}`;
}

export function formCard(fields: string[][], submit: string): string {
  return `<section class="card">${fields.map(([label, type, value]) => field(label, type, value)).join("")}<button class="btn-primary">${submit}</button></section>`;
}

/** Renders a form field. Date inputs default to today — user only taps if they need a different date. */
export function field(label: string, type: string, value?: string): string {
  const defaultValue = type === "date" ? todayStr : (value ?? "");
  if (type === "select") {
    return `<div class="field"><label>${label}</label><select>${selectOptions(label, value)}</select></div>`;
  }
  return `<div class="field"><label>${label}</label><input type="${type}" ${type === "number" ? `inputmode="decimal"` : ""} value="${defaultValue}"></div>`;
}

export function selectOptions(label: string, fallback = "Other"): string {
  const optionsByLabel: Record<string, string[]> = {
    Category: BANK_CATEGORIES.includes(fallback ?? "") ? BANK_CATEGORIES : [...PERSONAL_FINANCE_EXPENSE_CATEGORIES, ...PERSONAL_FINANCE_INCOME_CATEGORIES],
    "Entry type": SHARE_CATEGORIES,
    Flow: PERSONAL_FINANCE_FLOWS.map((f) => f.label),
    Type: PERSONAL_FINANCE_DIRECTIONS.map((d) => d.label),
    "Dividend Type": ["cash", "bonus"],
    "SIP type": ["installment", "redeem"],
  };
  const options = optionsByLabel[label] || [fallback ?? "Other", "Other"];
  return options.map((o) => `<option value="${o}">${SHARE_CATEGORY_LABELS[o] || o}</option>`).join("");
}

export function sectionTitle(heading: string, rightLabel = ""): string {
  return `<div class="section-title"><h3>${heading}</h3>${rightLabel ? `<span>${rightLabel}</span>` : ""}</div>`;
}

export function searchInput(module: string, placeholder = "Search"): string {
  const current = appState.dashSearchQuery[module] ?? "";
  return `<input class="search-input" type="search" placeholder="${placeholder}" value="${current.replace(/"/g, "&quot;")}" data-search-module="${module}" autocomplete="off">`;
}

/** 2-column stat grid. fullWidthLast = last box spans both columns (hero value). */
export function statGrid(stats: Array<[string, number, string]>, cols: 2 | 3 = 2, fullWidthLast = false): string {
  const colClass = cols === 3 ? "stat-grid split-3" : "stat-grid";
  return `<div class="${colClass}">${stats.map(([label, value, tone], i) => {
    const isLast = i === stats.length - 1;
    const extra = fullWidthLast && isLast ? " stat-box-full" : "";
    return `<div class="stat-box${extra}"><div class="label">${label}</div><div class="value money ${tone}">${money(value, { sign: tone === "pos" || tone === "neg" })}</div></div>`;
  }).join("")}</div>`;
}

export function dashboardScreen(eyebrow: string, title: string, stats: Array<[string, number, string]>, body: string, addTarget: ScreenId): string {
  return `<p class="eyebrow">${eyebrow}</p><h1 class="pagehead">${title}</h1><div class="stat-grid card">${stats.map(([label, value, tone]) => `<div class="stat-box"><div class="label">${label}</div><div class="value money ${tone}">${money(value, { sign: tone === "pos" || tone === "neg" })}</div></div>`).join("")}</div>${body}${bottomNav("home", addTarget)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Period bucket generation
// ─────────────────────────────────────────────────────────────────────────────

export type PeriodBucket = {
  /** Primary x-axis label: day number for day buckets ("31"), month abbrev for month buckets ("Aug") */
  label: string;
  /** Secondary label below: month abbrev for day buckets ("Aug"), 2-digit year for month buckets ("'26") */
  sublabel: string;
  /** "YYYY-MM-DD" for day buckets, "YYYY-MM" for month buckets */
  key: string;
  isDay: boolean;
};

/**
 * Returns ALL historical period buckets for the current appState.homeRange.
 * Buckets ordered oldest → newest so today / current month is RIGHTMOST.
 * Generates enough history so the user can scroll left to see past data:
 *   week  → 90 daily buckets  (~13 weeks of history)
 *   month → 400 daily buckets (~13 months of daily data)
 *   year  → 48 monthly buckets (~4 years of monthly data)
 *   custom→ daily ≤60d, monthly >60d
 */
export function getPeriodBuckets(range: ChartRange = appState.homeRange, bankMode = false): PeriodBucket[] {
  const now = today();
  if (bankMode && range === "week") {
    range = "month";
  }

  if (range === "week" && !bankMode) {
    return Array.from({ length: 90 }, (_, i) => {
      const d = addDays(now, i - 89);
      return { label: String(d.getDate()), sublabel: d.toLocaleString("en-US", { month: "short" }), key: toDateKey(d), isDay: true };
    });
  }

  if (range === "month") {
    if (bankMode) {
      return Array.from({ length: 13 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (12 - i), 1);
        const yr = String(d.getFullYear()).slice(2);
        return { label: d.toLocaleString("en-US", { month: "short" }), sublabel: `'${yr}`, key: monthKey(d), isDay: false };
      });
    }
    return Array.from({ length: 400 }, (_, i) => {
      const d = addDays(now, i - 399);
      return { label: String(d.getDate()), sublabel: d.toLocaleString("en-US", { month: "short" }), key: toDateKey(d), isDay: true };
    });
  }

  if (range === "year") {
    return Array.from({ length: 48 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (47 - i), 1);
      const yr = String(d.getFullYear()).slice(2);
      return { label: d.toLocaleString("en-US", { month: "short" }), sublabel: `'${yr}`, key: monthKey(d), isDay: false };
    });
  }

  if (range !== "custom") {
    return [];
  }

  // custom
  const span = daysBetween(appState.customStart, appState.customEnd);
  if (span <= 60) {
    return Array.from({ length: span }, (_, i) => {
      const d = addDays(parseDateKey(appState.customStart), i);
      return { label: String(d.getDate()), sublabel: d.toLocaleString("en-US", { month: "short" }), key: toDateKey(d), isDay: true };
    });
  }
  const buckets: PeriodBucket[] = [];
  let cur = new Date(parseDateKey(appState.customStart));
  cur.setDate(1);
  const endD = parseDateKey(appState.customEnd);
  while (cur <= endD) {
    const yr = String(cur.getFullYear()).slice(2);
    buckets.push({ label: cur.toLocaleString("en-US", { month: "short" }), sublabel: `'${yr}`, key: monthKey(cur), isDay: false });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return buckets;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar chart — matches graph design prototype
// Green = income/positive, Red = expense/negative, Teal = net≥0, Amber = net<0
// Value label above bar in same color, day on x-axis, month sublabel below
// ─────────────────────────────────────────────────────────────────────────────

export type BarChartBucket = {
  label: string;       // x-axis primary label
  sublabel?: string;   // x-axis secondary label (month for day buckets)
  value: number;
  color: string;       // CSS var string
};

const COL_W   = 44;
const COL_H   = 160;
const PLOT_H  = 104;
const BAR_MAX = PLOT_H - 16;

/**
 * Prototype-matching bar chart.
 * - One bar per bucket, colored per design.md §5
 * - Value label ABOVE bar in same color (skip if value === 0)
 * - Day number on x-axis; month abbreviation below (for day buckets)
 * - Scrollable via chart-scroll + data-scroll-end (auto-scrolled to today by main.ts)
 */
export function renderBars(buckets: BarChartBucket[]): string {
  if (!buckets.length) return "<p class='sub'>No data for this period.</p>";
  const nonZero = buckets.filter((b) => Math.abs(b.value) > 0);
  const maxVal  = nonZero.length ? Math.max(...nonZero.map((b) => Math.abs(b.value))) : 1;
  const totalW  = buckets.length * (COL_W + 6);

  const cols = buckets.map((b) => {
    const hasBar = Math.abs(b.value) >= 0.01;
    const barPx  = hasBar ? Math.max(4, (Math.abs(b.value) / maxVal) * BAR_MAX) : 0;
    const stickHtml = hasBar
      ? `<div class="single-bar-stick">
          <span class="single-bar-val" style="color:${b.color};">${compactMoney(b.value)}</span>
          <div class="single-bar-body" style="height:${barPx}px;background:${b.color};"></div>
        </div>`
      : "";
    const subHtml = b.sublabel
      ? `<span class="single-bar-sub">${b.sublabel}</span>`
      : `<span class="single-bar-sub"></span>`;
    return `<div class="single-bar-col" style="width:${COL_W}px;">
      <div class="single-bar-plot">${stickHtml}</div>
      <span class="single-bar-x">${b.label}</span>
      ${subHtml}
    </div>`;
  }).join("");

  return `<div class="chart-scroll chart-animate" data-scroll-end style="-webkit-overflow-scrolling:touch;">
    <div class="chart-track" style="width:${totalWidth(buckets)}px;">
      ${cols}
    </div>
  </div>`;
}

function totalWidth(buckets: BarChartBucket[]): number {
  return buckets.length * (COL_W + 6) + 16;
}

/**
 * Full bar chart card with title, description, rendered bars, and legend.
 * For module charts that DON'T need period controls inside.
 */
export function barsChart(
  title: string,
  description: string,
  buckets: BarChartBucket[],
  legend: Array<{ label: string; color: string }>,
): string {
  const legendHtml = legend.map((l) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${l.color};margin-right:5px;vertical-align:middle;"></i>${l.label}</span>`).join("");
  return `<section class="card">
    <h3>${title}</h3>
    ${description ? `<p class="sub" style="margin:0 0 10px;font-size:11px;color:var(--text-3);">${description}</p>` : ""}
    ${renderBars(buckets)}
    ${legendHtml ? `<div class="chart-legend" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;">${legendHtml}</div>` : ""}
  </section>`;
}

/**
 * Bar chart card WITH period controls built in — matches home-chart card pattern.
 * Use this for Bank/Shares/Expenses/Summary dashboards.
 * Swipe ← on chart to see older periods; today is always rightmost.
 */
type PeriodRangeConfig = {
  ranges?: ChartRange[];
  activeRange?: ChartRange;
  rangeAttr?: "data-home-range" | "data-bank-range";
};

function periodRangeControls({
  ranges = ["week", "month", "year", "custom"],
  activeRange = appState.homeRange,
  rangeAttr = "data-home-range",
}: PeriodRangeConfig = {}): string {
  const tabs = ranges.map((r) =>
    `<button class="${activeRange === r ? "active" : ""}" ${rangeAttr}="${r}">${r[0].toUpperCase()}${r.slice(1)}</button>`
  ).join("");
  const customRange = activeRange === "custom"
    ? `<div class="custom-range"><label>From<input type="date" value="${appState.customStart}" data-custom-start></label><label>To<input type="date" value="${appState.customEnd}" data-custom-end></label></div>`
    : "";
  return `<div class="segmented graph-tabs period-tabs" style="margin-bottom:8px;">${tabs}</div>${customRange}`;
}

export function periodBarsChart(
  title: string,
  buckets: BarChartBucket[],
  legend: Array<{ label: string; color: string }>,
  config: PeriodRangeConfig = {},
): string {
  const legendHtml = legend.map((l) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${l.color};margin-right:5px;vertical-align:middle;"></i>${l.label}</span>`).join("");
  return `<section class="card">
    <div class="section-title"><h3>${title}</h3></div>
    ${periodRangeControls(config)}
    ${renderBars(buckets)}
    ${legendHtml ? `<div class="chart-legend" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;">${legendHtml}</div>` : ""}
  </section>`;
}

/** Income / expense / net grouped bars — for Bank Services and Personal Expenses dashboards. */
export function periodGroupedBarsChart(
  title: string,
  buckets: ChartBucket[],
  config: PeriodRangeConfig = {},
): string {
  return `<section class="card">
    <div class="section-title"><h3>${title}</h3></div>
    ${periodRangeControls(config)}
    ${renderGroupedBars(buckets)}
    ${groupedBarsLegend()}
  </section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Period controls (standalone — for Home screen card)
// ─────────────────────────────────────────────────────────────────────────────

export function periodControls(ranges: ChartRange[], options: { wrap?: boolean } = { wrap: true }): string {
  const body = `<div class="segmented graph-tabs period-tabs">${ranges.map((r) => `<button class="${appState.homeRange === r ? "active" : ""}" data-home-range="${r}">${r[0].toUpperCase()}${r.slice(1)}</button>`).join("")}</div>
    ${appState.homeRange === "custom" ? `<div class="custom-range"><label>From<input type="date" value="${appState.customStart}" data-custom-start></label><label>To<input type="date" value="${appState.customEnd}" data-custom-end></label></div>` : ""}`;
  return options.wrap === false ? `<div class="period-controls compact-card">${body}</div>` : `<section class="card compact-card">${body}</section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// History rows — scrollable list + search filter
// ─────────────────────────────────────────────────────────────────────────────

export function historyRows(rows: Array<Record<string, unknown>>, wrap = true, module = ""): string {
  const query = module ? (appState.dashSearchQuery[module] ?? "").toLowerCase() : "";
  const filtered = query
    ? rows.filter((row) => [row.description, row.category, row.flow_type, row.date].map(String).join(" ").toLowerCase().includes(query))
    : rows;
  const countLabel = `<p class="sub" style="margin:0 0 8px;font-size:11px;">Showing ${filtered.length} entr${filtered.length === 1 ? "y" : "ies"}${query ? ` matching "${query}"` : ""}</p>`;
  const content = filtered.length
    ? filtered.map((row) => {
        const inferDir = Number(row.amount ?? 0) >= 0 ? "income" : "expense";
        const direction = String(row.direction ?? inferDir);
        const amount = Number(row.amount ?? 0);
        const primary = String(row.description ?? row.category ?? "Entry");
        const sub = [row.category, row.date].filter(Boolean).map(String).join(" · ");
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

// ─────────────────────────────────────────────────────────────────────────────
// Category bar meter section
// ─────────────────────────────────────────────────────────────────────────────

export function categoryBarsSection(title: string, totals: Array<{ label: string; value: number }>, color = "var(--brand-teal)"): string {
  if (!totals.length) return "";
  const max = Math.max(...totals.map((t) => Math.abs(t.value)), 1);
  const rows = totals.map((t) => {
    const pct = Math.max(4, (Math.abs(t.value) / max) * 100);
    return `<div class="history-row" style="display:block;padding:8px 0;">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-1);margin-bottom:6px;">
        <span>${t.label}</span><b class="money" style="font-variant-numeric:tabular-nums;">${compactMoney(t.value)}</b>
      </div>
      <div class="category-meter"><i style="width:${pct}%;background:${color};"></i></div>
    </div>`;
  }).join("");
  return `<section class="card"><h3>${title}</h3>${rows}</section>`;
}
