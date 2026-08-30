import { summarizeShareRecords } from "../../services/share-fifo-lot-matching.js";
import { bottomNav, dashboardScreen, field, historyRows, periodControls } from "../components/shell.js";
import { shareRecords } from "../data/demo-data.js";

export function sharesAddScreen(): string {
  return `
    <p class="eyebrow">Share Portfolio</p>
    <h1 class="pagehead">Add share entry</h1>
    <p class="sub">Matches desktop share inputs. Conditional fields will be enabled when the form is wired to SQLite writes.</p>
    <section class="card">
      ${field("Date", "date")}
      ${field("Share name", "text")}
      ${field("Entry type", "select", "ipo")}
      ${field("Dividend Type", "select", "cash")}
      ${field("SIP type", "select", "installment")}
      ${field("Amount", "number")}
      ${field("Number of Shares", "number")}
      ${field("Total Amount", "number")}
      ${field("Quantity", "number")}
      ${field("Allotted", "number")}
      ${field("Per unit price", "number")}
      <button class="btn-primary">Add Share Portfolio Entry</button>
    </section>
    ${bottomNav("home", "shares-dash")}
  `;
}

export function sharesDashboardScreen(): string {
  const summary = summarizeShareRecords(shareRecords);
  const rows = shareRecords.map((row) => ({
    description: `${row.share_name} ${row.category}`,
    category: row.buy_sell,
    amount: Number(row.total_amount),
    direction: Number(row.profit_loss ?? 0) >= 0 ? "income" : "expense",
    flow_type: "shares",
    date: row.date,
  }));

  return dashboardScreen(
    "Share Portfolio",
    "Share portfolio dashboard",
    [
      ["Total IPO investment", summary.total_ipo_investment, "neg"],
      ["Secondary buy amount", summary.total_buy_amount, "neg"],
      ["IPO + secondary investment", summary.overall_investment, "neg"],
      ["Total sell amount", summary.total_sell_amount, "pos"],
      ["Total dividend", summary.total_dividend, "pos"],
      ["Realized trading profit", summary.total_profit, summary.total_profit >= 0 ? "pos" : "neg"],
      ["IPO/secondary profit/loss", summary.overall_profit_loss, summary.overall_profit_loss >= 0 ? "pos" : "neg"],
      ["SIP investment", summary.total_sip_investment, "neg"],
      ["SIP redeemed", summary.total_sip_redeemed, "pos"],
      ["SIP profit/loss", summary.sip_profit_loss, summary.sip_profit_loss >= 0 ? "pos" : "neg"],
      ["Grand total investment", summary.grand_total_investment, "neg"],
      ["Grand total profit/loss", summary.grand_profit_loss, summary.grand_profit_loss >= 0 ? "pos" : "neg"],
    ],
    `${periodControls(["month", "year", "custom"])}${historyRows(rows)}${shareUpdateSections()}`,
    "shares-add",
  );
}

function shareUpdateSections(): string {
  return `
    <section class="card">
      <h3>Update IPO allotment</h3>
      <p class="sub">Desktop parity placeholder for searching an IPO share and updating its allotted quantity after SQLite writes are enabled.</p>
      ${field("Search share (IPO only)", "text")}
      ${field("New allotment", "number")}
      <button class="btn-secondary">Update</button>
    </section>
    <section class="card">
      <h3>Update SIP shares</h3>
      <p class="sub">Desktop parity placeholder for searching a SIP share and updating the total SIP share quantity after SQLite writes are enabled.</p>
      ${field("Search share (SIP only)", "text")}
      ${field("Total SIP shares", "number")}
      <button class="btn-secondary">Update SIP</button>
    </section>
  `;
}
