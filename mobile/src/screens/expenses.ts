import { summarizePersonalFinanceRecords } from "../../services/personal-finance-sync-row-computation.js";
import { periodGroupedBarsChart } from "../components/charts.js";
import { formCard } from "../components/forms.js";
import { historyRows } from "../components/history.js";
import { searchInput } from "../components/search.js";
import { statGrid, type StatTone } from "../components/stats.js";
import { bottomNav } from "../components/shell.js";
import { appState } from "../app-state.js";
import { personalFinanceRowsForView, personalFinanceSummaryRows } from "../data/mobile-data.js";
import { money } from "../utils/format.js";
import { getPeriodBuckets, matchesPeriod } from "../utils/periods.js";
import type { ChartBucket } from "../types.js";

import type { PersonalFinanceRecord } from "../../services/personal-finance-sync-row-computation.js";

type ExpensesHistoryFilter = typeof appState.expensesHistoryFilter;
type ExpenseStat = [string, number, StatTone];

export function expensesAddScreen(): string {
  const draft = appState.expensesAddDraft;
  return `
    <p class="eyebrow">Personal Expenses</p>
    <h1 class="pagehead">Add expense entry</h1>

    <div class="transfer-chip" data-nav="transfer" role="button" style="cursor:pointer;">
      <div class="tc-icon">⇄</div>
      <div class="tc-body"><b>Record a transfer</b><span>Cash to Bank or Bank to Cash</span></div>
      <span style="color:var(--text-3);">›</span>
    </div>

    ${formCard(
      [
        ["Date", "date", draft.date ?? "", "date"],
        ["Flow", "select", draft.flow ?? "Bank Flow", "flow"],
        ["Type", "select", draft.type ?? "Expense", "type"],
        ["Category", "select", draft.category ?? "Food", "category"],
        ["Amount", "number", "", "amount"],
        ["Description (optional)", "text", "", "description"],
      ],
      "Add expense entry",
      "expenses-add",
    )}
    ${bottomNav("home", "expenses-dash")}
  `;
}

export function expensesDashboardScreen(): string {
  const tab = appState.expensesDashTab;
  const rows = personalFinanceRowsForView(tab);
  const summary = summarizePersonalFinanceRecords(personalFinanceSummaryRows());
  const tabRows = rows;
  const trendBuckets = buildExpensesTrendBuckets(tabRows);

  return `
    <p class="eyebrow">Personal Expenses</p>
    <h1 class="pagehead">Expenses dashboard</h1>

    <div class="segmented alt" style="margin-bottom:10px;">
      <button class="${tab === "combined" ? "active" : ""}" data-expenses-tab="combined">Combined</button>
      <button class="${tab === "bank" ? "active" : ""}" data-expenses-tab="bank">Bank flow</button>
      <button class="${tab === "cash" ? "active" : ""}" data-expenses-tab="cash">Cash flow</button>
    </div>

    <section class="card">
      ${tab === "combined"
        ? `${statGrid([
            ["Income", summary.combined.overall_income, "pos"],
            ["Expenses", summary.combined.overall_expenses, "neg"],
            ["Bank net", summary.bank.net, summary.bank.net >= 0 ? "pos" : "neg"],
            ["Cash net", summary.cash.net, summary.cash.net >= 0 ? "pos" : "neg"],
          ])}
          <div class="stat-box stat-box-full" style="margin-top:10px;text-align:center;">
            <div class="label">Overall net / savings</div>
            <div class="value money ${summary.combined.overall_net >= 0 ? "pos" : "neg"}" style="font-size:20px;">${money(summary.combined.overall_net, { sign: true })}</div>
          </div>`
        : tab === "bank"
          ? statGrid([
              ["Income", summary.bank.income, summary.bank.income >= 0 ? "pos" : "neg"],
              ["Expense", summary.bank.expenses, "neg"],
              ...(summary.bank.transfer_out > 0 ? [["Transferred to Cash", summary.bank.transfer_out, "neg"] as ExpenseStat] : []),
              ...(summary.bank.transfer_in > 0 ? [["Received from Cash", summary.bank.transfer_in, "pos"] as ExpenseStat] : []),
              ["Net profit/loss", summary.bank.net, summary.bank.net >= 0 ? "pos" : "neg"],
            ])
          : statGrid([
              ["Income", summary.cash.income, summary.cash.income >= 0 ? "pos" : "neg"],
              ["Expense", summary.cash.total_expenses, "neg"],
              ...(summary.cash.transfer_out > 0 ? [["Transferred to Bank", summary.cash.transfer_out, "neg"] as ExpenseStat] : []),
              ...(summary.cash.transfer_in > 0 ? [["Received from Bank", summary.cash.transfer_in, "pos"] as ExpenseStat] : []),
              ["Net profit/loss", summary.cash.net, summary.cash.net >= 0 ? "pos" : "neg"],
            ])}
    </section>

    ${periodGroupedBarsChart("Money flow trend", trendBuckets)}

    ${historySection(tab)}
    ${expenseFilterSheet()}
    ${bottomNav("home", "expenses-add")}
  `;
}

