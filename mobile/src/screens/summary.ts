import { summarizeBankRecords } from "../../services/bank-category-totals.js";
import { summarizeShareRecords } from "../../services/share-fifo-lot-matching.js";
import { summarizePersonalFinanceRecords } from "../../services/personal-finance-sync-row-computation.js";
import { periodBarsChart, type BarChartBucket } from "../components/charts.js";
import { historyRows } from "../components/history.js";
import { searchInput } from "../components/search.js";
import { statGrid } from "../components/stats.js";
import { bottomNav } from "../components/shell.js";
import { getPeriodBuckets } from "../utils/periods.js";
import { bankRecords, shareRecords } from "../data/demo-data.js";
import { currentPersonalFinanceRows } from "../data/mobile-data.js";
import { money } from "../utils/format.js";

export function summaryScreen(): string {
  const bank   = summarizeBankRecords(bankRecords);
  const shares = summarizeShareRecords(shareRecords);
  const pf     = summarizePersonalFinanceRecords(currentPersonalFinanceRows());
  const overall = bank.net_balance + shares.grand_profit_loss + pf.combined.overall_net;

  const trendBuckets = buildSummaryTrendBuckets(bank.net_balance, shares.grand_profit_loss, pf.combined.overall_net);

  return `
    <p class="eyebrow">Financial Summary</p>
    <h1 class="pagehead">Overall position</h1>

    ${statGrid([
      ["Bank net",     bank.net_balance,          bank.net_balance          >= 0 ? "pos" : "neg"],
      ["Share P/L",   shares.grand_profit_loss,   shares.grand_profit_loss  >= 0 ? "pos" : "neg"],
      ["Expenses net",pf.combined.overall_net,    pf.combined.overall_net   >= 0 ? "pos" : "neg"],
      ["Overall net", overall,                    overall                   >= 0 ? "pos" : "neg"],
    ])}

    ${periodBarsChart(
      "Net worth trend",
      trendBuckets,
      [
        { label: "Net ≥ 0", color: "var(--brand-teal)"   },
        { label: "Net < 0", color: "var(--accent-amber)" },
      ],
    )}

    <section class="card">
      <h3>Where it comes from</h3>
      <table class="mini">
        <tr><th>Source</th><th style="text-align:right;">Net</th></tr>
        ${[
          ["Bank Services",     bank.net_balance],
          ["Share Portfolio",   shares.grand_profit_loss],
          ["Personal Expenses", pf.combined.overall_net],
        ].map(([label, val]) => {
          const n   = Number(val);
          const col = n >= 0 ? "var(--brand-teal)" : "var(--accent-amber)";
          return `<tr><td>${label}</td><td style="color:${col};font-variant-numeric:tabular-nums;">${money(n, { sign: true })}</td></tr>`;
        }).join("")}
      </table>
    </section>

    <section class="card">
      <div class="section-title"><h3>All history</h3></div>
      ${searchInput("summary", "Search all records")}
      ${historyRows(summaryHistoryRows(), false, "summary", { actions: false })}
    </section>

    ${bottomNav("home")}
  `;
}

/**
 * Period-aware net worth trend.
 * Net ≥ 0 → brand-teal, Net < 0 → accent-amber (design.md §5).
 */
function buildSummaryTrendBuckets(bankNet: number, sharesPL: number, pfNet: number): BarChartBucket[] {
  const todayKey   = new Date().toISOString().slice(0, 10);
  const todayMonth = todayKey.slice(0, 7);
  return getPeriodBuckets().map<BarChartBucket>((b) => {
    const isCurrent = b.isDay ? b.key === todayKey : b.key === todayMonth;
    const net   = isCurrent ? bankNet + sharesPL + pfNet : 0;
    const color = net >= 0 ? "var(--brand-teal)" : "var(--accent-amber)";
    return { label: b.label, sublabel: b.sublabel, value: net, color };
  });
}

function summaryHistoryRows(): Array<Record<string, unknown>> {
  const bankRows = bankRecords.map((row) => ({
    description: row.description || row.category || "Bank entry",
    category: "Bank Services",
    amount: Math.abs(Number(row.amount ?? 0)),
    direction: Number(row.amount ?? 0) >= 0 ? "income" : "expense",
    date: row.date,
    created_timestamp: row.created_timestamp ?? row.timestamp,
    last_updated_timestamp: row.last_updated_timestamp,
    _id: row.id,
  }));

  const shareRows = shareRecords.map((row) => {
    const category = String(row.category ?? "").trim();
    const shareName = String(row.share_name ?? "").trim().toUpperCase();
    const profit = Number(row.profit_loss ?? 0);
    return {
      description: shareName ? `${shareName} ${category}` : category || "Share entry",
      category: "Share Portfolio",
      amount: Math.abs(Number(row.total_amount ?? 0)),
      direction: profit >= 0 ? "income" : "expense",
      date: row.date,
      created_timestamp: row.created_timestamp ?? row.timestamp,
      last_updated_timestamp: row.last_updated_timestamp,
      _id: row.id,
    };
  });

  const personalRows = currentPersonalFinanceRows().map((row) => {
    const signed = Number(row.signed_amount ?? 0);
    const direction = row.source === "transfer"
      ? (signed >= 0 ? "income" : "expense")
      : row.direction;
    return {
      description: row.description || row.category || "Personal entry",
      category: row.source === "transfer" ? "Transfer" : "Personal Expenses",
      amount: Math.abs(Number(row.amount ?? 0)),
      direction,
      date: row.date,
      created_timestamp: row.created_timestamp ?? row.timestamp,
      last_updated_timestamp: row.last_updated_timestamp,
      _id: row.id,
    };
  });

  return [...bankRows, ...shareRows, ...personalRows];
}
