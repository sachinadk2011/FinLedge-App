import { summarizeBankRecords } from "../../services/bank-category-totals.js";
import { summarizeShareRecords } from "../../services/share-fifo-lot-matching.js";
import { summarizePersonalFinanceRecords } from "../../services/personal-finance-sync-row-computation.js";
import {
  bottomNav,
  getPeriodBuckets,
  periodBarsChart,
  statGrid,
  type BarChartBucket,
} from "../components/shell.js";
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
    <p class="sub">Combines Bank Services, Share Portfolio, and manual Personal Expenses — the full picture Home doesn't show.</p>

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
