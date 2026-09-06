import { isIncomeCategory, summarizeBankRecords, type BankRecord } from "../../services/bank-category-totals.js";
import { categoryBarsSection, periodGroupedBarsChart } from "../components/charts.js";
import { addFormScreen, sectionTitle } from "../components/forms.js";
import { historyRows } from "../components/history.js";
import { searchInput } from "../components/search.js";
import { statGrid } from "../components/stats.js";
import { bottomNav } from "../components/shell.js";
import { appState } from "../app-state.js";
import { bankRecords } from "../data/demo-data.js";
import { getPeriodBuckets, matchesPeriod } from "../utils/periods.js";
import type { ChartBucket } from "../types.js";

export function bankAddScreen(): string {
  return addFormScreen(
    "Bank Services",
    "Add bank entry",
    [
      ["Date", "date", "", "date"],
      ["Category", "select", "Interest Earned", "category"],
      ["Amount", "number", "", "amount"],
      ["Description (optional)", "text", "", "description"],
    ],
    "Add bank entry",
    "bank-dash",
    "bank-add",
  );
}

export function bankDashboardScreen(): string {
  const summary = summarizeBankRecords(bankRecords);

  const chargeTotals = Object.entries(summary.category_totals ?? {})
    .filter(([cat]) => cat.toLowerCase() !== "interest earned")
    .map(([cat, val]) => ({ label: cat, value: Math.abs(Number(val)) }))
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value);

  const trendBuckets = buildBankTrendBuckets(bankRecords);

  const rows = bankRecords.map((row) => ({
    ...row,
    amount: Number(row.amount),
    direction: Number(row.amount) >= 0 ? "income" : "expense",
    flow_type: "bank",
    _table: "bank_transactions",
    _id: row.id,
  }));

  return `
    <p class="eyebrow">Bank Services</p>
    <h1 class="pagehead">Bank services dashboard</h1>
    <p class="sub">Interest, charges, and net balance across your accounts.</p>

    ${statGrid(
      [
        ["Interest earned", summary.total_income, "pos"],
        ["Total charges", summary.total_expenses, "neg"],
        ["Net balance", summary.net_balance, summary.net_balance >= 0 ? "pos" : "neg"],
      ],
      2,
      true,
    )}

    ${categoryBarsSection("Charges by category", chargeTotals, "var(--brand-teal)")}

    ${periodGroupedBarsChart("Bank services trend", trendBuckets, {
      ranges: ["month", "year", "custom"],
      activeRange: appState.bankRange,
      rangeAttr: "data-bank-range",
    })}

    <section class="card">
      ${sectionTitle("All transactions", "Filter")}
      ${searchInput("bank", "Search by category or description")}
      ${historyRows(rows, false, "bank")}
    </section>

    ${bottomNav("home", "bank-add")}
  `;
}

function buildBankTrendBuckets(records: BankRecord[]): ChartBucket[] {
  return getPeriodBuckets(appState.bankRange, true).map((b) => {
    let income = 0;
    let expense = 0;
    for (const record of records) {
      if (!matchesPeriod(b, String(record.date ?? ""))) continue;
      const amount = Number(record.amount ?? 0);
      const category = String(record.category ?? "");
      if (isIncomeCategory(category)) {
        income += amount;
      } else {
        expense += Math.abs(amount);
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
