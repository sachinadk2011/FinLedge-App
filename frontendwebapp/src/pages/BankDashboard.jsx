import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { deleteBankRecord, getBankData } from "../api/bankApi";
import BarChart from "../components/BarChart";
import StatGrid from "../components/StatGrid";
import TransactionsTable from "../components/TransactionsTable";

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function BankDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const loadData = () => {
    setLoading(true);
    setError("");
    getBankData()
      .then((response) => {
        setData(response);
      })
      .catch((err) => {
        setError(err.message || "Unable to load bank data.");
      })
      .finally(() => {
        setLoading(false);
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
    const ok = window.confirm("Delete this bank entry? This will update the Excel file.");
    if (!ok) return;

    setDeletingId(recordId);
    setError("");
    try {
      await deleteBankRecord(recordId);
      loadData();
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
                    onClick={() => handleDelete(row.id)}
                    disabled={deletingId === row.id}
                  >
                    {deletingId === row.id ? "Deleting..." : "Delete"}
                  </button>
                </>
              )}
            />
          </section>
          <BarChart title="Category totals" data={chartData} />
        </>
      ) : null}
    </main>
  );
}

export default BankDashboard;