/** History list: personal/bank-flow entries plus recorded transfers. */
function historySection(tab: "combined" | "bank" | "cash"): string {
  const rows = personalFinanceRowsForView(tab).map((row) => ({
    ...row,
    direction: row.source === "transfer" ? (Number(row.signed_amount ?? 0) >= 0 ? "income" : "expense") : row.direction,
    _table: row.source === "manual"
      ? (row.flow_type === "bank" ? "personal_finance_bank_flow" : "personal_finance_cash_flow")
      : row.source === "transfer"
        ? "transfers"
        : undefined,
    _id: row.source === "manual" || row.source === "transfer" ? row.id : undefined,
  }));
  const filter = validExpensesFilter(tab, appState.expensesHistoryFilter);
  const merged = applyExpensesHistoryFilter(rows, filter);
  const options = expensesHistoryFilters(tab);
  const filterLabel = options.find((option) => option.value === filter)?.label ?? "Filter";

  return `
    <section class="card">
      <div class="section-title">
        <h3>Transfer &amp; transaction history</h3>
        <button type="button" class="filter-action" data-expenses-filter-open>${filterLabel}</button>
      </div>
      ${searchInput("expenses", "Search by category or description")}
      ${historyRows(merged, false, "expenses")}
    </section>
  `;
}

function expensesHistoryFilters(tab: "combined" | "bank" | "cash"): Array<{ value: ExpensesHistoryFilter; label: string; note: string }> {
  if (tab === "bank") {
    return [
      { value: "all", label: "All bank", note: "Bank entries and activity" },
      { value: "bank-manual", label: "Bank entries", note: "Personal bank flow" },
      { value: "transfers", label: "Transfers", note: "Bank and Cash moves" },
    ];
  }
  if (tab === "cash") {
    return [
      { value: "all", label: "All cash", note: "Cash entries and transfers" },
      { value: "cash-manual", label: "Cash entries", note: "Personal cash flow" },
      { value: "transfers", label: "Transfers", note: "Cash and Bank moves" },
    ];
  }
  return [
    { value: "all", label: "All", note: "Bank, Cash, transfers" },
    { value: "bank-manual", label: "Bank entries", note: "Personal bank flow" },
    { value: "cash-manual", label: "Cash entries", note: "Personal cash flow" },
    { value: "transfers", label: "Transfers", note: "Cash and Bank moves" },
  ];
}

function expenseFilterSheet(): string {
  if (!appState.expensesFilterOpen) return "";
  return `
    <div class="sheet-backdrop" data-expenses-filter-close></div>
    <section class="filter-sheet" role="dialog" aria-modal="true" aria-label="Filter expenses history">
      <div class="filter-sheet-head">
        <div>
          <p class="eyebrow">History filter</p>
          <h3>Show entries</h3>
        </div>
        <button type="button" class="icon-btn" data-expenses-filter-close aria-label="Close filter">×</button>
      </div>
      <div class="filter-option-list">
        ${expensesHistoryFilters(appState.expensesDashTab).map((option) => `
          <button type="button" class="filter-option ${option.value === validExpensesFilter(appState.expensesDashTab, appState.expensesHistoryFilter) ? "active" : ""}" data-expenses-filter="${option.value}">
            <span>
              <b>${option.label}</b>
            </span>
            <i>${option.value === appState.expensesHistoryFilter ? "Selected" : ""}</i>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function applyExpensesHistoryFilter(rows: Array<Record<string, unknown>>, filter: ExpensesHistoryFilter): Array<Record<string, unknown>> {
  if (filter === "all") return rows;
  return rows.filter((row) => {
    const source = String(row.source ?? "").toLowerCase();
    const flow = String(row.flow_type ?? "").toLowerCase();
    if (filter === "bank-manual") return source === "manual" && flow === "bank";
    if (filter === "cash-manual") return source === "manual" && flow === "cash";
    return flow === "transfer";
  });
}

function validExpensesFilter(tab: "combined" | "bank" | "cash", filter: ExpensesHistoryFilter): ExpensesHistoryFilter {
  return expensesHistoryFilters(tab).some((option) => option.value === filter) ? filter : "all";
}

function buildExpensesTrendBuckets(rows: PersonalFinanceRecord[]): ChartBucket[] {
  return getPeriodBuckets().map((b) => {
    let income = 0;
    let expense = 0;
    for (const row of rows) {
      if (!matchesPeriod(b, String(row.date ?? ""))) continue;
      const amount = Number(row.amount ?? 0);
      if (row.direction === "income") {
        income += amount;
      } else if (row.source === "transfer") {
        const signed = Number(row.signed_amount ?? 0);
        if (signed >= 0) income += amount;
        else expense += amount;
      } else {
        expense += amount;
      }
    }
    return {
      label: b.label,
      sublabel: b.sublabel,
      key: b.key,
      income,
      expense,
      net: income - expense,
    };
  });
}
