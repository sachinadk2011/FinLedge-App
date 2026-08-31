import { summarizeShareRecords } from "../../services/share-fifo-lot-matching.js";
import {
  bottomNav,
  field,
  getPeriodBuckets,
  historyRows,
  periodBarsChart,
  searchInput,
  sectionTitle,
  statGrid,
  type BarChartBucket,
} from "../components/shell.js";

import { appState } from "../app-state.js";
import { shareRecords } from "../data/demo-data.js";
import { money } from "../utils/format.js";

export function sharesAddScreen(): string {
  const type = appState.sharesEntryType;
  const holdings = buildHoldingsTable();

  // Conditional field visibility based on entry type
  const showPerUnitPrice = ["ipo", "buy", "sell"].includes(type);
  const showAllotted     = ["ipo", "buy", "sell"].includes(type);
  const showTotalAmount  = type === "buy";
  const showAmount       = ["sip", "dividend"].includes(type);
  const showDividendType = type === "dividend";
  const showSipType      = type === "sip";
  const showSipShares    = type === "sip";

  return `
    <p class="eyebrow">Share Portfolio</p>
    <h1 class="pagehead">Add share entry</h1>
    <p class="sub">Track IPO, secondary, SIP and dividend activity.</p>

    <section class="card">
      <h3>Current holdings</h3>
      ${searchInput("shares-portfolio", "Filter by share name")}
      ${holdings}
    </section>

    <section class="card">
      <div class="field">
        <label>Entry type</label>
        <select data-shares-entry-type>
          <option value="ipo"      ${type === "ipo"      ? "selected" : ""}>IPO entry</option>
          <option value="sip"      ${type === "sip"      ? "selected" : ""}>SIP investment</option>
          <option value="buy"      ${type === "buy"      ? "selected" : ""}>Secondary buy</option>
          <option value="sell"     ${type === "sell"     ? "selected" : ""}>Sell shares</option>
          <option value="dividend" ${type === "dividend" ? "selected" : ""}>Dividend</option>
        </select>
      </div>
      ${field("Date", "date")}
      ${field("Share name", "text")}
      ${showPerUnitPrice  ? field("Per unit price", "number")    : ""}
      ${showAllotted      ? field("Quantity / Allotted", "number"): ""}
      ${showTotalAmount   ? field("Total Amount", "number")      : ""}
      ${showAmount        ? field("Amount", "number")             : ""}
      ${showDividendType  ? field("Dividend Type", "select", "cash")        : ""}
      ${showSipType       ? field("SIP type", "select", "installment")      : ""}
      ${showSipShares     ? field("Total SIP shares", "number")  : ""}
      <button class="btn-primary">Add share entry</button>
    </section>
    ${bottomNav("home", "shares-dash")}
  `;
}

