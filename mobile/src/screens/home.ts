import { appState, shouldShowProfilePrompt } from "../app-state.js";
import { categoryBars, homeChart } from "../components/home-chart.js";
import { historyRows, periodControls } from "../components/shell.js";
import {
  currentMonthTotals,
  manualRowsForCurrentMonth,
  sumRows,
  todayTotals,
} from "../data/mobile-data.js";
import type { PersonalFinanceRecord } from "../../services/personal-finance-sync-row-computation.js";
import { monthLabel, today } from "../utils/date.js";
import { money } from "../utils/format.js";

export function homeScreen(): string {
  const monthly = currentMonthTotals();
  const daily = todayTotals();
  const filteredRows = filteredHomeRows();
  const filteredAllRows = filteredHomeAllDirectionsRows();
  const selectedTotal = sumRows(filteredRows);
  const recent = [...filteredRows].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 4);
  const currentMonthLabel = monthLabel(today());

  return `
    ${profilePrompt()}
    <section class="card balance-card">
      <div class="segmented">
        <button class="${appState.homeMode === "expense" ? "active" : ""}" data-home-mode="expense">Expense</button>
        <button class="${appState.homeMode === "income" ? "active" : ""}" data-home-mode="income">Income</button>
      </div>
      <div class="metric-row"><div><div class="metric-label">${currentMonthLabel} net balance</div><div class="money big ${monthly.net >= 0 ? "pos" : "neg"}">${money(monthly.net, { sign: true })}</div></div></div>
      <div class="split split-3"><div><span>Total income</span><b class="money pos">${money(monthly.income)}</b></div><div><span>Total expense</span><b class="money neg">${money(monthly.expense)}</b></div><div><span>Selected ${appState.homeMode}</span><b class="money ${appState.homeMode === "income" ? "pos" : "neg"}">${money(selectedTotal)}</b></div></div>
    </section>
    <div class="stat-grid stat-grid-spaced">
      <div class="stat-box"><div class="label">Today income</div><div class="value money pos">${money(daily.income)}</div></div>
      <div class="stat-box"><div class="label">Today expense</div><div class="value money neg">${money(daily.expense)}</div></div>
      <div class="stat-box stat-box-full"><div class="label">Today net</div><div class="value money ${daily.net >= 0 ? "pos" : "neg"}">${money(daily.net, { sign: true })}</div></div>
    </div>
    <button class="btn-primary" data-nav="expenses-add">Quick add</button>
    <section class="card">
      <div class="section-title"><h3>${currentMonthLabel} categories</h3><button data-nav="expenses-dash">View dashboard</button></div>
      ${categoryPicker()}
      ${categoryBars(filteredRows)}
    </section>
    <section class="card">
      <div class="section-title"><h3>Money flow</h3><button data-nav="expenses-dash">View dashboard</button></div>
      ${periodControls(["week", "month", "year", "custom"], { wrap: false })}
      ${homeChart(filteredAllRows)}
    </section>
    <section class="card">
      <div class="section-title"><h3>Recent day-to-day</h3><button data-nav="expenses-dash">See all</button></div>
      ${historyRows(recent, false)}
    </section>
  `;
}

export function availableHomeCategories(): string[] {
  const seen = new Set<string>();
  for (const row of manualRowsForCurrentMonth()) {
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
  return manualRowsForCurrentMonth().filter((row) => row.direction === appState.homeMode && selected.has(String(row.category || "Other")));
}

function filteredHomeAllDirectionsRows(): PersonalFinanceRecord[] {
  const selected = new Set(activeHomeCategories());
  return manualRowsForCurrentMonth().filter((row) => selected.has(String(row.category || "Other")));
}

function profilePrompt(): string {
  if (!shouldShowProfilePrompt()) {
    return "";
  }

  return `
    <section class="card profile-prompt">
      <div>
        <h3>Welcome to FinLedge</h3>
        <p class="sub">Set your name for the greeting and profile initials on this phone.</p>
      </div>
      <form class="profile-form" data-profile-form>
        <input name="profileName" type="text" placeholder="Your name" autocomplete="name">
        <button class="btn-primary" type="submit">Save</button>
        <button class="btn-secondary" type="button" data-dismiss-profile>Later</button>
      </form>
    </section>
  `;
}

function categoryPicker(): string {
  const available = availableHomeCategories();
  const selected = new Set(activeHomeCategories());
  if (!available.length) {
    return `<p class="sub">No categories have entries for ${monthLabel(today())} yet.</p>`;
  }

  return `
    <details class="category-dropdown">
      <summary><span>Categories shown</span><b>${selected.size === available.length ? "All with entries" : `${selected.size} selected`}</b></summary>
      <label><input type="checkbox" value="__all__" data-category-check ${selected.size === available.length ? "checked" : ""}> All categories with entries</label>
      ${available.map((category) => `<label><input type="checkbox" value="${category}" data-category-check ${selected.has(category) ? "checked" : ""}> ${category}</label>`).join("")}
    </details>
  `;
}
