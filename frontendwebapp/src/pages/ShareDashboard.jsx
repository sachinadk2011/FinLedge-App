import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { deleteShareRecord, getShareData, updateShareAllotment, updateSipAllotment } from "../api/shareApi";
import BarChart from "../components/BarChart";
import ConfirmDialog from "../components/ConfirmDialog";
import InteractiveTimelineChart from "../components/InteractiveTimelineChart";
import StatGrid from "../components/StatGrid";
import StatusNotice from "../components/StatusNotice";
import TransactionsTable from "../components/TransactionsTable";
import DashboardPeriodFilter from "../components/DashboardPeriodFilter";
import TransactionFilters from "../components/TransactionFilters";
import useDashboardPeriod from "../hooks/useDashboardPeriod";

import { formatCurrency } from "../utils/format";
import { parseDate, isoDayKey, isoMonthKey } from "../utils/date";
import { buildDashboardBuckets } from "../utils/dashboardPeriod";

const formatter = {
  format: (val) => formatCurrency(val)
};

function shareFlowSign(record) {
  const category = String(record.category || "").trim().toLowerCase();
  const buySell = String(record.buy_sell || "").trim().toLowerCase();
  if (category === "ipo" || category === "buy") return -1;
  if (category === "sip") return ["redeem", "redeemed"].includes(buySell) ? 1 : -1;
  if (category === "sell" || (category === "dividend" && buySell === "cash")) return 1;
  return 0;
}

function buildShareOverview(records, buckets, monthly) {
  const byKey = new Map(buckets.map((bucket) => [bucket.key, { ...bucket, flowRaw: 0, flowDisplay: 0 }]));
  records.forEach((record) => {
    const date = parseDate(record.date);
    if (!date) return;
    const key = monthly ? isoMonthKey(date) : isoDayKey(date);
    const entry = byKey.get(key);
    if (entry) entry.flowRaw += Math.abs(Number(record.total_amount || 0)) * shareFlowSign(record);
  });
  byKey.forEach((entry) => { entry.flowDisplay = Math.abs(entry.flowRaw); });
  return [...byKey.values()];
}

function ShareDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
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
  const [tableCategory, setTableCategory] = useState("all");
  const period = useDashboardPeriod("week", { importTypes: ["share"] });

  const loadData = ({ background = false } = {}) => {
    if (!background) {
      setLoading(true);
    }
    setError("");
    getShareData()
      .then((response) => {
        setData(response);
        if (response?.warnings?.length) setWarning(response.warnings.join(" "));
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

  const records = data?.records || [];
  const periodRecords = useMemo(() => period.filterRecords(records), [records, period.bounds]);
  const periodBounds = useMemo(() => period.boundsForRecords(records), [records, period.range, period.bounds]);
  const summary = useMemo(() => {
    const totals = {
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
    periodRecords.forEach((record) => {
      const category = String(record.category || "").toLowerCase();
      const action = String(record.buy_sell || "").toLowerCase();
      const amount = Number(record.total_amount || 0);
      const profit = Number(record.profit_loss || 0);
      if (category === "ipo") totals.total_ipo_investment += amount;
      else if (category === "buy") totals.total_buy_amount += amount;
      else if (category === "sell") { totals.total_sell_amount += amount; totals.total_profit += profit; }
      else if (category === "sip" && ["redeem", "redeemed"].includes(action)) { totals.total_sip_redeemed += amount; totals.sip_profit_loss += profit; }
      else if (category === "sip") totals.total_sip_investment += amount;
      else if (category === "dividend" && action === "cash") totals.total_dividend += amount;
    });
    totals.overall_investment = totals.total_ipo_investment + totals.total_buy_amount;
    totals.overall_profit_loss = totals.total_profit + totals.total_dividend - totals.overall_investment;
    totals.grand_total_investment = totals.overall_investment + totals.total_sip_investment;
    totals.grand_profit_loss = totals.overall_profit_loss + totals.sip_profit_loss;
    return totals;
  }, [periodRecords]);
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
    { label: "IPO + secondary", value: normalInvestment, color: "#f2555f" },
    { label: "SIP", value: totalSipInvestment, color: "#f2555f" },
    { label: "SIP redeemed", value: totalSipRedeemed, color: "#22c55e" },
    { label: "Grand investment", value: grandTotalInvestment, color: "#f2555f" },
    { label: "Sell", value: totalSellAmount, color: "#22c55e" },
    { label: "Grand profit/loss", value: grandProfitLoss, color: grandProfitLoss < 0 ? "#f2555f" : "#22c55e" },
  ].filter((item) => item.value !== 0);

  const isMonthly = period.range === "year" || period.range === "all_time" || (period.range === "custom" && periodBounds && (periodBounds.end - periodBounds.start) / 86400000 > 60);
  const periodBuckets = useMemo(() => buildDashboardBuckets(periodRecords, periodBounds, { monthly: isMonthly }), [periodRecords, periodBounds, isMonthly]);
  const overview = useMemo(() => buildShareOverview(periodRecords, periodBuckets, isMonthly), [periodRecords, periodBuckets, isMonthly]);

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

  const tableRows = [...periodRecords].reverse().map((record) => {
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
    return tableRows.filter((row) => (tableCategory === "all" || row.category === tableCategory)
      && (!term || `${row.share_name} ${row.category}`.toLowerCase().includes(term)));
  }, [tableRows, tableSearch, tableCategory]);

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
    <main className="page wide-dashboard">
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
      <StatusNotice message={error} onDismiss={() => setError("")} />
      <StatusNotice message={warning} kind="warning" onDismiss={() => setWarning("")} />

      {data ? (
        <>
          <DashboardPeriodFilter {...period} />
          <section className="card">
            <h3>IPO and secondary position</h3>
            <StatGrid items={normalStats} />
          </section>
          <section className="card">
            <h3>SIP position</h3>
            <StatGrid items={sipStats} />
          </section>
          <section className="card">
            <h3>Grand total</h3>
            <StatGrid items={grandStats} />
          </section>
          {chartData.length ? <BarChart title="Investment, sell, and profit/loss breakdown" data={chartData} /> : null}
          <section className="card">
            <div className="page-header" style={{ marginBottom: 12 }}>
              <div>
                <h3>Share portfolio trends</h3>
              </div>
            </div>
            <div className="graph-grid">
              <InteractiveTimelineChart
                title="Share Portfolio Overview"
                data={overview}
                windowSize={12}
                bars={[
                  { dataKey: "flowDisplay", rawDataKey: "flowRaw", name: "Portfolio net flow", color: "#22c55e", negativeColor: "#f2555f", signColor: true },
                ]}
                moduleDashboard
                legendItems={[
                  { label: "Money in / positive", color: "#22c55e" },
                  { label: "Money out / negative", color: "#f2555f" },
                ]}
              />
            </div>
          </section>
          <section className="card">
            <h3>All share transactions</h3>
            <TransactionFilters search={tableSearch} onSearchChange={setTableSearch} category={tableCategory} onCategoryChange={setTableCategory} categories={Array.from(new Set(tableRows.map((row) => row.category))).map((category) => ({ value: category, label: category }))} placeholder="Search by share name or category" />
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
            <StatusNotice message={updateError} onDismiss={() => setUpdateError("")} />
            <StatusNotice message={updateMessage} kind="success" onDismiss={() => setUpdateMessage("")} />
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
            <StatusNotice message={sipUpdateError} onDismiss={() => setSipUpdateError("")} />
            <StatusNotice message={sipUpdateMessage} kind="success" onDismiss={() => setSipUpdateMessage("")} />
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
