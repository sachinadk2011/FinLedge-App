import { summarizePersonalFinanceRecords } from "../../services/personal-finance-sync-row-computation.js";
import { toNumber } from "../../services/bank-category-totals.js";
import { periodGroupedBarsChart } from "../components/charts.js";
import { formCard, sectionTitle } from "../components/forms.js";
import { historyRows } from "../components/history.js";
import { searchInput } from "../components/search.js";
import { statGrid } from "../components/stats.js";
import { bottomNav } from "../components/shell.js";
import { appState } from "../app-state.js";
import { transferRows } from "../data/demo-data.js";
import { currentPersonalFinanceRows, transferAdjustments } from "../data/mobile-data.js";
import { money } from "../utils/format.js";
import { getPeriodBuckets, matchesPeriod } from "../utils/periods.js";
import type { ChartBucket } from "../types.js";

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
        ["Date", "date", "", "date"],
        ["Flow", "select", "Bank Flow", "flow"],
        ["Type", "select", "Expense", "type"],
        ["Category", "select", "Food", "category"],
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
  const rows = currentPersonalFinanceRows();
  const summary = summarizePersonalFinanceRecords(rows);
  const tab = appState.expensesDashTab;

  const tabRows = tab === "bank"
    ? rows.filter((r) => r.flow_type === "bank")
    : tab === "cash"
      ? rows.filter((r) => r.flow_type === "cash")
      : rows;

  // A recorded transfer moves money between the Cash and Bank flows: the flow
  // balances below include the net effect so the income section reflects it.
  const transferShift = transferAdjustments(transferRows);
  const bankBalance = summary.bank.net + transferShift.bank;
  const cashBalance = summary.cash.net + transferShift.cash;

  const trendBuckets = buildExpensesTrendBuckets(tabRows);

  return `
    <p class="eyebrow">Personal Expenses</p>
    <h1 class="pagehead">Expenses dashboard</h1>
    <p class="sub">Combines manual Personal Expenses with live Bank Flow (Bank Services + Share activity).</p>

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
            ["Bank balance", bankBalance, bankBalance >= 0 ? "pos" : "neg"],
            ["Cash balance", cashBalance, cashBalance >= 0 ? "pos" : "neg"],
          ])}
          <div class="stat-box stat-box-full" style="margin-top:10px;text-align:center;">
            <div class="label">Overall net / savings</div>
            <div class="value money ${summary.combined.overall_net >= 0 ? "pos" : "neg"}" style="font-size:20px;">${money(summary.combined.overall_net, { sign: true })}</div>
            <div class="label sub" style="margin-top:4px;">Balances include net transfers (cash ⇄ bank)</div>
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
              ["Bank balance", bankBalance, bankBalance >= 0 ? "pos" : "neg"],
            ])
          : statGrid([
              ["Cash income", summary.cash.total_income, "pos"],
              ["Cash expense", summary.cash.total_expenses, "neg"],
              ["Cash balance", cashBalance, cashBalance >= 0 ? "pos" : "neg"],
            ])}
    </section>

    ${periodGroupedBarsChart("Money flow trend", trendBuckets)}

    ${historySection(tab)}
    ${bottomNav("home", "expenses-add")}
  `;
}

/** History list: personal/bank-flow entries plus recorded transfers. */
function historySection(tab: "combined" | "bank" | "cash"): string {
  const transferRowsFor = (rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> =>
    rows
      .filter((row) => {
        if (tab === "combined") return true;
        const from = String(row.from_flow ?? "");
        const to = String(row.to_flow ?? "");
        return from === tab || to === tab;
      })
      .map((row) => ({
        description: `${String(row.from_flow === "cash" ? "Cash" : "Bank")} → ${String(row.to_flow === "cash" ? "Cash" : "Bank")}`,
        category: "Transfer",
        amount: Math.abs(toNumber(row.amount)),
        direction: "neutral",
        _neutral: true,
        flow_type: "transfer",
        date: String(row.date ?? ""),
        _table: "transfers",
        _id: row.id,
      }));

  const transfers = transferRowsFor(transferRows as unknown as Array<Record<string, unknown>>);

  const rows = (() => {
    const base = currentPersonalFinanceRows();
    const scoped = tab === "bank" ? base.filter((r) => r.flow_type === "bank") : tab === "cash" ? base.filter((r) => r.flow_type === "cash") : base;
    return scoped.map((row) => ({
      ...row,
      _table: row.source === "manual" ? (row.flow_type === "bank" ? "personal_finance_bank_flow" : "personal_finance_cash_flow") : undefined,
      _id: row.source === "manual" ? row.id : undefined,
    }));
  })();

  const merged = [...transfers, ...rows].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));

  return `
    <section class="card">
      ${sectionTitle("Transfer & transaction history", "Filter")}
      ${searchInput("expenses", "Search by category or description")}
      ${historyRows(merged, false, "expenses")}
    </section>
  `;
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
