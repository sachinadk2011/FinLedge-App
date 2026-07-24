import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { deleteShareRecord, getShareData, updateShareAllotment, updateSipAllotment } from "../api/shareApi";
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

function createShareTimelineEntry(label) {
  return {
    label,
    regularInvestment: 0,
    sipInvestment: 0,
    sipRedeemed: 0,
    sellAmount: 0,
    profitLossDisplay: 0,
    profitLossRaw: 0,
  };
}

function addShareRecordToEntry(entry, record) {
  const category = String(record.category || "").trim().toLowerCase();
  const buySell = String(record.buy_sell || "").trim().toLowerCase();
  const totalAmount = Number(record.total_amount || 0);
  const profitLoss = Number(record.profit_loss || 0);

  if (category === "ipo" || category === "buy") {
    entry.regularInvestment += totalAmount;
  } else if (category === "sip") {
    if (buySell === "redeem") {
      entry.sipRedeemed += totalAmount;
      entry.profitLossRaw += profitLoss;
    } else {
      entry.sipInvestment += totalAmount;
    }
  } else if (category === "sell") {
    entry.sellAmount += totalAmount;
    entry.profitLossRaw += profitLoss;
  } else if (category === "dividend" && buySell === "cash") {
    entry.profitLossRaw += totalAmount;
  }

  entry.profitLossDisplay = Math.abs(entry.profitLossRaw);
}

function buildDailyShareOverview(records) {
  const datedItems = records.map((record) => parseDate(record.date)).filter(Boolean);
  if (datedItems.length === 0) return [];

  const start = new Date(Math.min(...datedItems.map((item) => item.getTime())));
  const end = new Date(Math.max(...datedItems.map((item) => item.getTime())));
  const byDay = new Map();

  const cursor = new Date(start);
  while (cursor <= end) {
    const key = isoDayKey(cursor);
    byDay.set(key, createShareTimelineEntry(dayLabelFormatter.format(cursor)));
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const record of records) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const entry = byDay.get(isoDayKey(parsed));
    if (entry) addShareRecordToEntry(entry, record);
  }

  return Array.from(byDay.values());
}

