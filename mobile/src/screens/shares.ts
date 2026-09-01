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

/** Known share names (from existing records) for name autocomplete. */
function knownShareNames(): string[] {
  return Array.from(new Set(shareRecords.map((r) => String(r.share_name ?? "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Overloaded share-name text field with a datalist of suggestions. */
function shareNameFieldWithSuggestions(id: string, placeholder: string, names: string[]): string {
  return `
    <div class="field">
      <label>Share name</label>
      <input type="text" list="${id}" placeholder="${placeholder}" autocomplete="off">
      <datalist id="${id}">
        ${names.map((n) => `<option value="${n}"></option>`).join("")}
      </datalist>
    </div>`;
}

function ipoOnlyNames(): string[] {
  return knownShareNames().filter((n) =>
    shareRecords.some((r) => String(r.share_name ?? "").trim().toUpperCase() === n && String(r.category ?? "").toLowerCase() === "ipo"),
  );
}

function sipOnlyNames(): string[] {
  return knownShareNames().filter((n) =>
    shareRecords.some((r) => String(r.share_name ?? "").trim().toUpperCase() === n && String(r.category ?? "").toLowerCase() === "sip"),
  );
}

export function sharesAddScreen(): string {
  const type = appState.sharesEntryType;

  // Conditional field visibility based on entry type
  const isSip      = type === "sip";
  const isDividend = type === "dividend";
  const isSecondary = type === "buy" || type === "sell";
  const dividendType = appState.sharesDividendType;

  const shareNameField = `
    <div class="field">
      <label>Share name</label>
      <input type="text" list="mobile-share-name-suggestions" placeholder="Share name" autocomplete="off">
      <datalist id="mobile-share-name-suggestions">
        ${knownShareNames().map((n) => `<option value="${n}"></option>`).join("")}
      </datalist>
    </div>`;

  return `
    <p class="eyebrow">Share Portfolio</p>
    <h1 class="pagehead">Add share entry</h1>
    <p class="sub">Track IPO, secondary, SIP and dividend activity.</p>

    <section class="card">
      <h3>Portfolio (remaining)</h3>
      ${searchInput("shares-portfolio", "Search by share name")}
      ${buildHoldingsTable()}
    </section>

    <section class="card">
      ${field("Date", "date")}
      ${shareNameField}
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

      ${isSip ? `
        <div class="field">
          <label>SIP type</label>
          <select data-shares-sip-type>
            <option value="installment">Installment / Investment</option>
            <option value="redeem">Redeem</option>
          </select>
        </div>
        ${field("SIP installment amount", "number")}
      ` : ""}

      ${isSecondary ? `
        ${field("Total Amount", "number")}
        ${field("Quantity", "number")}
        <p class="sub" style="margin:0;font-size:11px;color:var(--text-3);">Per unit price is calculated from total amount ÷ quantity.</p>
      ` : ""}

      ${isDividend ? `
        <div class="field">
          <label>Dividend type</label>
          <select data-shares-dividend-type>
            <option value="cash"  ${dividendType === "cash"  ? "selected" : ""}>Cash</option>
            <option value="bonus" ${dividendType === "bonus" ? "selected" : ""}>Bonus share</option>
          </select>
        </div>
        ${dividendType === "cash"
          ? field("Amount", "number")
          : field("Number of shares", "number")}
      ` : ""}

      ${!isSip && !isSecondary && !isDividend ? `
        ${field("Per unit price", "number")}
        ${field("Allotted", "number")}
      ` : ""}

      <button class="btn-primary">Add share entry</button>
    </section>
    ${bottomNav("home", "shares-dash")}
  `;
}

/** Share transaction history description — `${Share} . ${type} . allotted N` (only when allotted > 0). */
function shareHistoryDescription(row: { share_name?: unknown; category?: unknown; buy_sell?: unknown; allotted?: unknown }): string {
  const name = String(row.share_name ?? "").trim().toUpperCase();
  let type = String(row.category ?? "").trim().toLowerCase();
  if (type === "dividend") {
    type = String(row.buy_sell ?? "").trim().toLowerCase() === "bonus" ? "dividend (bonus)" : "dividend (cash)";
  }
  if (type === "sip") {
    type = String(row.buy_sell ?? "").trim().toLowerCase() === "redeem" ? "sip (redeem)" : "sip (installment)";
  }
  const allotted = Number(row.allotted ?? 0);
  const allottedPart = allotted > 0 ? ` · allotted ${allotted}` : "";
  return `${name ? `${name} · ` : ""}${type}${allottedPart}`;
}

export function sharesDashboardScreen(): string {
  const summary = summarizeShareRecords(shareRecords);
  const trendBuckets = buildShareTrendBuckets();

  const rows = shareRecords.map((row) => ({
    description: shareHistoryDescription(row),
    category: String(row.category ?? ""),
    amount: Number(row.total_amount),
    direction: Number(row.profit_loss ?? 0) >= 0 ? "income" : "expense",
    flow_type: "shares",
    date: row.date,
  }));

  return `
    <p class="eyebrow">Share Portfolio</p>
    <h1 class="pagehead">Share portfolio dashboard</h1>
    <p class="sub">IPO, secondary, SIP position and summary.</p>

    <section class="card">
      <h3>IPO &amp; secondary position</h3>
      ${statGrid([
        ["IPO invest",      summary.total_ipo_investment,  "neg"],
        ["Secondary buy",   summary.total_buy_amount,      "neg"],
        ["Total investment", summary.overall_investment,   "neg"],
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
      ${shareNameFieldWithSuggestions("mobile-ipo-name-suggestions", "Type IPO share name", ipoOnlyNames())}
      ${field("New allotment", "number")}
      <button class="btn-secondary">Update</button>
    </section>

    <section class="card">
      <h3>Update SIP shares</h3>
      <p class="sub">Search a SIP share and update the total SIP share quantity after SQLite writes are enabled.</p>
      ${shareNameFieldWithSuggestions("mobile-sip-name-suggestions", "Type SIP share name", sipOnlyNames())}
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

