import { BANK_INCOME_CATEGORIES } from "../constants/options";
import { filterShareRecordsAsOf } from "./shareClosingPosition";

function isBankIncomeCategory(category) {
  return BANK_INCOME_CATEGORIES.has(String(category || "").trim().toLowerCase());
}

export function summarizeBankRecords(records) {
  const summary = records.reduce((totals, record) => {
    const amount = Number(record.amount || 0);
    if (isBankIncomeCategory(record.category)) totals.total_income += amount;
    else totals.total_expenses += Math.abs(amount);
    totals.category_totals[record.category] = (totals.category_totals[record.category] || 0) + Math.abs(amount);
    return totals;
  }, { total_income: 0, total_expenses: 0, net_balance: 0, category_totals: {} });
  summary.net_balance = summary.total_income - summary.total_expenses;
  return summary;
}

export function summarizeShareRecords(records, allRecords = records, closingEndDate) {
  const summary = {
    total_ipo_investment: 0, total_sip_investment: 0, total_sip_redeemed: 0,
    sip_profit_loss: 0, total_buy_amount: 0, total_sell_amount: 0,
    total_dividend: 0, total_profit: 0, bonus_shares_received: 0,
  };
  records.forEach((record) => {
    const category = String(record.category || "").trim().toLowerCase();
    const action = String(record.buy_sell || "").trim().toLowerCase();
    const amount = Number(record.total_amount || 0);
    const profit = Number(record.profit_loss || 0);
    if (category === "ipo") summary.total_ipo_investment += amount;
    else if (category === "buy") summary.total_buy_amount += amount;
    else if (category === "sell") { summary.total_sell_amount += amount; summary.total_profit += profit; }
    else if (category === "sip" && ["redeem", "redeemed"].includes(action)) { summary.total_sip_redeemed += amount; summary.sip_profit_loss += profit; }
    else if (category === "sip") summary.total_sip_investment += amount;
    else if (category === "dividend" && action === "cash") summary.total_dividend += amount;
    else if (category === "dividend" && action === "bonus") summary.bonus_shares_received += Number(record.allotted || 0);
  });
  summary.overall_investment = summary.total_ipo_investment + summary.total_buy_amount;
  const latestPositions = new Map();
  let allSipInvestment = 0;
  let allSipRedeemed = 0;
  filterShareRecordsAsOf(allRecords, closingEndDate).forEach((record) => {
    const key = String(record.share_name || "").trim().toLowerCase();
    if (key) {
      const prior = latestPositions.get(key);
      const currentKey = `${String(record.date || "").slice(0, 10)}:${String(record.id || "").padStart(12, "0")}`;
      const priorKey = prior ? `${String(prior.date || "").slice(0, 10)}:${String(prior.id || "").padStart(12, "0")}` : "";
      if (!prior || currentKey >= priorKey) latestPositions.set(key, record);
    }
    if (String(record.category || "").trim().toLowerCase() === "sip") {
      const isRedemption = ["redeem", "redeemed"].includes(String(record.buy_sell || "").trim().toLowerCase());
      if (isRedemption) allSipRedeemed += Number(record.total_amount || 0);
      else allSipInvestment += Number(record.total_amount || 0);
    }
  });
  summary.share_holding_cost = [...latestPositions.values()].reduce((sum, record) => sum + Number(record.holding_cost || 0), 0);
  summary.share_net_cash_result = summary.total_profit + summary.total_dividend - summary.share_holding_cost;
  summary.overall_profit_loss = summary.share_net_cash_result;
  summary.grand_total_investment = summary.overall_investment + summary.total_sip_investment;
  summary.sip_unrecovered_capital = Math.max(allSipInvestment - allSipRedeemed, 0);
  summary.sip_net_cash_result = summary.total_sip_redeemed - summary.total_sip_investment;
  summary.grand_holding_cost = summary.share_holding_cost + summary.sip_unrecovered_capital;
  summary.grand_total_received = summary.total_sell_amount + summary.total_dividend + summary.total_sip_redeemed;
  summary.grand_net_cash_result = summary.grand_total_received - summary.grand_total_investment;
  summary.grand_profit_loss = summary.grand_net_cash_result;
  summary.total_share_investment = summary.overall_investment;
  summary.total_sell_proceeds = summary.total_sell_amount;
  summary.cash_dividends_received = summary.total_dividend;
  summary.realized_trading_profit_loss = summary.total_profit;
  return summary;
}

export function summarizePersonalRecords(records) {
  const summary = records.reduce((totals, record) => {
    if (record.source === "transfer") return totals;
    const amount = Math.abs(Number(record.amount || 0));
    const flow = record.flow_type === "cash" ? totals.cash : totals.bank;
    if (record.direction === "income") {
      totals.overall_income += amount;
      flow.income += amount;
      flow.net += amount;
    } else if (record.direction === "expense") {
      totals.overall_expenses += amount;
      flow.expenses += amount;
      flow.net -= amount;
    }
    return totals;
  }, { overall_income: 0, overall_expenses: 0, overall_net: 0, bank: { income: 0, expenses: 0, net: 0 }, cash: { income: 0, expenses: 0, net: 0 } });
  summary.overall_net = summary.overall_income - summary.overall_expenses;
  return summary;
}

export function summarizePersonalFlowRecords(records) {
  const flow = () => ({ income: 0, expenses: 0, transfer_in: 0, transfer_out: 0, total_income: 0, total_expenses: 0, net: 0, income_breakdown: {}, expense_breakdown: {} });
  const result = { bank: flow(), cash: flow(), combined: { overall_income: 0, overall_expenses: 0, overall_net: 0 } };
  records.forEach((record) => {
    const current = result[record.flow_type];
    if (!current) return;
    const amount = Number(record.amount || 0);
    if (record.source === "transfer") {
      const signed = Number(record.signed_amount || 0);
      if (signed < 0) current.transfer_out += Math.abs(signed);
      else current.transfer_in += signed;
      current.total_income += signed;
    } else if (record.direction === "income") {
      current.income += amount;
      current.income_breakdown[record.category] = (current.income_breakdown[record.category] || 0) + amount;
    } else {
      current.expenses += amount;
      current.expense_breakdown[record.category] = (current.expense_breakdown[record.category] || 0) + amount;
    }
  });
  ["bank", "cash"].forEach((name) => {
    const current = result[name];
    current.total_income += current.income;
    current.total_expenses = current.expenses;
    current.net = current.total_income - current.total_expenses;
  });
  result.combined.overall_income = result.bank.income + result.cash.income;
  result.combined.overall_expenses = result.bank.expenses + result.cash.expenses;
  result.combined.overall_net = result.combined.overall_income - result.combined.overall_expenses;
  return result;
}
