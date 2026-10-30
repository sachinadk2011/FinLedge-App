import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getBankData } from "../api/bankApi";
import { getPersonalFinanceData } from "../api/personalFinanceApi";
import { getShareData } from "../api/shareApi";
import BarChart from "../components/BarChart";
import InteractiveTimelineChart from "../components/InteractiveTimelineChart";
import StatGrid from "../components/StatGrid";
import StatusNotice from "../components/StatusNotice";
import useDashboardPeriod from "../hooks/useDashboardPeriod";

import { formatCurrency } from "../utils/format";
import { parseDate, isoMonthKey } from "../utils/date";
import { BANK_INCOME_CATEGORIES } from "../constants/options";
import { buildDashboardBuckets } from "../utils/dashboardPeriod";
import { summarizeBankRecords, summarizePersonalRecords, summarizeShareRecords } from "../utils/summaries";

const formatter = {
  format: (val) => formatCurrency(val)
};

function isBankIncomeCategory(category) {
  return BANK_INCOME_CATEGORIES.has(String(category || "").trim().toLowerCase());
}

function createTrendRows(buckets, defaults) {
  return new Map(buckets.map((bucket) => [bucket.key, { key: bucket.key, month_key: bucket.key, label: bucket.label, ...defaults }]));
}

function trendKey(parsedDate, rows) {
  const monthKey = isoMonthKey(parsedDate);
  return rows.has(monthKey) ? monthKey : `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;
}

function sortedMonthRows(map) {
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row);
}

function buildBreakdownRows(values = {}, { excludeIncome = false } = {}) {
  return Object.entries(values)
    .filter(([label]) => !excludeIncome || !isBankIncomeCategory(label))
    .map(([label, value]) => ({
      label,
      value: isBankIncomeCategory(label) ? Math.abs(Number(value || 0)) : -Math.abs(Number(value || 0)),
      color: isBankIncomeCategory(label) ? "#22c55e" : "#f2555f",
    }))
    .filter((item) => item.value !== 0)
    .sort((a, b) => b.value - a.value);
}

function buildBankTrend(records, buckets) {
  const byMonth = createTrendRows(buckets, { income: 0, expenses: 0, netDisplay: 0, netRaw: 0 });

  for (const record of records) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const row = byMonth.get(trendKey(parsed, byMonth));
    if (!row) continue;
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

function buildShareTrend(records, buckets) {
  const byMonth = createTrendRows(buckets, { investment: 0, income: 0, profitDisplay: 0, profitRaw: 0, netMovementDisplay: 0, netMovementRaw: 0 });

  for (const record of records) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const row = byMonth.get(trendKey(parsed, byMonth));
    if (!row) continue;
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

function buildPersonalFinanceTrend(records, buckets, { manualOnly = false } = {}) {
  const byMonth = createTrendRows(buckets, { income: 0, expenses: 0, netDisplay: 0, netRaw: 0 });

  for (const record of records) {
    if (manualOnly && record.source !== "manual") continue;
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const row = byMonth.get(trendKey(parsed, byMonth));
    if (!row) continue;
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

function buildOverallTimeline(bankRecords, shareRecords, personalRecords, buckets) {
  const bank = new Map(buildBankTrend(bankRecords, buckets).map((row) => [row.key, row]));
  const share = new Map(buildShareTrend(shareRecords, buckets).map((row) => [row.key, row]));
  const personal = new Map(buildPersonalFinanceTrend(personalRecords, buckets, { manualOnly: true }).map((row) => [row.key, row]));
  return buckets.map(({ key, label }) => {
    const bankRaw = bank.get(key)?.netRaw || 0;
    const shareRaw = share.get(key)?.profitRaw || 0;
    const personalRaw = personal.get(key)?.netRaw || 0;
    const overallRaw = bankRaw + shareRaw + personalRaw;
    return { key, label, bankDisplay: Math.abs(bankRaw), bankRaw, shareDisplay: Math.abs(shareRaw), shareRaw, personalDisplay: Math.abs(personalRaw), personalRaw, overallDisplay: Math.abs(overallRaw), overallRaw };
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
  const bankPeriod = useDashboardPeriod("month");
  const sharePeriod = useDashboardPeriod("month");
  const personalPeriod = useDashboardPeriod("month");
  const overallPeriod = useDashboardPeriod("month");
  const [bankData, setBankData] = useState(null);
  const [shareData, setShareData] = useState(null);
  const [personalFinanceData, setPersonalFinanceData] = useState(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([getBankData(), getShareData(), getPersonalFinanceData()])
      .then(([bankRes, shareRes, personalRes]) => {
        if (!active) return;
        if (bankRes.status === "fulfilled") setBankData(bankRes.value);
        if (shareRes.status === "fulfilled") setShareData(shareRes.value);
        if (personalRes.status === "fulfilled") setPersonalFinanceData(personalRes.value);
        const dataWarnings = [bankRes, shareRes, personalRes]
          .filter((result) => result.status === "fulfilled")
          .flatMap((result) => result.value?.warnings || []);
        if (dataWarnings.length) setWarning(dataWarnings.join(" "));

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

  const bankRecords = bankData?.records || [];
  const shareRecords = shareData?.records || [];
  const personalRecords = personalFinanceData?.records || [];
  const hasAnyData = bankRecords.length + shareRecords.length + personalRecords.length > 0;

  const bankPeriodRecords = bankPeriod.filterRecords(bankRecords);
  const sharePeriodRecords = sharePeriod.filterRecords(shareRecords);
  const personalPeriodRecords = personalPeriod.filterRecords(personalRecords);
  const overallPeriodBankRecords = overallPeriod.filterRecords(bankRecords);
  const overallPeriodShareRecords = overallPeriod.filterRecords(shareRecords);
  const overallPeriodPersonalRecords = overallPeriod.filterRecords(personalRecords);
  const bankSummary = summarizeBankRecords(bankPeriodRecords);
  const shareSummary = summarizeShareRecords(sharePeriodRecords);
  const personalSummary = summarizePersonalRecords(personalPeriodRecords);
  const overallBankSummary = summarizeBankRecords(overallPeriodBankRecords);
  const overallShareSummary = summarizeShareRecords(overallPeriodShareRecords);
  const overallManualPersonalNet = sumManualPersonalNet(overallPeriodPersonalRecords);
  const overallPeriodNet = overallBankSummary.net_balance + overallShareSummary.grand_profit_loss + overallManualPersonalNet;
  const totalShareInvestment = Number(shareSummary.grand_total_investment ?? shareSummary.overall_investment ?? 0);
  const totalShareProfitLoss = Number(shareSummary.grand_profit_loss ?? shareSummary.overall_profit_loss ?? 0);
  const manualPersonalNet = sumManualPersonalNet(personalPeriodRecords);
  const bankBounds = useMemo(() => bankPeriod.boundsForRecords(bankRecords), [bankRecords, bankPeriod.range, bankPeriod.bounds]);
  const shareBounds = useMemo(() => sharePeriod.boundsForRecords(shareRecords), [shareRecords, sharePeriod.range, sharePeriod.bounds]);
  const personalBounds = useMemo(() => personalPeriod.boundsForRecords(personalRecords), [personalRecords, personalPeriod.range, personalPeriod.bounds]);
  const overallRecords = [...bankRecords, ...shareRecords, ...personalRecords];
  const overallBounds = useMemo(() => overallPeriod.boundsForRecords(overallRecords), [bankRecords, shareRecords, personalRecords, overallPeriod.range, overallPeriod.bounds]);
  const bankBuckets = useMemo(() => buildDashboardBuckets([], bankBounds), [bankBounds]);
  const shareBuckets = useMemo(() => buildDashboardBuckets([], shareBounds), [shareBounds]);
  const personalBuckets = useMemo(() => buildDashboardBuckets([], personalBounds), [personalBounds]);
  const overallBuckets = useMemo(() => buildDashboardBuckets([], overallBounds), [overallBounds]);
  const bankMonthly = useMemo(() => buildBankTrend(bankPeriodRecords, bankBuckets), [bankPeriod.range, bankPeriod.startDate, bankPeriod.endDate, bankPeriodRecords, bankBuckets]);
  const shareMonthly = useMemo(() => buildShareTrend(sharePeriodRecords, shareBuckets), [sharePeriod.range, sharePeriod.startDate, sharePeriod.endDate, sharePeriodRecords, shareBuckets]);
  const personalMonthly = useMemo(() => buildPersonalFinanceTrend(personalPeriodRecords, personalBuckets), [personalPeriod.range, personalPeriod.startDate, personalPeriod.endDate, personalPeriodRecords, personalBuckets]);
  const overallTimeline = useMemo(
    () => buildOverallTimeline(overallPeriodBankRecords, overallPeriodShareRecords, overallPeriodPersonalRecords, overallBuckets),
    [overallPeriodBankRecords, overallPeriodShareRecords, overallPeriodPersonalRecords, overallBuckets],
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
      <StatusNotice message={error} onDismiss={() => setError("")} />
      <StatusNotice message={warning} kind="warning" onDismiss={() => setWarning("")} />

      {!loading ? (
        <>
          {!hasAnyData ? (
            <section className="card">
              <h3>Financial Summary</h3>
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
                <BarChart title="Bank Services by category" data={buildBreakdownRows(bankSummary.category_totals)} />
                <InteractiveTimelineChart
                  title="Bank Services trend"
                  data={bankMonthly}
                  windowSize={12}
                  bars={[
                    { dataKey: "income", name: "Interest earned", color: "#22c55e" },
                    { dataKey: "expenses", name: "Charges", color: "#f2555f" },
                    { dataKey: "netDisplay", rawDataKey: "netRaw", name: "Net benefit/loss", color: "#14b8a6", negativeColor: "#f5a524" },
                  ]}
                  moduleDashboard
                  summaryChart
                  visibleBarCountOverride={3}
                  periodFilter={bankPeriod}
                  legendItems={[{ label: "Interest earned", color: "#22c55e" }, { label: "Charges", color: "#f2555f" }, { label: "Net ≥0", color: "#14b8a6" }, { label: "Net <0", color: "#f5a524" }]}
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
                    { label: "Total investment", value: -Math.abs(totalShareInvestment), color: "#f2555f" },
                    { label: "Sell proceeds", value: Number(shareSummary.total_sell_amount || 0), color: "#22c55e" },
                    { label: "Dividend income", value: Number(shareSummary.total_dividend || 0), color: "#22c55e" },
                    { label: "Profit/loss", value: totalShareProfitLoss, color: totalShareProfitLoss < 0 ? "#f2555f" : "#14b8a6" },
                  ]}
                />
                <InteractiveTimelineChart
                  title="Share Portfolio trend"
                  data={shareMonthly}
                  windowSize={12}
                  bars={[
                    { dataKey: "investment", name: "Investment", color: "#f2555f" },
                    { dataKey: "income", name: "Income received", color: "#22c55e" },
                    { dataKey: "profitDisplay", rawDataKey: "profitRaw", name: "Profit/loss", color: "#14b8a6", negativeColor: "#f2555f" },
                  ]}
                  moduleDashboard
                  summaryChart
                  visibleBarCountOverride={3}
                  periodFilter={sharePeriod}
                  legendItems={[{ label: "Investment", color: "#f2555f" }, { label: "Income received", color: "#22c55e" }, { label: "Profit/loss ≥0", color: "#14b8a6" }, { label: "Profit/loss <0", color: "#f2555f" }]}
                />
              </div>

              <section className="card">
                <h3>Personal Expenses summary</h3>
                <StatGrid
                  items={[
                    { label: "Overall income", value: formatter.format(personalSummary.overall_income || 0) },
                    { label: "Overall expenses", value: formatter.format(personalSummary.overall_expenses || 0) },
                    { label: "Overall net/savings", value: formatter.format(personalSummary.overall_net || 0) },
                    { label: "Bank Flow net", value: formatter.format(personalSummary.bank.net || 0) },
                    { label: "Cash Flow net", value: formatter.format(personalSummary.cash.net || 0) },
                  ]}
                />
              </section>
              <div className="graph-grid">
                <BarChart
                  title="Personal Expenses flow totals"
                  data={[
                    { label: "Income", value: Number(personalSummary.overall_income || 0), color: "#22c55e" },
                    { label: "Expenses", value: -Math.abs(Number(personalSummary.overall_expenses || 0)), color: "#f2555f" },
                    { label: "Net/savings", value: Number(personalSummary.overall_net || 0), color: Number(personalSummary.overall_net || 0) < 0 ? "#f5a524" : "#14b8a6" },
                  ]}
                />
                <InteractiveTimelineChart
                  title="Personal Expenses trend"
                  data={personalMonthly}
                  windowSize={12}
                  bars={[
                    { dataKey: "income", name: "Income", color: "#22c55e" },
                    { dataKey: "expenses", name: "Expenses", color: "#f2555f" },
                    { dataKey: "netDisplay", rawDataKey: "netRaw", name: "Net/savings", color: "#14b8a6", negativeColor: "#f5a524" },
                  ]}
                  moduleDashboard
                  summaryChart
                  visibleBarCountOverride={3}
                  periodFilter={personalPeriod}
                  legendItems={[{ label: "Income", color: "#22c55e" }, { label: "Expenses", color: "#f2555f" }, { label: "Net ≥0", color: "#14b8a6" }, { label: "Net <0", color: "#f5a524" }]}
                />
              </div>

              <section className="card">
                <h3>Overall financial position</h3>
                <StatGrid
                  items={[
                    { label: "Bank Services net", value: formatter.format(overallBankSummary.net_balance || 0) },
                    { label: "Share Portfolio profit/loss", value: formatter.format(overallShareSummary.grand_profit_loss || 0) },
                    { label: "Personal Expenses net", value: formatter.format(overallManualPersonalNet) },
                    { label: "Overall net position", value: formatter.format(overallPeriodNet) },
                  ]}
                />
              </section>
              <div className="graph-grid">
                <div className="graph-span">
                  <InteractiveTimelineChart
                    title="Overall net by module"
                    data={overallTimeline}
                    windowSize={12}
                    bars={[
                      { dataKey: "bankDisplay", rawDataKey: "bankRaw", name: "Bank Services net", color: "#14b8a6", sameColorForSigns: true },
                      { dataKey: "shareDisplay", rawDataKey: "shareRaw", name: "Share Portfolio profit/loss", color: "#22c55e", sameColorForSigns: true },
                      { dataKey: "personalDisplay", rawDataKey: "personalRaw", name: "Personal Expenses net", color: "#3b82f6", sameColorForSigns: true },
                      { dataKey: "overallDisplay", rawDataKey: "overallRaw", name: "Overall net", color: "#8b5cf6", sameColorForSigns: true },
                    ]}
                    moduleDashboard
                    summaryChart
                    visibleBarCountOverride={5}
                    periodFilter={overallPeriod}
                    legendItems={[{ label: "Bank Services net", color: "#14b8a6" }, { label: "Share Portfolio profit/loss", color: "#22c55e" }, { label: "Personal Expenses net", color: "#3b82f6" }, { label: "Overall net", color: "#8b5cf6" }]}
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
