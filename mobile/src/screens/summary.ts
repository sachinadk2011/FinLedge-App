import { summarizeBankRecords } from "../../services/bank-category-totals.js";
import { summarizeShareRecords } from "../../services/share-fifo-lot-matching.js";
import { summarizePersonalFinanceRecords } from "../../services/personal-finance-sync-row-computation.js";
import { dashboardScreen } from "../components/shell.js";
import { bankRecords, shareRecords } from "../data/demo-data.js";
import { currentPersonalFinanceRows } from "../data/mobile-data.js";

export function summaryScreen(): string {
  const bank = summarizeBankRecords(bankRecords);
  const shares = summarizeShareRecords(shareRecords);
  const pf = summarizePersonalFinanceRecords(currentPersonalFinanceRows());
  const overall = bank.net_balance + shares.grand_profit_loss + pf.combined.overall_net;
  return dashboardScreen("Financial Summary", "Overall position", [
    ["Bank net", bank.net_balance, bank.net_balance >= 0 ? "pos" : "neg"],
    ["Share P/L", shares.grand_profit_loss, shares.grand_profit_loss >= 0 ? "pos" : "neg"],
    ["Expenses net", pf.combined.overall_net, pf.combined.overall_net >= 0 ? "pos" : "neg"],
    ["Overall", overall, overall >= 0 ? "pos" : "neg"],
  ], `<section class="card"><h3>Net worth trend</h3><p class="sub">Read-only analytics across Bank Services, Share Portfolio, and Personal Expenses.</p></section>`, "home");
}

