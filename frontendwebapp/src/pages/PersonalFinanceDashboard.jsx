import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { getPersonalFinanceData } from "../api/personalFinanceApi";
import BarChart from "../components/BarChart";
import InteractiveTimelineChart from "../components/InteractiveTimelineChart";
import StatGrid from "../components/StatGrid";
import TransactionsTable from "../components/TransactionsTable";

import { formatCurrency } from "../utils/format";
import { parseDate, isoMonthKey, monthLabelFormatter } from "../utils/date";

const formatter = {
  format: (val) => formatCurrency(val)
};

function buildBreakdownRows(values = {}) {
  return Object.entries(values)
    .map(([label, value]) => ({ label, value: Number(value || 0) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function buildMonthlyFlowOverview(records, flowType) {
  const byMonth = new Map();
  for (const record of records) {
    if (flowType !== "combined" && record.flow_type !== flowType) continue;
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const key = isoMonthKey(parsed);
    if (!byMonth.has(key)) {
      byMonth.set(key, {
        label: monthLabelFormatter.format(new Date(`${key}-01T00:00:00`)),
        income: 0,
        expenses: 0,
        netDisplay: 0,
        netRaw: 0,
      });
    }
    const entry = byMonth.get(key);
    const amount = Number(record.amount || 0);
    if (record.direction === "income") {
      entry.income += amount;
      entry.netRaw += amount;
    } else {
      entry.expenses += amount;
      entry.netRaw -= amount;
    }
    entry.netDisplay = Math.abs(entry.netRaw);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => entry);
}

function getSourceLabel(source) {
  if (source === "share-sync") return "Share Portfolio";
  if (source === "bank-services-sync") return "Bank Services";
  return "Manual";
}

function FlowDashboard({ title, netLabel, summary, records, flowType }) {
  const monthlyOverview = useMemo(() => buildMonthlyFlowOverview(records, flowType), [records, flowType]);
  const flowRows = useMemo(
    () =>
      records
        .filter((record) => record.flow_type === flowType)
        .reverse()
        .slice(0, 12)
        .map((record) => ({
          id: record.id,
          display_id: record.display_id || `${flowType === "cash" ? "C" : "B"}-${record.id}`,
          date: record.date,
          direction: record.direction === "income" ? "Income" : "Expense",
          category: record.category,
          description: record.description || "-",
          amount: formatter.format(record.amount),
          source: getSourceLabel(record.source),
        })),
    [records, flowType],
  );
  const stats = flowType === "bank"
    ? [
        { label: "Income", value: formatter.format(summary.income || 0) },
        { label: "Expense", value: formatter.format(summary.expenses || 0) },
        { label: "Investment expense", value: formatter.format(summary.investment_expense || 0) },
        { label: "Investment income", value: formatter.format(summary.investment_income || 0) },
        { label: "Interest earned", value: formatter.format(summary.interest_earned || 0) },
        { label: "Service cost", value: formatter.format(summary.service_cost || 0) },
        { label: "Total income", value: formatter.format(summary.total_income || 0) },
        { label: "Total expense", value: formatter.format(summary.total_expenses || 0) },
        { label: "Net profit/loss", value: formatter.format(summary.net || 0) },
      ]
    : [
        { label: "Income", value: formatter.format(summary.total_income || 0) },
        { label: "Expense", value: formatter.format(summary.total_expenses || 0) },
        { label: "Net profit/loss", value: formatter.format(summary.net || 0) },
      ];
  const columns = [
    { key: "date", label: "Date" },
    { key: "direction", label: "Type" },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "amount", label: "Amount" },
    { key: "source", label: "Source" },
  ];

  return (
    <>
      <section className="card">
        <h3>{title}</h3>
        <StatGrid items={stats} />
      </section>
      <div className="graph-grid">
        <BarChart title={`${title} expense breakdown`} data={buildBreakdownRows(summary.expense_breakdown)} />
        <BarChart title={`${title} income breakdown`} data={buildBreakdownRows(summary.income_breakdown)} />
      </div>
      <section className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div>
            <h3>{title} trend</h3>
            <p className="subtitle">Month-wise income, expenses, and net movement.</p>
          </div>
        </div>
        <InteractiveTimelineChart
          title={`Monthly ${title} Overview`}
          data={monthlyOverview}
          windowSize={12}
          bars={[
            { dataKey: "income", name: "Income", color: "#16a34a" },
            { dataKey: "expenses", name: "Expenses", color: "#ef4444" },
            { dataKey: "netDisplay", rawDataKey: "netRaw", name: netLabel, color: "#0f766e", negativeColor: "#f59e0b" },
          ]}
        />
      </section>
      <section className="card">
        <h3>Recent {title} transactions</h3>
        <TransactionsTable columns={columns} rows={flowRows} />
      </section>
    </>
  );
}

function PersonalFinanceDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialView = ["bank", "cash", "combined"].includes(searchParams.get("view"))
    ? searchParams.get("view")
    : "combined";
  const [data, setData] = useState(null);
  const [activeView, setActiveView] = useState(initialView);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => {
    getPersonalFinanceData()
      .then((response) => setData(response))
      .catch((err) => setError(err.message || "Unable to load Personal Expenses data."))
      .finally(() => setLoading(false));
  }, []);

  const records = data?.records || [];
  const summary = data?.summary || {
    bank: { total_income: 0, total_expenses: 0, net: 0, income_breakdown: {}, expense_breakdown: {} },
    cash: { total_income: 0, total_expenses: 0, net: 0, income_breakdown: {}, expense_breakdown: {} },
    combined: { overall_income: 0, overall_expenses: 0, overall_net: 0 },
  };

  const combinedStats = [
    { label: "Overall income", value: formatter.format(summary.combined?.overall_income || 0) },
    { label: "Overall expenses", value: formatter.format(summary.combined?.overall_expenses || 0) },
    { label: "Overall net/savings", value: formatter.format(summary.combined?.overall_net || 0) },
    { label: "Bank net", value: formatter.format(summary.bank?.net || 0) },
    { label: "Cash net", value: formatter.format(summary.cash?.net || 0) },
  ];

  const combinedOverview = useMemo(() => buildMonthlyFlowOverview(records, "combined"), [records]);

  const recentRows = [...records]
    .reverse()
    .slice(0, 12)
    .map((record) => ({
      id: record.id,
      display_id: record.display_id || `${record.flow_type === "cash" ? "C" : "B"}-${record.id}`,
      date: record.date,
      flow: record.flow_type === "cash" ? "Cash Flow" : "Bank Flow",
      direction: record.direction === "income" ? "Income" : "Expense",
      category: record.category,
      amount: formatter.format(record.amount),
      description: record.description || "-",
      source: getSourceLabel(record.source),
    }));

  const columns = [
    { key: "date", label: "Date" },
    { key: "flow", label: "Flow" },
    { key: "direction", label: "Type" },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "amount", label: "Amount" },
    { key: "source", label: "Source" },
  ];

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Personal Expenses</p>
          <h1>Personal expenses dashboard</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" type="button" onClick={() => navigate(-1)}>
            Back
          </button>
          <Link className="ghost" to="/">
            Home
          </Link>
          <Link className="ghost" to="/personal-finance">
            Personal Expenses
          </Link>
          <Link className="ghost" to={`/personal-finance-entry?flow=${activeView}`}>
            Add entry
          </Link>
        </div>
      </header>

      <div className="view-switcher" role="tablist" aria-label="Personal Expenses dashboard views">
        <button type="button" className={activeView === "combined" ? "active" : ""} onClick={() => setActiveView("combined")}>
          Combined Overview
        </button>
        <button type="button" className={activeView === "bank" ? "active" : ""} onClick={() => setActiveView("bank")}>
          Bank Flow
        </button>
        <button type="button" className={activeView === "cash" ? "active" : ""} onClick={() => setActiveView("cash")}>
          Cash Flow
        </button>
      </div>

      {loading ? <p>Loading Personal Expenses dashboard...</p> : null}
      {error ? <pre className="error-pre">{error}</pre> : null}

      {!loading && !error ? (
        <>
          {activeView === "combined" ? (
            <>
              <section className="card">
                <h3>Combined Overview</h3>
                <p className="subtitle">Combines manual Personal Expenses entries with live Bank Services and Share Portfolio activity in Bank Flow.</p>
                <StatGrid items={combinedStats} />
              </section>
              <section className="card">
                <div className="page-header" style={{ marginBottom: 12 }}>
                  <div>
                    <h3>Combined trend</h3>
                    <p className="subtitle">Month-wise Personal Expenses income, expenses, and net movement.</p>
                  </div>
                </div>
                <InteractiveTimelineChart
                  title="Monthly Personal Expenses Overview"
                  data={combinedOverview}
                  windowSize={12}
                  bars={[
                    { dataKey: "income", name: "Income", color: "#16a34a" },
                    { dataKey: "expenses", name: "Expenses", color: "#ef4444" },
                    { dataKey: "netDisplay", rawDataKey: "netRaw", name: "Overall net/savings", color: "#0f766e", negativeColor: "#f59e0b" },
                  ]}
                />
              </section>
              <div className="graph-grid">
                <BarChart title="Bank-only analytics" data={[
                  { label: "Bank income", value: Number(summary.bank?.total_income || 0) },
                  { label: "Bank expenses", value: Number(summary.bank?.total_expenses || 0) },
                  { label: "Bank net", value: Number(summary.bank?.net || 0) },
                ]} />
                <BarChart title="Cash-only analytics" data={[
                  { label: "Cash income", value: Number(summary.cash?.total_income || 0) },
                  { label: "Cash expenses", value: Number(summary.cash?.total_expenses || 0) },
                  { label: "Cash net", value: Number(summary.cash?.net || 0) },
                ]} />
              </div>
              <section className="card">
                <h3>Recent Personal Expenses transactions</h3>
                <TransactionsTable columns={columns} rows={recentRows} />
              </section>
            </>
          ) : null}

          {activeView === "bank" ? (
            <FlowDashboard title="Bank Flow" netLabel="Bank Net" summary={summary.bank} records={records} flowType="bank" />
          ) : null}

          {activeView === "cash" ? (
            <FlowDashboard title="Cash Flow" netLabel="Cash Net" summary={summary.cash} records={records} flowType="cash" />
          ) : null}
        </>
      ) : null}
    </main>
  );
}

export default PersonalFinanceDashboard;
