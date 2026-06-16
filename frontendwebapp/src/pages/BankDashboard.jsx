import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { deleteBankRecord, getBankData } from "../api/bankApi";
import BarChart from "../components/BarChart";
import ConfirmDialog from "../components/ConfirmDialog";
import InteractiveTimelineChart from "../components/InteractiveTimelineChart";
import StatGrid from "../components/StatGrid";
import TransactionsTable from "../components/TransactionsTable";

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

function createBankTimelineEntry(label) {
  return {
    label,
    income: 0,
    expenses: 0,
    netDisplay: 0,
    netRaw: 0,
  };
}

function addBankRecordToEntry(entry, record) {
  const category = String(record.category || "").trim().toLowerCase();
  const amount = Number(record.amount || 0);

  if (category === "income") {
    entry.income += amount;
  } else {
    entry.expenses += Math.abs(amount);
  }

  entry.netRaw += amount;
  entry.netDisplay = Math.abs(entry.netRaw);
}

function buildDailyBankOverview(records) {
  const datedItems = records.map((record) => parseDate(record.date)).filter(Boolean);
  if (datedItems.length === 0) return [];

  const start = new Date(Math.min(...datedItems.map((item) => item.getTime())));
  const end = new Date(Math.max(...datedItems.map((item) => item.getTime())));
  const byDay = new Map();

  const cursor = new Date(start);
  while (cursor <= end) {
    const key = isoDayKey(cursor);
    byDay.set(key, createBankTimelineEntry(dayLabelFormatter.format(cursor)));
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const record of records) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const entry = byDay.get(isoDayKey(parsed));
    if (entry) addBankRecordToEntry(entry, record);
  }

  return Array.from(byDay.values());
}

function buildMonthlyBankOverview(records) {
  const byMonth = new Map();

  for (const record of records) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const key = isoMonthKey(parsed);
    if (!byMonth.has(key)) {
      byMonth.set(key, createBankTimelineEntry(monthLabelFormatter.format(new Date(`${key}-01T00:00:00`))));
    }
    addBankRecordToEntry(byMonth.get(key), record);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => entry);
}

function BankDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);

  const loadData = ({ background = false } = {}) => {
    if (!background) {
      setLoading(true);
    }
    setError("");
    getBankData()
      .then((response) => {
        setData(response);
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

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => {
      setError("");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const records = data?.records || [];
  const summary = data?.summary || {
    total_income: 0,
    total_expenses: 0,
    net_balance: 0,
    category_totals: {},
  };

  const stats = [
    { label: "Total income", value: formatter.format(summary.total_income) },
    { label: "Total expenses", value: formatter.format(summary.total_expenses) },
    { label: "Net balance", value: formatter.format(summary.net_balance) },
  ];

  const categoryTotals = summary.category_totals || {};
  const chartData = [
    { label: "Income", value: Number(categoryTotals["income"] || 0) },
    { label: "Service cost", value: Number(categoryTotals["service cost"] || 0) },
    { label: "Investment cost", value: Number(categoryTotals["investment cost"] || 0) },
    { label: "Operation cost", value: Number(categoryTotals["operation cost"] || 0) },
  ];

  const dailyOverview = useMemo(() => buildDailyBankOverview(records), [records]);
  const monthlyOverview = useMemo(() => buildMonthlyBankOverview(records), [records]);

  const tableRows = [...records].reverse().map((record) => ({
    id: record.id,
    date: record.date,
    category: record.category,
    description: record.description || "",
    amount: formatter.format(record.amount),
  }));

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
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Bank Module</p>
          <h1>Bank dashboard</h1>
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
      {error ? <pre className="error-pre">{error}</pre> : null}

      {!loading && !error ? (
        <>
          <StatGrid items={stats} />
          <section className="card">
            <div className="page-header" style={{ marginBottom: 12 }}>
              <div>
                <h3>Bank trends</h3>
                <p className="subtitle">Hover bars to see exact values. Drag the lower scrubber to move through history.</p>
              </div>
            </div>
            <div className="graph-grid">
              <InteractiveTimelineChart
                title="Daily Bank Overview"
                subtitle="Income, expenses, and net balance by transaction date."
                data={dailyOverview}
                windowSize={12}
                bars={[
                  { dataKey: "income", name: "Income", color: "#16a34a" },
                  { dataKey: "expenses", name: "Expenses", color: "#ef4444" },
                  { dataKey: "netDisplay", rawDataKey: "netRaw", name: "Net balance", color: "#0f766e", negativeColor: "#f59e0b" },
                ]}
              />
              <InteractiveTimelineChart
                title="Monthly Bank Overview"
                subtitle="Month-wise income, expenses, and net balance."
                data={monthlyOverview}
                windowSize={12}
                bars={[
                  { dataKey: "income", name: "Income", color: "#16a34a" },
                  { dataKey: "expenses", name: "Expenses", color: "#ef4444" },
                  { dataKey: "netDisplay", rawDataKey: "netRaw", name: "Net balance", color: "#0f766e", negativeColor: "#f59e0b" },
                ]}
              />
            </div>
          </section>
          <section className="card">
            <h3>All transactions</h3>
            <TransactionsTable
              columns={columns}
              rows={tableRows}
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
          <BarChart title="Category totals" data={chartData} />
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