function buildMonthlyShareOverview(records) {
  const byMonth = new Map();

  for (const record of records) {
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const key = isoMonthKey(parsed);
    if (!byMonth.has(key)) {
      byMonth.set(key, createShareTimelineEntry(monthLabelFormatter.format(new Date(`${key}-01T00:00:00`))));
    }
    addShareRecordToEntry(byMonth.get(key), record);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => entry);
}

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
  const [sipSearchName, setSipSearchName] = useState("");
  const [newSipAllotted, setNewSipAllotted] = useState("");
  const [sipUpdating, setSipUpdating] = useState(false);
  const [sipUpdateMessage, setSipUpdateMessage] = useState("");
  const [sipUpdateError, setSipUpdateError] = useState("");
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
    if (!updateMessage && !updateError && !sipUpdateMessage && !sipUpdateError && !error) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setUpdateMessage("");
      setUpdateError("");
      setSipUpdateMessage("");
      setSipUpdateError("");
      setError("");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [updateMessage, updateError, sipUpdateMessage, sipUpdateError, error]);

  const records = data?.records || [];
  const summary = data?.summary || {
    total_ipo_investment: 0,
    total_sip_investment: 0,
    total_sip_redeemed: 0,
    sip_profit_loss: 0,
    total_buy_amount: 0,
    overall_investment: 0,
    total_sell_amount: 0,
    total_dividend: 0,
    total_profit: 0,
    overall_profit_loss: 0,
    grand_total_investment: 0,
    grand_profit_loss: 0,
  };
  const totalIpoInvestment = Number(summary.total_ipo_investment || 0);
  const totalSipInvestment = Number(summary.total_sip_investment || 0);
  const totalSipRedeemed = Number(summary.total_sip_redeemed || 0);
  const sipProfitLoss = Number(summary.sip_profit_loss || 0);
  const totalBuyAmount = Number(summary.total_buy_amount || 0);
  const normalInvestment = Number(summary.overall_investment ?? totalIpoInvestment + totalBuyAmount);
  const totalSellAmount = Number(summary.total_sell_amount || 0);
  const totalDividend = Number(summary.total_dividend || 0);
  const totalProfit = Number(summary.total_profit || 0);
  const normalProfitLoss = Number(summary.overall_profit_loss ?? totalProfit + totalDividend - normalInvestment);
  const grandTotalInvestment = Number(summary.grand_total_investment ?? normalInvestment + totalSipInvestment);
  const grandProfitLoss = Number(summary.grand_profit_loss ?? normalProfitLoss + sipProfitLoss);

  const normalStats = [
    { label: "Total IPO investment", value: formatter.format(totalIpoInvestment) },
    { label: "Secondary buy amount", value: formatter.format(totalBuyAmount) },
    { label: "IPO + secondary investment", value: formatter.format(normalInvestment) },
    { label: "Total sell amount", value: formatter.format(totalSellAmount) },
    { label: "Total dividend", value: formatter.format(totalDividend) },
    { label: "Realized trading profit", value: formatter.format(totalProfit) },
    { label: "IPO/secondary profit/loss", value: formatter.format(normalProfitLoss) },
  ];

  const sipStats = [
    { label: "SIP investment", value: formatter.format(totalSipInvestment) },
    { label: "SIP redeemed", value: formatter.format(totalSipRedeemed) },
    { label: "SIP profit/loss", value: formatter.format(sipProfitLoss) },
  ];

  const grandStats = [
    { label: "Grand total investment", value: formatter.format(grandTotalInvestment) },
    { label: "Grand total profit/loss", value: formatter.format(grandProfitLoss) },
  ];

  const chartData = [
    { label: "IPO + secondary", value: normalInvestment },
    { label: "SIP", value: totalSipInvestment },
    { label: "SIP redeemed", value: totalSipRedeemed },
    { label: "Grand investment", value: grandTotalInvestment },
    { label: "Sell", value: totalSellAmount },
    { label: "Grand profit/loss", value: grandProfitLoss },
  ];

  const dailyOverview = useMemo(() => buildDailyShareOverview(records), [records]);
  const monthlyOverview = useMemo(() => buildMonthlyShareOverview(records), [records]);

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
    } else if (record.category === "sip") {
      catDisplay = record.buy_sell === "redeem" ? "SIP (Redeem)" : "SIP (Installment)";
    }
    
    return {
      id: record.id,
      date: record.date,
      share_name: record.share_name,
      category: catDisplay,
      per_unit_price:
        // SIP: never show per-unit price — profit is on total invested vs total redeemed
        record.category === "sip"
          ? "-"
          : (record.category === "dividend" && record.buy_sell === "bonus")
            ? "-"
            : formatter.format(record.per_unit_price),
      asba_charge: record.category === "dividend" || record.category === "sip" ? "-" : formatter.format(record.asba_charge),
      allotted:
        record.category === "dividend" && record.buy_sell === "cash"
          ? "-"
          // SIP redeem — no unit count, it's a full redemption by amount
          : record.category === "sip" && record.buy_sell === "redeem"
            ? "—"
          // SIP installment with no units allocated yet
          : record.category === "sip" && !record.allotted
            ? "Pending"
            : record.allotted,
      total_amount: record.category === "dividend" && record.buy_sell === "bonus" ? "-" : formatter.format(record.total_amount),
      profit_loss:
        record.category === "ipo" || record.category === "buy" || (record.category === "sip" && record.buy_sell !== "redeem")
          ? "-"
          : formatter.format(record.profit_loss),
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

  const sipRecords = useMemo(() => {
    return records
      .filter((record) => String(record.category || "").trim().toLowerCase() === "sip")
      .filter((record) => String(record.buy_sell || "").trim().toLowerCase() !== "redeem")
      .filter((record) => String(record.share_name || "").trim())
      .map((record) => ({
        id: record.id,
        share_name: String(record.share_name || "").trim(),
        date: String(record.date || "").trim(),
        allotted: Number(record.allotted || 0),
        total_amount: Number(record.total_amount || 0),
      }));
  }, [records]);

  const sipNames = useMemo(() => Array.from(new Set(sipRecords.map((record) => record.share_name))), [sipRecords]);

  const sipMatches = useMemo(() => {
    const term = sipSearchName.trim().toLowerCase();
    if (!term) {
      return [];
    }
    return sipNames.filter((name) => name && name.toLowerCase().includes(term));
  }, [sipNames, sipSearchName]);

  const uniqueSipMatches = Array.from(new Set(sipMatches)).slice(0, 5);

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

  async function handleSipUpdate(event) {
    event.preventDefault();
    setSipUpdateMessage("");
    setSipUpdateError("");
    setSipUpdating(true);
    try {
      const selectedName = sipSearchName.trim();
      const matchedSip = sipRecords.find((record) => record.share_name.toLowerCase() === selectedName.toLowerCase());

      if (!matchedSip) {
        throw new Error("Select a share name that exists as a SIP entry.");
      }

      const response = await updateSipAllotment({
        share_name: matchedSip.share_name,
        allotted: Number(newSipAllotted),
      });

      const updated = response?.data || {};
      const previousAllotted = Number(updated.previous_allotted ?? matchedSip.allotted ?? 0);
      const currentAllotted = Number(updated.allotted ?? Number(newSipAllotted));
      const averagePrice = Number(updated.average_price || 0);
      const updatedLabel = updated.date ? `${updated.share_name} (${updated.date})` : updated.share_name || matchedSip.share_name;

      setSipUpdateMessage(
        `Updated SIP entry for ${updatedLabel}: ${previousAllotted} -> ${currentAllotted}. Average price: ${formatter.format(averagePrice)}.`
      );
      setSipSearchName("");
      setNewSipAllotted("");
      loadData({ background: true });
    } catch (err) {
      const rawMessage = err.message || "Unable to update SIP share quantity.";
      const normalized = String(rawMessage).toLowerCase();
      if (normalized.includes("no sip entry found") || normalized.includes("only sip entries")) {
        setSipUpdateError("Only SIP entries can be updated from this form.");
      } else {
        setSipUpdateError(rawMessage);
      }
    } finally {
      setSipUpdating(false);
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
          <p className="eyebrow">Share Portfolio</p>
          <h1>Share portfolio dashboard</h1>
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
          <section className="card">
            <h3>IPO and secondary position</h3>
            <p className="subtitle">This block shows money invested through IPO entries and secondary buy/sell activity.</p>
            <StatGrid items={normalStats} />
          </section>
          <section className="card">
            <h3>SIP position</h3>
            <p className="subtitle">This block stays separate from IPO and secondary transactions.</p>
            <StatGrid items={sipStats} />
          </section>
          <section className="card">
            <h3>Grand total</h3>
            <p className="subtitle">Combined view of IPO, secondary, and SIP investment.</p>
            <StatGrid items={grandStats} />
          </section>
          <BarChart title="Investment, sell, and profit/loss breakdown" data={chartData} />
          <section className="card">
            <div className="page-header" style={{ marginBottom: 12 }}>
              <div>
                <h3>Share portfolio trends</h3>
                <p className="subtitle">Hover bars to see exact values. Drag the lower scrubber to move through history.</p>
              </div>
            </div>
            <div className="graph-grid">
              <InteractiveTimelineChart
                title="Daily Share Portfolio Overview"
                subtitle="IPO/secondary investment, SIP investment, sell amount, and profit/loss by date."
                data={dailyOverview}
                windowSize={12}
                bars={[
                  { dataKey: "regularInvestment", name: "IPO + secondary", color: "#2563eb" },
                  { dataKey: "sipInvestment", name: "SIP investment", color: "#0f766e" },
                  { dataKey: "sipRedeemed", name: "SIP redeemed", color: "#14b8a6" },
                  { dataKey: "sellAmount", name: "Sell amount", color: "#f59e0b" },
                  { dataKey: "profitLossDisplay", rawDataKey: "profitLossRaw", name: "Profit/loss", color: "#a855f7", negativeColor: "#ef4444" },
                ]}
              />
              <InteractiveTimelineChart
                title="Monthly Share Portfolio Overview"
                subtitle="Month-wise summary of normal share activity and SIP investment."
                data={monthlyOverview}
                windowSize={12}
                bars={[
                  { dataKey: "regularInvestment", name: "IPO + secondary", color: "#2563eb" },
                  { dataKey: "sipInvestment", name: "SIP investment", color: "#0f766e" },
                  { dataKey: "sipRedeemed", name: "SIP redeemed", color: "#14b8a6" },
                  { dataKey: "sellAmount", name: "Sell amount", color: "#f59e0b" },
                  { dataKey: "profitLossDisplay", rawDataKey: "profitLossRaw", name: "Profit/loss", color: "#a855f7", negativeColor: "#ef4444" },
                ]}
              />
            </div>
          </section>
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
          <section className="card">
            <h3>Update SIP shares</h3>
            {sipNames.length === 0 ? (
              <p className="subtitle">No SIP entries available to update.</p>
            ) : (
              <form onSubmit={handleSipUpdate} className="inline-form">
                <label className="field">
                  <span>Search share (SIP only)</span>
                  <input
                    value={sipSearchName}
                    onChange={(e) => setSipSearchName(e.target.value)}
                    placeholder="Type SIP share name"
                    required
                  />
                </label>
                <label className="field">
                  <span>Total SIP shares</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={newSipAllotted}
                    onChange={(e) => setNewSipAllotted(e.target.value)}
                    placeholder="Share quantity"
                    required
                  />
                </label>
                <button type="submit" disabled={sipUpdating}>
                  {sipUpdating ? "Updating..." : "Update SIP"}
                </button>
              </form>
            )}
            {sipUpdateError ? <p className="error">{sipUpdateError}</p> : null}
            {sipUpdateMessage ? <p className="success">{sipUpdateMessage}</p> : null}
            {uniqueSipMatches.length > 0 ? (
              <div className="match-list">
                {uniqueSipMatches.map((name) => (
                  <button key={name} type="button" className="chip" onClick={() => setSipSearchName(name)}>
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
