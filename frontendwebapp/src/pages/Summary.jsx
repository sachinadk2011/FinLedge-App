import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getBankData } from "../api/bankApi";
import { getPersonalFinanceData } from "../api/personalFinanceApi";
import { getShareData } from "../api/shareApi";
import BarChart from "../components/BarChart";
import InteractiveTimelineChart from "../components/InteractiveTimelineChart";
import StatGrid from "../components/StatGrid";

import { formatCurrency } from "../utils/format";
import { parseDate, isoMonthKey, monthLabelFormatter } from "../utils/date";
import { BANK_INCOME_CATEGORIES } from "../constants/options";

const formatter = {
  format: (val) => formatCurrency(val)
};

function isBankIncomeCategory(category) {
  return BANK_INCOME_CATEGORIES.has(String(category || "").trim().toLowerCase());
}

function getMonthLabel(monthKey) {
  return monthLabelFormatter.format(new Date(`${monthKey}-01T00:00:00`));
}

function ensureMonth(map, parsedDate, defaults) {
  const key = isoMonthKey(parsedDate);
  if (!map.has(key)) {
    map.set(key, { month_key: key, label: getMonthLabel(key), ...defaults });
  }
  return map.get(key);
}

function sortedMonthRows(map) {
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row);
}

function buildBreakdownRows(values = {}, { excludeIncome = false } = {}) {
  return Object.entries(values)
    .filter(([label]) => !excludeIncome || !isBankIncomeCategory(label))
    .map(([label, value]) => ({ label, value: Math.abs(Number(value || 0)) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function buildBankMonthly(records) {
  const byMonth = new Map();

  for (const record of records) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const row = ensureMonth(byMonth, parsed, {
      income: 0,
      expenses: 0,
      netDisplay: 0,
      netRaw: 0,
    });
    const amount = Number(record.amount || 0);
    if (isBankIncomeCategory(record.category)) {
      row.income += amount;
    } else {
      row.expenses += Math.abs(amount);
    }
    row.netRaw += amount;
    row.netDisplay = Math.abs(row.netRaw);
  }

  return sortedMonthRows(byMonth);
}

function buildShareMonthly(records) {
  const byMonth = new Map();

  for (const record of records) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const row = ensureMonth(byMonth, parsed, {
      investment: 0,
      income: 0,
      profitDisplay: 0,
      profitRaw: 0,
      netMovementDisplay: 0,
      netMovementRaw: 0,
    });
    const category = String(record.category || "").trim().toLowerCase();
    const buySell = String(record.buy_sell || "").trim().toLowerCase();
    const totalAmount = Number(record.total_amount || 0);
    const profitLoss = Number(record.profit_loss || 0);

    if (category === "ipo" || category === "buy") {
      row.investment += totalAmount;
      row.netMovementRaw -= totalAmount;
    } else if (category === "sip" && !["redeem", "redeemed"].includes(buySell)) {
      row.investment += totalAmount;
    } else if (category === "sip" && ["redeem", "redeemed"].includes(buySell)) {
      row.income += totalAmount;
      row.profitRaw += profitLoss;
      row.netMovementRaw += profitLoss;
    } else if (category === "sell") {
      row.income += totalAmount;
      row.profitRaw += profitLoss;
      row.netMovementRaw += profitLoss;
    } else if (category === "dividend" && buySell === "cash") {
      row.income += totalAmount;
      row.profitRaw += totalAmount;
      row.netMovementRaw += totalAmount;
    }

    row.profitDisplay = Math.abs(row.profitRaw);
    row.netMovementDisplay = Math.abs(row.netMovementRaw);
  }

  return sortedMonthRows(byMonth);
}

function buildPersonalFinanceMonthly(records, { manualOnly = false } = {}) {
  const byMonth = new Map();

  for (const record of records) {
    if (manualOnly && record.source !== "manual") continue;
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const row = ensureMonth(byMonth, parsed, {
      income: 0,
      expenses: 0,
      netDisplay: 0,
      netRaw: 0,
    });
    const amount = Math.abs(Number(record.amount || 0));
    if (record.direction === "income") {
      row.income += amount;
      row.netRaw += amount;
    } else {
      row.expenses += amount;
      row.netRaw -= amount;
    }
    row.netDisplay = Math.abs(row.netRaw);
  }

  return sortedMonthRows(byMonth);
}

function buildOverallTimeline({ bankRecords, shareRecords, personalRecords }) {
  const byMonth = new Map();

  for (const row of buildBankMonthly(bankRecords)) {
    byMonth.set(row.month_key, {
      month_key: row.month_key,
      label: row.label,
      bankNet: row.netRaw,
      shareNet: 0,
      personalNet: 0,
    });
  }

  for (const row of buildShareMonthly(shareRecords)) {
    const existing = byMonth.get(row.month_key) || {
      month_key: row.month_key,
      label: row.label,
      bankNet: 0,
      shareNet: 0,
      personalNet: 0,
    };
    existing.shareNet = row.netMovementRaw;
    byMonth.set(row.month_key, existing);
  }

  for (const row of buildPersonalFinanceMonthly(personalRecords, { manualOnly: true })) {
    const existing = byMonth.get(row.month_key) || {
      month_key: row.month_key,
      label: row.label,
      bankNet: 0,
      shareNet: 0,
      personalNet: 0,
    };
    existing.personalNet = row.netRaw;
    byMonth.set(row.month_key, existing);
  }

  let runningBank = 0;
  let runningShare = 0;
  let runningPersonal = 0;

  return Array.from(byMonth.values())
    .sort((a, b) => a.month_key.localeCompare(b.month_key))
    .map((row) => {
      runningBank += row.bankNet;
      runningShare += row.shareNet;
      runningPersonal += row.personalNet;
      const overall = runningBank + runningShare + runningPersonal;
      return {
        label: row.label,
        bankDisplay: Math.abs(runningBank),
        bankRaw: runningBank,
        shareDisplay: Math.abs(runningShare),
        shareRaw: runningShare,
        personalDisplay: Math.abs(runningPersonal),
        personalRaw: runningPersonal,
        overallDisplay: Math.abs(overall),
        overallRaw: overall,
      };
    });
}

function sumManualPersonalNet(records) {
  return records.reduce((total, record) => {
    if (record.source !== "manual") return total;
    const amount = Math.abs(Number(record.amount || 0));
    return record.direction === "income" ? total + amount : total - amount;
  }, 0);
}

function Summary() {
  const navigate = useNavigate();
  const [bankData, setBankData] = useState(null);
  const [shareData, setShareData] = useState(null);
  const [personalFinanceData, setPersonalFinanceData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([getBankData(), getShareData(), getPersonalFinanceData()])
      .then(([bankRes, shareRes, personalRes]) => {
        if (!active) return;
        if (bankRes.status === "fulfilled") setBankData(bankRes.value);
        if (shareRes.status === "fulfilled") setShareData(shareRes.value);
        if (personalRes.status === "fulfilled") setPersonalFinanceData(personalRes.value);

        if (bankRes.status === "rejected" && shareRes.status === "rejected" && personalRes.status === "rejected") {
          const err = bankRes.reason || shareRes.reason || personalRes.reason;
          setError(err?.message || "Unable to load summary data.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const bankSummary = bankData?.summary || {
    total_income: 0,
    total_expenses: 0,
    net_balance: 0,
    category_totals: {},
  };
  const shareSummary = shareData?.summary || {
    total_ipo_investment: 0,
    total_sip_investment: 0,
    total_buy_amount: 0,
    total_sell_amount: 0,
    total_dividend: 0,
    grand_total_investment: 0,
    grand_profit_loss: 0,
  };
  const personalSummary = personalFinanceData?.summary?.combined || {
    overall_income: 0,
    overall_expenses: 0,
    overall_net: 0,
  };

  const bankRecords = bankData?.records || [];
  const shareRecords = shareData?.records || [];
  const personalRecords = personalFinanceData?.records || [];
  const hasAnyData = bankRecords.length + shareRecords.length + personalRecords.length > 0;

  const totalShareInvestment = Number(shareSummary.grand_total_investment ?? shareSummary.overall_investment ?? 0);
  const totalShareProfitLoss = Number(shareSummary.grand_profit_loss ?? shareSummary.overall_profit_loss ?? 0);
  const manualPersonalNet = sumManualPersonalNet(personalRecords);
  const overallNet = Number(bankSummary.net_balance || 0) + totalShareProfitLoss + manualPersonalNet;

  const bankMonthly = useMemo(() => buildBankMonthly(bankRecords), [bankRecords]);
  const shareMonthly = useMemo(() => buildShareMonthly(shareRecords), [shareRecords]);
  const personalMonthly = useMemo(() => buildPersonalFinanceMonthly(personalRecords), [personalRecords]);
  const overallTimeline = useMemo(
    () => buildOverallTimeline({ bankRecords, shareRecords, personalRecords }),
    [bankRecords, shareRecords, personalRecords],
  );

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Financial Summary</p>
          <h1>Financial summary</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" type="button" onClick={() => navigate(-1)}>
            Back
          </button>
          <Link className="ghost" to="/">
            Home
          </Link>
        </div>
      </header>

      {loading ? <p>Loading summary...</p> : null}
      {error ? <pre className="error-pre">{error}</pre> : null}

      {!loading && !error ? (
        <>
          {!hasAnyData ? (
            <section className="card">
              <h3>Financial Summary</h3>
              <p className="subtitle">Add transaction data to see Bank Services, Share Portfolio, Personal Expenses, and overall position analytics.</p>
            </section>
          ) : (
            <>
              <section className="card">
                <h3>Bank Services summary</h3>
                <StatGrid
                  items={[
                    { label: "Total Interest Earned", value: formatter.format(bankSummary.total_income || 0) },
                    { label: "Total Charges", value: formatter.format(bankSummary.total_expenses || 0) },
                    { label: "Net Bank Benefit/Loss", value: formatter.format(bankSummary.net_balance || 0) },
                  ]}
                />
              </section>
              <div className="graph-grid">
                <BarChart title="Bank Services charges by category" data={buildBreakdownRows(bankSummary.category_totals, { excludeIncome: true })} />
                <InteractiveTimelineChart
                  title="Bank Services monthly trend"
                  data={bankMonthly}
                  windowSize={12}
                  bars={[
                    { dataKey: "income", name: "Interest earned", color: "#16a34a" },
                    { dataKey: "expenses", name: "Charges", color: "#ef4444" },
                    { dataKey: "netDisplay", rawDataKey: "netRaw", name: "Net benefit/loss", color: "#0f766e", negativeColor: "#f59e0b" },
                  ]}
                />
              </div>

              <section className="card">
                <h3>Share Portfolio summary</h3>
                <StatGrid
                  items={[
                    { label: "IPO investment", value: formatter.format(shareSummary.total_ipo_investment || 0) },
                    { label: "Secondary investment", value: formatter.format(shareSummary.total_buy_amount || 0) },
                    { label: "SIP investment", value: formatter.format(shareSummary.total_sip_investment || 0) },
                    { label: "Sell proceeds", value: formatter.format(shareSummary.total_sell_amount || 0) },
                    { label: "Dividend income", value: formatter.format(shareSummary.total_dividend || 0) },
                    { label: "Grand profit/loss", value: formatter.format(totalShareProfitLoss) },
                  ]}
                />
              </section>
              <div className="graph-grid">
                <BarChart
                  title="Share Portfolio totals"
                  data={[
                    { label: "Total investment", value: totalShareInvestment },
                    { label: "Sell proceeds", value: Number(shareSummary.total_sell_amount || 0) },
                    { label: "Dividend income", value: Number(shareSummary.total_dividend || 0) },
                    { label: "Profit/loss", value: totalShareProfitLoss },
                  ]}
                />
                <InteractiveTimelineChart
                  title="Share Portfolio monthly trend"
                  data={shareMonthly}
                  windowSize={12}
                  bars={[
                    { dataKey: "investment", name: "Investment", color: "#2563eb" },
                    { dataKey: "income", name: "Income received", color: "#16a34a" },
                    { dataKey: "profitDisplay", rawDataKey: "profitRaw", name: "Profit/loss", color: "#8b5cf6", negativeColor: "#f43f5e" },
                  ]}
                />
              </div>

              <section className="card">
                <h3>Personal Expenses summary</h3>
                <p className="subtitle">Combined Overview output from Bank Flow and Cash Flow.</p>
                <StatGrid
                  items={[
                    { label: "Overall income", value: formatter.format(personalSummary.overall_income || 0) },
                    { label: "Overall expenses", value: formatter.format(personalSummary.overall_expenses || 0) },
                    { label: "Overall net/savings", value: formatter.format(personalSummary.overall_net || 0) },
                    { label: "Bank Flow net", value: formatter.format(personalFinanceData?.summary?.bank?.net || 0) },
                    { label: "Cash Flow net", value: formatter.format(personalFinanceData?.summary?.cash?.net || 0) },
                  ]}
                />
              </section>
              <div className="graph-grid">
                <BarChart
                  title="Personal Expenses flow totals"
                  data={[
                    { label: "Income", value: Number(personalSummary.overall_income || 0) },
                    { label: "Expenses", value: Number(personalSummary.overall_expenses || 0) },
                    { label: "Net/savings", value: Number(personalSummary.overall_net || 0) },
                  ]}
                />
                <InteractiveTimelineChart
                  title="Personal Expenses monthly trend"
                  data={personalMonthly}
                  windowSize={12}
                  bars={[
                    { dataKey: "income", name: "Income", color: "#16a34a" },
                    { dataKey: "expenses", name: "Expenses", color: "#ef4444" },
                    { dataKey: "netDisplay", rawDataKey: "netRaw", name: "Net/savings", color: "#0f766e", negativeColor: "#f59e0b" },
                  ]}
                />
              </div>

              <section className="card">
                <h3>Overall financial position</h3>
                <p className="subtitle">Combines Bank Services, Share Portfolio, and manual Personal Expenses movement without double-counting the live Bank Flow view.</p>
                <StatGrid
                  items={[
                    { label: "Bank Services net", value: formatter.format(bankSummary.net_balance || 0) },
                    { label: "Share Portfolio profit/loss", value: formatter.format(totalShareProfitLoss) },
                    { label: "Manual Personal Expenses net", value: formatter.format(manualPersonalNet) },
                    { label: "Overall net position", value: formatter.format(overallNet) },
                  ]}
                />
              </section>
              <div className="graph-grid">
                <div className="graph-span">
                  <InteractiveTimelineChart
                    title="Net worth trend"
                    data={overallTimeline}
                    windowSize={12}
                    bars={[
                      { dataKey: "bankDisplay", rawDataKey: "bankRaw", name: "Bank Services net", color: "#0f766e", negativeColor: "#f59e0b" },
                      { dataKey: "shareDisplay", rawDataKey: "shareRaw", name: "Share Portfolio movement", color: "#8b5cf6", negativeColor: "#f43f5e" },
                      { dataKey: "personalDisplay", rawDataKey: "personalRaw", name: "Personal Expenses net", color: "#2563eb", negativeColor: "#ef4444" },
                      { dataKey: "overallDisplay", rawDataKey: "overallRaw", name: "Overall net position", color: "#16a34a", negativeColor: "#dc2626" },
                    ]}
                  />
                </div>
              </div>
            </>
          )}
        </>
      ) : null}
    </main>
  );
}

export default Summary;
