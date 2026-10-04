import { appState, shouldShowProfilePrompt } from "../app-state.js";
import { categoryBars, homeChart } from "../components/home-chart.js";
import { historyRows } from "../components/history.js";
import { escapeAttr, escapeHtml } from "../utils/html.js";
import {
  currentMonthTotals,
  manualPersonalFinanceRows,
  sumRows,
  todayTotals,
} from "../data/mobile-data.js";
import type { PersonalFinanceRecord } from "../../services/personal-finance-sync-row-computation.js";
import { addDays, monthLabel, today, toDateKey } from "../utils/date.js";
import { money } from "../utils/format.js";
import { getPeriodBuckets, matchesPeriod } from "../utils/periods.js";

export function homeScreen(): string {
  const monthly = currentMonthTotals();
  const daily = todayTotals();
  const filteredRows = filteredHomeRows();
  const filteredAllRows = filteredHomeAllDirectionsRows();
  const selectedTotal = sumRows(filteredRows);
  const recent = [...filteredRows]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 4)
    .map((row) => ({
      ...row,
      _table: row.flow_type === "bank" ? "personal_finance_bank_flow" : "personal_finance_cash_flow",
      _id: row.id,
    }));
  const currentMonthLabel = monthLabel(today());
  const categoryTitle = appState.homeRange === "custom" ? "Selected categories" : `${rangeLabel(appState.homeRange)} categories`;

  return `
    ${profilePrompt()}
    <section class="card balance-card">
      <div class="segmented">
        <button class="${appState.homeMode === "expense" ? "active" : ""}" data-home-mode="expense">Expense</button>
        <button class="${appState.homeMode === "income" ? "active" : ""}" data-home-mode="income">Income</button>
      </div>
      <div class="metric-row"><div><div class="metric-label">${currentMonthLabel} net balance</div><div class="money big ${monthly.net >= 0 ? "pos" : "neg"}">${money(monthly.net, { sign: true })}</div></div></div>
      <div class="split split-3 home-total-row"><div><span>Total income</span><b class="money pos">${money(monthly.income)}</b></div><div><span>Total expense</span><b class="money neg">${money(monthly.expense)}</b></div><div><span>Selected ${appState.homeMode}</span><b class="money ${appState.homeMode === "income" ? "pos" : "neg"}">${money(selectedTotal)}</b></div></div>
    </section>
    <div class="stat-grid stat-grid-spaced">
      <div class="stat-box"><div class="label">Today income</div><div class="value money pos">${money(daily.income)}</div></div>
      <div class="stat-box"><div class="label">Today expense</div><div class="value money neg">${money(daily.expense)}</div></div>
      <div class="stat-box stat-box-full"><div class="label">Today net</div><div class="value money ${daily.net >= 0 ? "pos" : "neg"}">${money(daily.net, { sign: true })}</div></div>
    </div>
    <button class="btn-primary" data-nav="expenses-add">Quick add</button>
    <section class="card">
      <div class="cat-header">
        <div class="cat-header-top">
          <h3>${categoryTitle}</h3>
          ${categoryFilterButton()}
          <button class="cat-dash-btn" data-nav="expenses-dash">View dashboard</button>
        </div>
        ${inlinePeriodTabs()}
      </div>
      ${categoryBars(filteredRows)}
    </section>
    <section class="card">
      <div class="section-title"><h3>Money flow</h3><button data-nav="expenses-dash">View dashboard</button></div>
      ${homeChart(filteredAllRows)}
    </section>
    <section class="card">
      <div class="section-title"><h3>Recent day-to-day</h3><button data-nav="expenses-dash">See all</button></div>
      ${historyRows(recent, false)}
    </section>
    ${categoryFilterSheet()}
  `;
}

