import { summarizeBankRecords } from "../../services/bank-category-totals.js";
import {
  addFormScreen,
  bottomNav,
  categoryBarsSection,
  getPeriodBuckets,
  historyRows,
  periodBarsChart,
  searchInput,
  sectionTitle,
  statGrid,
  type BarChartBucket,
} from "../components/shell.js";
import { bankRecords } from "../data/demo-data.js";

export function bankAddScreen(): string {
  return addFormScreen(
    "Bank Services",
    "Add bank entry",
    [
      ["Date", "date"],
      ["Category", "select", "Interest Earned"],
      ["Amount", "number"],
      ["Description (optional)", "text"],
    ],
    "Add bank entry",
    "bank-dash",
  );
}

export function bankDashboardScreen(): string {
  const summary = summarizeBankRecords(bankRecords);

  const chargeTotals = Object.entries(summary.category_totals ?? {})
    .filter(([cat]) => cat.toLowerCase() !== "interest earned")
    .map(([cat, val]) => ({ label: cat, value: Math.abs(Number(val)) }))
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value);

  // Period-aware bar chart — design.md §5 colors: pos=green, neg=red, net=teal/amber
  const buckets = getPeriodBuckets().map<BarChartBucket>((b) => {
    const net = bankRecords
      .filter((r) => b.isDay ? r.date === b.key : String(r.date).startsWith(b.key))
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const color = net >= 0 ? "var(--brand-teal)" : "var(--accent-amber)";
    return { label: b.label, sublabel: b.sublabel, value: net, color };
  });

  const rows = bankRecords.map((row) => ({
    ...row,
    amount: Number(row.amount),
    direction: Number(row.amount) >= 0 ? "income" : "expense",
    flow_type: "bank",
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

    ${periodBarsChart(
      "Bank services trend",
      buckets,
      [
        { label: "Net ≥ 0", color: "var(--brand-teal)" },
        { label: "Net < 0", color: "var(--accent-amber)" },
      ],
    )}

    <section class="card">
      ${sectionTitle("All transactions", "Filter")}
      ${searchInput("bank", "Search by category or description")}
      ${historyRows(rows, false, "bank")}
    </section>

    ${bottomNav("home", "bank-add")}
  `;
}
