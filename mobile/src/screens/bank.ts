import { summarizeBankRecords } from "../../services/bank-category-totals.js";
import { addFormScreen, dashboardScreen, historyRows, periodControls } from "../components/shell.js";
import { bankRecords } from "../data/demo-data.js";

export function bankAddScreen(): string {
  return addFormScreen(
    "Bank Services",
    "Add bank service entry",
    [
      ["Date", "date"],
      ["Category", "select", "Interest Earned"],
      ["Amount", "number"],
      ["Description (optional)", "text"],
    ],
    "Add Bank Service Entry",
    "bank-dash",
  );
}

export function bankDashboardScreen(): string {
  const summary = summarizeBankRecords(bankRecords);
  const rows = bankRecords.map((row) => ({
    ...row,
    amount: Math.abs(Number(row.amount)),
    direction: Number(row.amount) >= 0 ? "income" : "expense",
    flow_type: "bank",
  }));

  return dashboardScreen(
    "Bank Services",
    "Bank services dashboard",
    [
      ["Interest earned", summary.total_income, "pos"],
      ["Total charges", summary.total_expenses, "neg"],
      ["Net balance", summary.net_balance, summary.net_balance >= 0 ? "pos" : "neg"],
    ],
    `${periodControls(["month", "year", "custom"])}${historyRows(rows)}`,
    "bank-add",
  );
}
