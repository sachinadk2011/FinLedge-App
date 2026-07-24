import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getBankData } from "../api/bankApi";
import { getShareData } from "../api/shareApi";
import BarChart from "../components/BarChart";
import InteractiveTimelineChart from "../components/InteractiveTimelineChart";
import StatGrid from "../components/StatGrid";

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

const BANK_INCOME_CATEGORIES = new Set(["interest earned", "income"]);

function isBankIncomeCategory(category) {
  return BANK_INCOME_CATEGORIES.has(String(category || "").trim().toLowerCase());
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = new Date(text.includes("T") ? text : `${text}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isoDayKey(dateValue) {
  return [
    dateValue.getFullYear(),
    String(dateValue.getMonth() + 1).padStart(2, "0"),
    String(dateValue.getDate()).padStart(2, "0"),
  ].join("-");
}

function isoMonthKey(dateValue) {
  return [dateValue.getFullYear(), String(dateValue.getMonth() + 1).padStart(2, "0")].join("-");
}

function createOverviewEntry(label) {
  return {
    label,
    bankIncome: 0,
    bankExpenses: 0,
    bankNet: 0,
    shareInvestment: 0,
    shareProfitLoss: 0,
    overallNet: 0,
  };
}

function buildDailyOverview(bankRecords, shareRecords) {
  const datedItems = [];

  for (const record of bankRecords) {
    const parsed = parseDate(record.date);
    if (parsed) datedItems.push(parsed);
  }

  for (const record of shareRecords) {
    const parsed = parseDate(record.date);
    if (parsed) datedItems.push(parsed);
  }

  if (datedItems.length === 0) return [];

  const start = new Date(Math.min(...datedItems.map((item) => item.getTime())));
  const end = new Date(Math.max(...datedItems.map((item) => item.getTime())));
  const byDay = new Map();

  const cursor = new Date(start);
  while (cursor <= end) {
    const key = isoDayKey(cursor);
    byDay.set(key, createOverviewEntry(dayLabelFormatter.format(cursor)));
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const record of bankRecords) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const entry = byDay.get(isoDayKey(parsed));
    if (!entry) continue;

    const category = String(record.category || "").trim().toLowerCase();
    const amount = Number(record.amount || 0);

    if (isBankIncomeCategory(category)) {
      entry.bankIncome += amount;
    } else {
      entry.bankExpenses += Math.abs(amount);
    }

    entry.bankNet += amount;
  }

  for (const record of shareRecords) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const entry = byDay.get(isoDayKey(parsed));
    if (!entry) continue;

    const category = String(record.category || "").trim().toLowerCase();
    const buySell = String(record.buy_sell || "").trim().toLowerCase();
    const totalAmount = Number(record.total_amount || 0);
    const profitLoss = Number(record.profit_loss || 0);

    if (category === "ipo" || category === "buy" || (category === "sip" && buySell !== "redeem")) {
      entry.shareInvestment += totalAmount;
    } else if (category === "sip" && buySell === "redeem") {
      entry.shareProfitLoss += profitLoss;
    } else if (category === "sell") {
      entry.shareProfitLoss += profitLoss;
    } else if (category === "dividend" && buySell === "cash") {
      entry.shareProfitLoss += totalAmount;
    }
  }

  return Array.from(byDay.values()).map((entry) => ({
    ...entry,
    overallNet: entry.bankNet + entry.shareProfitLoss - entry.shareInvestment,
  }));
}

function buildMonthlyOverview(bankRecords, shareRecords) {
  const byMonth = new Map();

  const ensureMonth = (parsedDate) => {
    const key = isoMonthKey(parsedDate);
    if (!byMonth.has(key)) {
      byMonth.set(key, createOverviewEntry(monthLabelFormatter.format(new Date(`${key}-01T00:00:00`))));
    }
    return byMonth.get(key);
  };

  for (const record of bankRecords) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const entry = ensureMonth(parsed);
    const category = String(record.category || "").trim().toLowerCase();
    const amount = Number(record.amount || 0);

    if (isBankIncomeCategory(category)) {
      entry.bankIncome += amount;
    } else {
      entry.bankExpenses += Math.abs(amount);
    }

    entry.bankNet += amount;
  }

  for (const record of shareRecords) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const entry = ensureMonth(parsed);
    const category = String(record.category || "").trim().toLowerCase();
    const buySell = String(record.buy_sell || "").trim().toLowerCase();
    const totalAmount = Number(record.total_amount || 0);
    const profitLoss = Number(record.profit_loss || 0);

    if (category === "ipo" || category === "buy" || (category === "sip" && buySell !== "redeem")) {
      entry.shareInvestment += totalAmount;
    } else if (category === "sip" && buySell === "redeem") {
      entry.shareProfitLoss += profitLoss;
    } else if (category === "sell") {
      entry.shareProfitLoss += profitLoss;
    } else if (category === "dividend" && buySell === "cash") {
      entry.shareProfitLoss += totalAmount;
    }
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => ({
      ...entry,
      overallNet: entry.bankNet + entry.shareProfitLoss - entry.shareInvestment,
    }));
}

function buildCombinedTimeline(monthlyOverview) {
  let runningBankNet = 0;
  let runningShareNet = 0;

  return monthlyOverview.map((entry) => {
    runningBankNet += entry.bankNet;
    runningShareNet += entry.shareProfitLoss - entry.shareInvestment;
    const overallNet = runningBankNet + runningShareNet;

    return {
      label: entry.label,
      bankNetDisplay: Math.abs(runningBankNet),
      bankNetRaw: runningBankNet,
      shareNetDisplay: Math.abs(runningShareNet),
      shareNetRaw: runningShareNet,
      overallNetDisplay: Math.abs(overallNet),
      overallNetRaw: overallNet,
    };
  });
}

function Summary() {
  const navigate = useNavigate();
  const [bankData, setBankData] = useState(null);
  const [shareData, setShareData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getBankData(), getShareData()])
      .then(([bankResponse, shareResponse]) => {
        if (active) {
          setBankData(bankResponse);
          setShareData(shareResponse);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Unable to load summary data.");
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
  };
  const shareSummary = shareData?.summary || {
    overall_investment: 0,
    overall_profit_loss: 0,
  };

  const bankRecords = bankData?.records || [];
  const shareRecords = shareData?.records || [];
  const totalRecords = bankRecords.length + shareRecords.length;
  const hasAnyData = totalRecords > 0;

  const totalShareInvestment = Number(shareSummary.grand_total_investment ?? shareSummary.overall_investment ?? 0);
  const totalShareProfitLoss = Number(shareSummary.grand_profit_loss ?? shareSummary.overall_profit_loss ?? 0);
  const overallNet = Number(bankSummary.net_balance || 0) + totalShareProfitLoss;

  const stats = [
    { label: "Bank services income", value: formatter.format(bankSummary.total_income || 0) },
    { label: "Bank services expenses", value: formatter.format(bankSummary.total_expenses || 0) },
    { label: "Bank services net balance", value: formatter.format(bankSummary.net_balance || 0) },
    { label: "Share portfolio investment", value: formatter.format(totalShareInvestment) },
    { label: "Share portfolio profit/loss", value: formatter.format(totalShareProfitLoss) },
    { label: "Overall net position", value: formatter.format(overallNet) },
  ];

  const overviewData = [
    { label: "Bank services net", value: Number(bankSummary.net_balance || 0) },
    { label: "Share portfolio profit/loss", value: totalShareProfitLoss },
    { label: "Overall net", value: overallNet },
  ];

  const dailyOverview = buildDailyOverview(bankRecords, shareRecords);
  const monthlyOverview = buildMonthlyOverview(bankRecords, shareRecords);
  const combinedTimeline = buildCombinedTimeline(monthlyOverview);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Financial Summary</p>
          <h1>Combined view</h1>
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
              <p className="subtitle">Add transaction data to see interactive monthly, yearly, and combined charts.</p>
            </section>
          ) : (
            <>
              <StatGrid items={stats} />
              <BarChart title="Bank services net vs share portfolio profit/loss vs overall net" data={overviewData} />

              <section className="card">
                <div className="page-header" style={{ marginBottom: 12 }}>
                  <div>
                    <h3>Financial Summary</h3>
                    <p className="subtitle">Hover bars to see exact values. Drag the lower scrubber to move through history.</p>
                  </div>
                </div>

                <div className="graph-grid">
                  <InteractiveTimelineChart
                    title="Monthly Overview"
                    subtitle="Daily view of bank services income, bank services charges, share portfolio investment, and share portfolio profit/loss."
                    data={dailyOverview}
                    windowSize={12}
                    bars={[
                      { dataKey: "bankIncome", name: "Bank services income", color: "#16a34a" },
                      { dataKey: "bankExpenses", name: "Bank services expenses", color: "#ef4444" },
                      { dataKey: "shareInvestment", name: "Share portfolio investment", color: "#2563eb" },
                      { dataKey: "shareProfitLoss", name: "Share portfolio profit/loss", color: "#a855f7" },
                    ]}
                  />

                  <InteractiveTimelineChart
                    title="Yearly Overview"
                    subtitle="Month-wise summary so you can scroll across the full yearly history."
                    data={monthlyOverview}
                    windowSize={12}
                    bars={[
                      { dataKey: "bankIncome", name: "Bank services income", color: "#16a34a" },
                      { dataKey: "bankExpenses", name: "Bank services expenses", color: "#ef4444" },
                      { dataKey: "shareInvestment", name: "Share portfolio investment", color: "#2563eb" },
                      { dataKey: "shareProfitLoss", name: "Share portfolio profit/loss", color: "#a855f7" },
                    ]}
                  />

                  <div className="graph-span">
                    <InteractiveTimelineChart
                      title="Combined Financial Overview"
                      subtitle="Running bank net balance plus running share profit/loss, with the overall net position on top."
                      data={combinedTimeline}
                      windowSize={12}
                      bars={[
                        { dataKey: "bankNetDisplay", rawDataKey: "bankNetRaw", name: "Bank services net balance", color: "#0f766e"},
                        { dataKey: "shareNetDisplay", rawDataKey: "shareNetRaw", name: "Share portfolio net profit/loss", color: "#8b5cf6" },
                        { dataKey: "overallNetDisplay", rawDataKey: "overallNetRaw", name: "Overall net position", color: "#f59e0b" },
                      ]}
                    />
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      ) : null}
    </main>
  );
}

export default Summary;
