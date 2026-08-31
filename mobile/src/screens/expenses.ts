import { summarizePersonalFinanceRecords } from "../../services/personal-finance-sync-row-computation.js";
import {
  bottomNav,
  formCard,
  getPeriodBuckets,
  historyRows,
  periodBarsChart,
  searchInput,
  sectionTitle,
  statGrid,
  type BarChartBucket,
} from "../components/shell.js";
import { appState } from "../app-state.js";
import { transferRows } from "../data/demo-data.js";
import { currentPersonalFinanceRows } from "../data/mobile-data.js";
import { money } from "../utils/format.js";

import type { PersonalFinanceRecord } from "../../services/personal-finance-sync-row-computation.js";

export function expensesAddScreen(): string {
  return `
    <p class="eyebrow">Personal Expenses</p>
    <h1 class="pagehead">Add expense entry</h1>
    <p class="sub">Log day-to-day bank-flow or cash-flow income and expenses.</p>

    <div class="transfer-chip" data-nav="transfer" role="button" style="cursor:pointer;">
      <div class="tc-icon">⇄</div>
      <div class="tc-body"><b>Record a transfer instead?</b><span>Cash ⇄ Bank — kept separate from income/expense</span></div>
      <span style="color:var(--text-3);">›</span>
    </div>

    ${formCard(
      [
        ["Date", "date"],
        ["Flow", "select", "Bank Flow"],
        ["Type", "select", "Expense"],
        ["Category", "select", "Food"],
        ["Amount", "number"],
        ["Description (optional)", "text"],
      ],
      "Add expense entry",
    )}
    ${bottomNav("home", "expenses-dash")}
  `;
}

export function expensesDashboardScreen(): string {
  const rows = currentPersonalFinanceRows();
  const summary = summarizePersonalFinanceRecords(rows);
  const tab = appState.expensesDashTab;

  // Filter rows by selected tab
  const tabRows = tab === "bank"
    ? rows.filter((r) => r.flow_type === "bank")
    : tab === "cash"
      ? rows.filter((r) => r.flow_type === "cash")
      : rows;

  // Monthly trend bars: past 5 months income/expense net
  const trendBuckets = buildExpensesTrendBuckets(rows);

  // Transfer notice (latest transfer)
  const transfer = transferRows[0];

  return `
    <p class="eyebrow">Personal Expenses</p>
    <h1 class="pagehead">Expenses dashboard</h1>
    <p class="sub">Combines manual Personal Expenses with live Bank Flow (Bank Services + Share activity).</p>

    <!-- Combined / Bank flow / Cash flow tab -->
    <div class="segmented alt" style="margin-bottom:10px;">
      <button class="${tab === "combined" ? "active" : ""}" data-expenses-tab="combined">Combined</button>
      <button class="${tab === "bank" ? "active" : ""}" data-expenses-tab="bank">Bank flow</button>
      <button class="${tab === "cash" ? "active" : ""}" data-expenses-tab="cash">Cash flow</button>
    </div>

    <!-- Stats card with transfer notice + grid -->
    <section class="card">
      <div class="transfer-chip">
        <div class="tc-icon">⇄</div>
        <div class="tc-body"><b>Cash → Bank transfer</b><span>Shown here, excluded from income/expense totals</span></div>
        <div class="money neu">${money(transfer?.amount ?? 0)}</div>
      </div>
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
              ["Bank income", summary.bank.income, "pos"],
              ["Bank expense", summary.bank.expenses, "neg"],
              ["Investment income", summary.bank.investment_income, "pos"],
              ["Investment expense", summary.bank.investment_expense, "neg"],
              ["Interest earned", summary.bank.interest_earned, "pos"],
              ["Service cost", summary.bank.service_cost, "neg"],
              ["Total income", summary.bank.total_income, "pos"],
              ["Total expense", summary.bank.total_expenses, "neg"],
              ["Bank net", summary.bank.net, summary.bank.net >= 0 ? "pos" : "neg"],
            ])
          : statGrid([
              ["Cash income", summary.cash.total_income, "pos"],
              ["Cash expense", summary.cash.total_expenses, "neg"],
              ["Cash net", summary.cash.net, summary.cash.net >= 0 ? "pos" : "neg"],
            ])}
    </section>

    ${periodBarsChart(
      "Monthly trend",
      trendBuckets,
      [
        { label: "Net ≥ 0", color: "var(--brand-teal)" },
        { label: "Net < 0", color: "var(--accent-amber)" },
      ],
    )}

    <!-- All transactions -->
    <section class="card">
      ${sectionTitle("All transactions", "Filter")}
      ${searchInput("expenses", "Search by category or description")}
      ${historyRows(tabRows, false, "expenses")}
    </section>

    ${bottomNav("home", "expenses-add")}
  `;
}

/** 12-month net trend. Teal = net positive, red = net negative. Current month last (rightmost). */
function buildExpensesTrendBuckets(rows: PersonalFinanceRecord[]): BarChartBucket[] {
  return getPeriodBuckets().map<BarChartBucket>((b) => {
    let income = 0, expense = 0;
    for (const r of rows) {
      const matches = b.isDay ? r.date === b.key : String(r.date).startsWith(b.key);
      if (!matches) continue;
      if (r.direction === "income") income += Number(r.amount ?? 0);
      else expense += Number(r.amount ?? 0);
    }
    const net = income - expense;
    const color = net >= 0 ? "var(--brand-teal)" : "var(--accent-amber)";
    return { label: b.label, sublabel: b.sublabel, value: net, color };
  });
}