export function sharesDashboardScreen(): string {
  const summary = summarizeShareRecords(shareRecords);
  const holdings = buildHoldingsTable();
  const trendBuckets = buildShareTrendBuckets();

  const rows = shareRecords.map((row) => ({
    description: `${String(row.share_name).toUpperCase()} · ${row.category}`,
    category: String(row.buy_sell ?? ""),
    amount: Number(row.total_amount),
    direction: Number(row.profit_loss ?? 0) >= 0 ? "income" : "expense",
    flow_type: "shares",
    date: row.date,
  }));

  return `
    <p class="eyebrow">Share Portfolio</p>
    <h1 class="pagehead">Share portfolio dashboard</h1>
    <p class="sub">IPO, secondary, SIP position and remaining holdings.</p>

    <section class="card">
      <h3>Portfolio (remaining)</h3>
      ${searchInput("shares-portfolio", "Search by share name")}
      ${holdings}
    </section>

    <section class="card">
      <h3>IPO &amp; secondary position</h3>
      ${statGrid([
        ["IPO invest",      summary.total_ipo_investment,  "neg"],
        ["Secondary buy",   summary.total_buy_amount,      "neg"],
        ["Total sell",      summary.total_sell_amount,     "pos"],
        ["Dividend",        summary.total_dividend,        "pos"],
        ["Realized profit", summary.total_profit,          summary.total_profit        >= 0 ? "pos" : "neg"],
        ["Overall P/L",     summary.overall_profit_loss,   summary.overall_profit_loss >= 0 ? "pos" : "neg"],
      ])}
    </section>

    <section class="card">
      <h3>SIP position</h3>
      ${statGrid(
        [
          ["Invested",        summary.total_sip_investment, "neg"],
          ["Redeemed",        summary.total_sip_redeemed,  "pos"],
          ["SIP profit/loss", summary.sip_profit_loss,     summary.sip_profit_loss >= 0 ? "pos" : "neg"],
        ],
        2,
        true,
      )}
    </section>

    <section class="card stat-card-purple">
      <h3>Grand total</h3>
      ${statGrid([
        ["Investment",  summary.grand_total_investment, "neg"],
        ["Profit/Loss", summary.grand_profit_loss,      summary.grand_profit_loss >= 0 ? "pos" : "neg"],
      ])}
    </section>

    ${periodBarsChart(
      "Portfolio value trend",
      trendBuckets,
      [{ label: "Share movement", color: "var(--accent-purple)" }],
    )}

    <section class="card">
      <h3>Update IPO allotment</h3>
      <p class="sub">Search an IPO share and update its allotted quantity after SQLite writes are enabled.</p>
      ${field("Search share (IPO only)", "text")}
      ${field("New allotment", "number")}
      <button class="btn-secondary">Update</button>
    </section>

    <section class="card">
      <h3>Update SIP shares</h3>
      <p class="sub">Search a SIP share and update the total SIP share quantity after SQLite writes are enabled.</p>
      ${field("Search share (SIP only)", "text")}
      ${field("Total SIP shares", "number")}
      <button class="btn-secondary">Update SIP</button>
    </section>

    <section class="card">
      ${sectionTitle("Transaction history", "Filter")}
      ${searchInput("shares", "Search by share name or type")}
      ${historyRows(rows, false, "shares")}
    </section>

    ${bottomNav("home", "shares-add")}
  `;
}

/** Remaining holdings table, derived from FIFO-matched share records. */
function buildHoldingsTable(): string {
  const holdings = new Map<string, number>();
  for (const row of shareRecords) {
    const name = String(row.share_name ?? "").toUpperCase();
    const qty  = Number(row.allotted ?? 0);
    holdings.set(name, (holdings.get(name) ?? 0) + (row.buy_sell === "sell" ? -qty : qty));
  }
  const query = (appState.dashSearchQuery["shares-portfolio"] ?? "").toLowerCase();
  const filtered = [...holdings.entries()]
    .filter(([, qty]) => qty > 0)
    .filter(([name]) => !query || name.toLowerCase().includes(query))
    .sort((a, b) => a[0].localeCompare(b[0]));
  if (!filtered.length)
    return `<p class="sub">${query ? "No shares match your search." : "No remaining holdings."}</p>`;
  return `<table class="mini">
    <tr><th>Share</th><th style="text-align:right;">Qty remaining</th></tr>
    ${filtered.map(([name, qty]) => `<tr><td>${name}</td><td>${qty}</td></tr>`).join("")}
  </table>`;
}

/** Period-aware value trend — all bars accent-purple (design.md §5: investment/share accent). */
function buildShareTrendBuckets(): BarChartBucket[] {
  return getPeriodBuckets().map<BarChartBucket>((b) => {
    const value = shareRecords
      .filter((r) => b.isDay ? r.date === b.key : String(r.date).startsWith(b.key))
      .reduce((sum, r) => sum + Math.abs(Number(r.total_amount ?? 0)), 0);
    return { label: b.label, sublabel: b.sublabel, value, color: "var(--accent-purple)" };
  });
}

