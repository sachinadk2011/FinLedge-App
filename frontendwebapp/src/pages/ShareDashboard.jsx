import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { deleteShareRecord, getShareData, updateShareAllotment } from "../api/shareApi";
import BarChart from "../components/BarChart";
import ConfirmDialog from "../components/ConfirmDialog";
import StatGrid from "../components/StatGrid";
import TransactionsTable from "../components/TransactionsTable";

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function ShareDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tableSearch, setTableSearch] = useState("");
  const [searchName, setSearchName] = useState("");
  const [newAllotted, setNewAllotted] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);

  const loadData = ({ background = false } = {}) => {
    if (!background) {
      setLoading(true);
    }
    setError("");
    getShareData()
      .then((response) => {
        setData(response);
      })
      .catch((err) => {
        setError(err.message || "Unable to load share data.");
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
    if (!updateMessage && !updateError && !error) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setUpdateMessage("");
      setUpdateError("");
      setError("");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [updateMessage, updateError, error]);

  const records = data?.records || [];
  const summary = data?.summary || {
    total_ipo_investment: 0,
    total_buy_amount: 0,
    overall_investment: 0,
    total_sell_amount: 0,
    total_dividend: 0,
    total_profit: 0,
    overall_profit_loss: 0,
  };

  const stats = [
    { label: "Total IPO investment", value: formatter.format(summary.total_ipo_investment) },
    { label: "Total buy amount", value: formatter.format(summary.total_buy_amount) },
    { label: "Overall investment", value: formatter.format(summary.overall_investment) },
    { label: "Total sell amount", value: formatter.format(summary.total_sell_amount) },
    { label: "Total dividend", value: formatter.format(summary.total_dividend) },
    { label: "Total profit", value: formatter.format(summary.total_profit) },
    { label: "Overall profit/loss", value: formatter.format(summary.overall_profit_loss) },
  ];

  const chartData = [
    { label: "Investment", value: Number(summary.overall_investment || 0) },
    { label: "Sell", value: Number(summary.total_sell_amount || 0) },
    { label: "Profit", value: Number(summary.overall_profit_loss || 0) },
  ];

  const columns = [
    { key: "date", label: "Date" },
    { key: "share_name", label: "Share" },
    { key: "category", label: "Category" },
    { key: "per_unit_price", label: "Price" },
    { key: "asba_charge", label: "ASBA Charge" },
    { key: "allotted", label: "Allotted" },
    { key: "total_amount", label: "Total" },
    { key: "profit_loss", label: "Profit/Loss" },
  ];

  const tableRows = [...records].reverse().map((record) => {
    let catDisplay = record.category;
    if (record.category === "dividend") {
      catDisplay = `Dividend (${record.buy_sell === "bonus" ? "Bonus" : "Cash"})`;
    }
    
    return {
      id: record.id,
      date: record.date,
      share_name: record.share_name,
      category: catDisplay,
      per_unit_price: record.category === "dividend" && record.buy_sell === "bonus" ? "-" : formatter.format(record.per_unit_price),
      asba_charge: record.category === "dividend" ? "-" : formatter.format(record.asba_charge),
      allotted: record.category === "dividend" && record.buy_sell === "cash" ? "-" : record.allotted,
      total_amount: record.category === "dividend" && record.buy_sell === "bonus" ? "-" : formatter.format(record.total_amount),
      profit_loss: record.category === "ipo" || record.category === "buy" ? "-" : formatter.format(record.profit_loss),
    };
  });

  const filteredTableRows = useMemo(() => {
    const term = tableSearch.trim().toLowerCase();
    if (!term) {
      return tableRows;
    }

    return tableRows.filter((row) => String(row.share_name || "").toLowerCase().includes(term));
  }, [tableRows, tableSearch]);

  const ipoRecords = useMemo(() => {
    return records
      .filter((record) => String(record.category || "").trim().toLowerCase() === "ipo")
      .filter((record) => String(record.share_name || "").trim())
      .map((record) => ({
        id: record.id,
        share_name: String(record.share_name || "").trim(),
        date: String(record.date || "").trim(),
        allotted: Number(record.allotted || 0),
      }));
  }, [records]);

  const ipoNames = useMemo(() => Array.from(new Set(ipoRecords.map((record) => record.share_name))), [ipoRecords]);

  const matches = useMemo(() => {
    const term = searchName.trim().toLowerCase();
    if (!term) {
      return [];
    }
    return ipoNames.filter((name) => name && name.toLowerCase().includes(term));
  }, [ipoNames, searchName]);

  const uniqueMatches = Array.from(new Set(matches)).slice(0, 5);

  async function handleUpdate(event) {
    event.preventDefault();
    setUpdateMessage("");
    setUpdateError("");
    setUpdating(true);
    try {
      const selectedName = searchName.trim();
      const matchedIpo = ipoRecords.find((record) => record.share_name.toLowerCase() === selectedName.toLowerCase());

      if (!matchedIpo) {
        throw new Error("Select a share name that exists as an IPO entry.");
      }

      const response = await updateShareAllotment({
        share_name: matchedIpo.share_name,
        allotted: Number(newAllotted),
      });

      const updated = response?.data || {};
      const previousAllotted = Number(updated.previous_allotted ?? matchedIpo.allotted ?? 0);
      const currentAllotted = Number(updated.allotted ?? Number(newAllotted));
      const updatedLabel = updated.date ? `${updated.share_name} (${updated.date})` : updated.share_name || matchedIpo.share_name;

      setUpdateMessage(`Updated IPO entry for ${updatedLabel}: ${previousAllotted} -> ${currentAllotted}.`);
      setSearchName("");
      setNewAllotted("");
      loadData({ background: true });
    } catch (err) {
      const rawMessage = err.message || "Unable to update IPO allotment.";
      const normalized = String(rawMessage).toLowerCase();
      if (normalized.includes("no ipo entry found") || normalized.includes("only ipo entries")) {
        setUpdateError("Only IPO entries can be updated from this form.");
      } else {
        setUpdateError(rawMessage);
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(recordId) {
    if (!recordId) return;

    setDeletingId(recordId);
    setError("");
    try {
      await deleteShareRecord(recordId);
      setPendingDeleteRow(null);
      loadData({ background: true });
    } catch (err) {
      setError(err.message || "Unable to delete share record.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Share Module</p>
          <h1>Share dashboard</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" type="button" onClick={() => navigate(-1)}>
            Back
          </button>
          <Link className="ghost" to="/">
            Home
          </Link>
          <Link className="ghost" to="/share">
            Add entry
          </Link>
        </div>
      </header>

      {loading && !data ? <p>Loading share data...</p> : null}
      {error ? <pre className="error-pre">{error}</pre> : null}

      {data ? (
        <>
          <StatGrid items={stats} />
          <section className="card">
            <h3>All share transactions</h3>
            <label className="field" style={{ maxWidth: 360, marginBottom: 12 }}>
              <span>Search by share name</span>
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Type share name to filter table"
                autoComplete="off"
              />
            </label>
            <TransactionsTable
              columns={columns}
              rows={filteredTableRows}
              actions={(row) => (
                <>
                  <button type="button" className="ghost" onClick={() => navigate(`/share?edit=${row.id}`)}>
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
          <BarChart title="Investment vs sell vs profit" data={chartData} />
          <section className="card">
            <h3>Update IPO allotment</h3>
            {ipoNames.length === 0 ? (
              <p className="subtitle">No IPO entries available to update.</p>
            ) : (
              <form onSubmit={handleUpdate} className="inline-form">
                <label className="field">
                  <span>Search share (IPO only)</span>
                  <input
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Type IPO share name"
                    required
                  />
                </label>
                <label className="field">
                  <span>New allotment</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={newAllotted}
                    onChange={(e) => setNewAllotted(e.target.value)}
                    placeholder="Allotted quantity"
                    required
                  />
                </label>
                <button type="submit" disabled={updating}>
                  {updating ? "Updating..." : "Update"}
                </button>
              </form>
            )}
            {updateError ? <p className="error">{updateError}</p> : null}
            {updateMessage ? <p className="success">{updateMessage}</p> : null}
            {uniqueMatches.length > 0 ? (
              <div className="match-list">
                {uniqueMatches.map((name) => (
                  <button key={name} type="button" className="chip" onClick={() => setSearchName(name)}>
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
          <ConfirmDialog
            open={Boolean(pendingDeleteRow)}
            title="Delete share entry?"
            message={
              pendingDeleteRow
                ? `This will remove the ${pendingDeleteRow.share_name} entry from ${pendingDeleteRow.date}.`
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

export default ShareDashboard;
