import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { deleteBankRecord, getBankData } from "../api/bankApi";
import BarChart from "../components/BarChart";
import ConfirmDialog from "../components/ConfirmDialog";
import DashboardPeriodFilter from "../components/DashboardPeriodFilter";
import InteractiveTimelineChart from "../components/InteractiveTimelineChart";
import StatGrid from "../components/StatGrid";
import StatusNotice from "../components/StatusNotice";
import TransactionFilters from "../components/TransactionFilters";
import TransactionsTable from "../components/TransactionsTable";
import useDashboardPeriod from "../hooks/useDashboardPeriod";
import { BANK_CATEGORIES, BANK_INCOME_CATEGORIES } from "../constants/options";
import { formatCurrency } from "../utils/format";
import { isoDayKey, isoMonthKey } from "../utils/date";
import { buildDashboardBuckets } from "../utils/dashboardPeriod";

function isBankIncomeCategory(category) {
  return BANK_INCOME_CATEGORIES.has(String(category || "").trim().toLowerCase());
}

function buildBankOverview(records, buckets) {
  const byKey = new Map(buckets.map((bucket) => [bucket.key, { ...bucket, income: 0, expenses: 0, netDisplay: 0, netRaw: 0 }]));
  for (const record of records) {
    const key = buckets[0]?.key?.length === 7 ? isoMonthKey(record.date) : isoDayKey(record.date);
    const entry = byKey.get(key);
    if (!entry) continue;
    const amount = Number(record.amount || 0);
    if (isBankIncomeCategory(record.category)) entry.income += amount;
    else entry.expenses += Math.abs(amount);
    entry.netRaw += amount;
    entry.netDisplay = Math.abs(entry.netRaw);
  }
  return [...byKey.values()];
}

function BankDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [tableSearch, setTableSearch] = useState("");
  const [tableCategory, setTableCategory] = useState("all");
  const period = useDashboardPeriod("month", { bankMode: true });

  const loadData = ({ background = false } = {}) => {
    if (!background) {
      setLoading(true);
    }
    setError("");
    setWarning("");
    getBankData()
      .then((response) => {
        setData(response);
        if (response?.warnings?.length) setWarning(response.warnings.join(" "));
      })
      .catch((err) => {
        setError(err.message || "Unable to load bank data.");
      })
      .finally(() => {
        if (!background) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const records = data?.records || [];
  const periodRecords = useMemo(() => period.filterRecords(records), [records, period.bounds]);
  const periodBounds = useMemo(() => period.boundsForRecords(records), [records, period.range, period.bounds]);
  const summary = useMemo(() => periodRecords.reduce((totals, record) => {
    const amount = Number(record.amount || 0);
    if (isBankIncomeCategory(record.category)) totals.total_income += amount;
    else totals.total_expenses += Math.abs(amount);
    totals.category_totals[record.category] = (totals.category_totals[record.category] || 0) + Math.abs(amount);
    return totals;
  }, { total_income: 0, total_expenses: 0, category_totals: {} }), [periodRecords]);
  summary.net_balance = summary.total_income - summary.total_expenses;

  const stats = [
    { label: "Interest earned", value: formatCurrency(summary.total_income) },
    { label: "Total charges", value: formatCurrency(summary.total_expenses) },
    { label: "Net balance", value: formatCurrency(summary.net_balance) },
  ];

  const categoryTotals = summary.category_totals || {};
  const chartData = Object.entries(categoryTotals)
    .map(([label, value]) => ({
      label,
      value: isBankIncomeCategory(label) ? Math.abs(Number(value || 0)) : -Math.abs(Number(value || 0)),
      color: isBankIncomeCategory(label) ? "#22c55e" : "#f2555f",
    }))
    .filter((item) => item.value !== 0)
    .sort((a, b) => b.value - a.value);

  const customIsMonthly = period.range === "custom" && periodBounds && (periodBounds.end - periodBounds.start) / 86400000 > 60;
  const periodBuckets = useMemo(() => buildDashboardBuckets(periodRecords, periodBounds, { monthly: period.range === "all_time" || period.range !== "custom" || customIsMonthly }), [periodRecords, periodBounds, period.range, customIsMonthly]);
  const overview = useMemo(() => buildBankOverview(periodRecords, periodBuckets), [periodRecords, periodBuckets]);

  const tableRows = [...periodRecords].reverse().map((record) => ({
    id: record.id,
    date: record.date,
    category: record.category,
    description: record.description || "",
    amount: formatCurrency(record.amount),
  }));
  const filteredTableRows = tableRows.filter((row) => {
    const term = tableSearch.trim().toLowerCase();
    return (tableCategory === "all" || row.category === tableCategory)
      && (!term || `${row.category} ${row.description}`.toLowerCase().includes(term));
  });

  const columns = [
    { key: "date", label: "Date" },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "amount", label: "Amount" },
  ];

  async function handleDelete(recordId) {
    if (!recordId) return;

    setDeletingId(recordId);
    setError("");
    try {
      await deleteBankRecord(recordId);
      setPendingDeleteRow(null);
      loadData({ background: true });
    } catch (err) {
      setError(err.message || "Unable to delete bank record.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="page wide-dashboard">
      <header className="page-header">
        <div>
          <p className="eyebrow">Bank Services</p>
          <h1>Bank services dashboard</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" type="button" onClick={() => navigate(-1)}>
            Back
          </button>
          <Link className="ghost" to="/">
            Home
          </Link>
          <Link className="ghost" to="/bank">
            Add entry
          </Link>
        </div>
      </header>

      {loading ? <p>Loading bank data...</p> : null}
      <StatusNotice message={error} onDismiss={() => setError("")} />
      <StatusNotice message={warning} kind="warning" onDismiss={() => setWarning("")} />

      {!loading ? (
        <>
          <StatGrid items={stats} />
          <DashboardPeriodFilter {...period} ranges={["month", "year", "custom", "all_time"]} />
          {chartData.length ? <BarChart title="Bank Services by category" data={chartData} /> : null}
          <section className="card">
            <div className="page-header" style={{ marginBottom: 12 }}>
              <div>
                <h3>Bank services trends</h3>
              </div>
            </div>
            <div className="graph-grid">
              <InteractiveTimelineChart
                title="Bank Services trend"
                data={overview}
                windowSize={12}
                bars={[
                  { dataKey: "income", name: "Income", color: "#22c55e" },
                  { dataKey: "expenses", name: "Expense", color: "#f2555f" },
                  { dataKey: "netDisplay", rawDataKey: "netRaw", name: "Net", color: "#14b8a6", negativeColor: "#f5a524" },
                ]}
                moduleDashboard
                legendItems={[
                  { label: "Income", color: "#22c55e" },
                  { label: "Expense", color: "#f2555f" },
                  { label: "Net ≥0", color: "#14b8a6" },
                  { label: "Net <0", color: "#f5a524" },
                ]}
              />
            </div>
          </section>
          <section className="card">
            <h3>All transactions</h3>
            <TransactionFilters search={tableSearch} onSearchChange={setTableSearch} category={tableCategory} onCategoryChange={setTableCategory} categories={Array.from(new Set([...BANK_CATEGORIES, ...records.map((record) => record.category).filter(Boolean)])).map((category) => ({ value: category, label: category }))} placeholder="Search by category or description" />
            <TransactionsTable
              columns={columns}
              rows={filteredTableRows}
              actions={(row) => (
                <>
                  <button type="button" className="ghost" onClick={() => navigate(`/bank?edit=${row.id}`)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost danger"
                    onClick={() => setPendingDeleteRow(row)}
                    disabled={deletingId === row.id}
                  >
                    Delete
                  </button>
                </>
              )}
            />
          </section>
          <ConfirmDialog
            open={Boolean(pendingDeleteRow)}
            title="Delete bank entry?"
            message={
              pendingDeleteRow
                ? `This will remove the ${pendingDeleteRow.category} entry from ${pendingDeleteRow.date}.`
                : ""
            }
            confirming={deletingId === pendingDeleteRow?.id}
            onCancel={() => setPendingDeleteRow(null)}
            onConfirm={() => handleDelete(pendingDeleteRow?.id)}
          />
        </>
      ) : null}
    </main>
  );
}

export default BankDashboard;
