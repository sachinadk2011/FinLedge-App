import { summarizePersonalFinanceRecords } from "../../services/personal-finance-sync-row-computation.js";
import { bottomNav, dashboardScreen, formCard, historyRows, periodControls } from "../components/shell.js";
import { transferRows } from "../data/demo-data.js";
import { currentPersonalFinanceRows } from "../data/mobile-data.js";
import { money } from "../utils/format.js";

export function expensesAddScreen(): string {
  return `
    <p class="eyebrow">Personal Expenses</p>
    <h1 class="pagehead">Add expense entry</h1>
    <p class="sub">Log day-to-day bank-flow or cash-flow income and expenses.</p>
    <button class="btn-secondary" data-nav="transfer" style="margin-bottom:14px;">Record transfer</button>
    ${formCard(
      [
        ["Date", "date"],
        ["Flow", "select", "Bank Flow"],
        ["Type", "select", "Expense"],
        ["Category", "select", "Food"],
        ["Amount", "number"],
        ["Description (optional)", "text"],
      ],
      "Add Personal Expenses Entry",
    )}
    ${bottomNav("home", "expenses-dash")}
  `;
}

export function expensesDashboardScreen(): string {
  const rows = currentPersonalFinanceRows();
  const summary = summarizePersonalFinanceRecords(rows);

  return dashboardScreen(
    "Personal Expenses",
    "Personal expenses dashboard",
    [
      ["Overall income", summary.combined.overall_income, "pos"],
      ["Overall expenses", summary.combined.overall_expenses, "neg"],
      ["Overall net/savings", summary.combined.overall_net, summary.combined.overall_net >= 0 ? "pos" : "neg"],
      ["Bank net", summary.bank.net, summary.bank.net >= 0 ? "pos" : "neg"],
      ["Cash net", summary.cash.net, summary.cash.net >= 0 ? "pos" : "neg"],
      ["Bank income", summary.bank.income, "pos"],
      ["Bank expense", summary.bank.expenses, "neg"],
      ["Bank investment expense", summary.bank.investment_expense, "neg"],
      ["Bank investment income", summary.bank.investment_income, "pos"],
      ["Bank interest earned", summary.bank.interest_earned, "pos"],
      ["Bank service cost", summary.bank.service_cost, "neg"],
      ["Bank total income", summary.bank.total_income, "pos"],
      ["Bank total expense", summary.bank.total_expenses, "neg"],
      ["Cash income", summary.cash.total_income, "pos"],
      ["Cash expense", summary.cash.total_expenses, "neg"],
      ["Cash net profit/loss", summary.cash.net, summary.cash.net >= 0 ? "pos" : "neg"],
    ],
    `${periodControls(["week", "month", "year", "custom"])}${transferNotice()}${historyRows(rows)}`,
    "expenses-add",
  );
}

function transferNotice(): string {
  const transfer = transferRows[0];
  return `<div class="notice"><b>Cash to bank transfer</b><br><span>${money(transfer.amount)} / excluded from income and expense totals</span></div>`;
}