export function availableHomeCategories(): string[] {
  const seen = new Set<string>();
  for (const row of manualRowsForSelectedRange()) {
    // In income mode, only ever list income categories (and vice versa) so
    // expense categories like Food / Entertainment never appear as income.
    if (row.direction !== appState.homeMode) continue;
    seen.add(String(row.category || "Other"));
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function activeHomeCategories(): string[] {
  const available = availableHomeCategories();
  if (!appState.categorySelectionTouched) {
    appState.selectedHomeCategories = new Set(available);
  }
  return available.filter((category) => appState.selectedHomeCategories.has(category));
}

function filteredHomeRows(): PersonalFinanceRecord[] {
  const selected = new Set(activeHomeCategories());
  return manualRowsForSelectedRange().filter((row) => row.direction === appState.homeMode && selected.has(String(row.category || "Other")));
}

function rangeLabel(range: typeof appState.homeRange): string {
  if (range === "week") return "Recent";
  if (range === "month") return "Daily";
  if (range === "year") return "Yearly";
  return "Selected";
}

/** Compact period tab row for the category card header (no wrapper card/padding). */
function inlinePeriodTabs(): string {
  const ranges = ["week", "month", "year", "custom"] as const;
  const tabs = ranges.map((r) =>
    `<button class="${appState.homeRange === r ? "active" : ""}" data-home-range="${r}">${r[0].toUpperCase()}${r.slice(1)}</button>`
  ).join("");
  const customRange = appState.homeRange === "custom"
    ? `<div class="custom-range" style="margin-top:8px;"><label>From<input type="date" value="${appState.customStart}" data-custom-start></label><label>To<input type="date" value="${appState.customEnd}" data-custom-end></label></div>`
    : "";
  return `<div class="segmented graph-tabs period-tabs cat-period-tabs">${tabs}</div>${customRange}`;
}

function filteredHomeAllDirectionsRows(): PersonalFinanceRecord[] {
  const selected = new Set(activeHomeCategories());
  return manualRowsForSelectedRange().filter((row) => selected.has(String(row.category || "Other")));
}

function manualRowsForSelectedRange(): PersonalFinanceRecord[] {
  const now = today();
  // For the category bars and stats, use the real period window — NOT the
  // 90-bucket chart history (which is just for scroll depth). Each range maps
  // to the window a user naturally expects when they pick "Week/Month/Year".
  if (appState.homeRange === "week") {
    // Rolling 7 days (today inclusive)
    const cutoff = toDateKey(addDays(now, -6));
    return manualPersonalFinanceRows().filter((row) => String(row.date ?? "") >= cutoff && String(row.date ?? "") <= toDateKey(now));
  }
  if (appState.homeRange === "month") {
    // Rolling 30 days (today inclusive)
    const cutoff = toDateKey(addDays(now, -29));
    return manualPersonalFinanceRows().filter((row) => String(row.date ?? "") >= cutoff && String(row.date ?? "") <= toDateKey(now));
  }
  if (appState.homeRange === "year") {
    // Rolling 12 calendar months
    const buckets = getPeriodBuckets("year");
    return manualPersonalFinanceRows().filter((row) => buckets.some((bucket) => matchesPeriod(bucket, String(row.date ?? ""))));
  }
  // custom: use the exact custom date range
  const buckets = getPeriodBuckets(appState.homeRange);
  return manualPersonalFinanceRows().filter((row) => buckets.some((bucket) => matchesPeriod(bucket, String(row.date ?? ""))));
}

function profilePrompt(): string {
  if (!shouldShowProfilePrompt()) {
    return "";
  }

  return `
    <section class="card profile-prompt">
      <div>
        <h3>Welcome to FinLedge</h3>
      </div>
      <form class="profile-form" data-profile-form>
        <input name="profileName" type="text" placeholder="Your name" autocomplete="name">
        <button class="btn-primary" type="submit">Save</button>
        <button class="btn-secondary" type="button" data-dismiss-profile>Later</button>
      </form>
    </section>
  `;
}

function categoryFilterButton(): string {
  const available = availableHomeCategories();
  const selected = new Set(activeHomeCategories());
  if (!available.length) {
    return `<span class="filter-empty">No categories</span>`;
  }
  const label = selected.size === available.length ? "All categories" : `${selected.size} selected`;
  return `<button type="button" class="filter-action" data-home-filter-open>${label}</button>`;
}

function categoryFilterSheet(): string {
  const available = availableHomeCategories();
  const selected = new Set(activeHomeCategories());
  if (!appState.homeFilterOpen || !available.length) return "";

  return `
    <div class="sheet-backdrop" data-home-filter-close></div>
    <section class="filter-sheet" role="dialog" aria-modal="true" aria-label="Filter home categories">
      <div class="filter-sheet-head">
        <div>
          <p class="eyebrow">Home filter</p>
          <h3>Show categories</h3>
        </div>
        <button type="button" class="icon-btn" data-home-filter-close aria-label="Close filter">×</button>
      </div>
      <div class="filter-option-list">
        <label class="filter-option">
          <span>
            <b>All categories</b>
          </span>
          <input type="checkbox" value="__all__" data-category-check ${selected.size === available.length ? "checked" : ""}>
        </label>
        ${available.map((category) => `
          <label class="filter-option ${selected.has(category) ? "active" : ""}">
            <span>
              <b>${escapeHtml(category)}</b>
            </span>
            <input type="checkbox" value="${escapeAttr(category)}" data-category-check ${selected.has(category) ? "checked" : ""}>
          </label>
        `).join("")}
      </div>
    </section>
  `;
}
