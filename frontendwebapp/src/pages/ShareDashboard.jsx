import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { deleteShareRecord, getShareData, updateShareAllotment } from "../api/shareApi";
import BarChart from "../components/BarChart";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import InteractiveTimelineChart from "../components/InteractiveTimelineChart";
import StatGrid from "../components/StatGrid";
import StatusNotice from "../components/StatusNotice";
import TransactionsTable from "../components/TransactionsTable";
import DashboardPeriodFilter from "../components/DashboardPeriodFilter";
import TransactionFilters from "../components/TransactionFilters";
import useDashboardPeriod from "../hooks/useDashboardPeriod";
import useDeleteConfirmation from "../hooks/useDeleteConfirmation";

import { formatCurrency } from "../utils/format";
import { summarizeShareRecords } from "../utils/summaries";
import { getTodayInputValue, parseDate, isoDayKey, isoMonthKey } from "../utils/date";
import { buildDashboardBuckets } from "../utils/dashboardPeriod";
import { sortHistoryNewestFirst } from "../utils/history";

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
  const { deletingId, pendingDeleteRow, setPendingDeleteRow, runDelete } = useDeleteConfirmation();
  const [tableCategory, setTableCategory] = useState("all");
  const period = useDashboardPeriod("week");

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
  const periodRecords = useMemo(() => period.filterRecords(records), [records, period.range, period.bounds]);
  const periodBounds = useMemo(() => period.boundsForRecords(records), [records, period.range, period.bounds]);
  const closingEndDate = isoDayKey(period.bounds?.end) || getTodayInputValue();
  const summary = useMemo(() => summarizeShareRecords(periodRecords, records, closingEndDate), [periodRecords, records, closingEndDate]);
  const totalIpoInvestment = Number(summary.total_ipo_investment || 0);
  const totalSipInvestment = Number(summary.total_sip_investment || 0);
  const totalSipRedeemed = Number(summary.total_sip_redeemed || 0);
  const totalBuyAmount = Number(summary.total_buy_amount || 0);
  const normalInvestment = Number(summary.overall_investment ?? totalIpoInvestment + totalBuyAmount);
  const totalSellAmount = Number(summary.total_sell_amount || 0);
  const totalDividend = Number(summary.total_dividend || 0);
  const totalProfit = Number(summary.total_profit || 0);
  const normalProfitLoss = Number(summary.overall_profit_loss ?? totalProfit + totalDividend - normalInvestment);
  const grandTotalInvestment = Number(summary.grand_total_investment ?? normalInvestment + totalSipInvestment);
  const grandProfitLoss = Number(summary.grand_net_cash_result ?? summary.grand_profit_loss ?? normalProfitLoss);

  const normalStats = [
    { label: "Total IPO investment", value: formatter.format(totalIpoInvestment) },
    { label: "Secondary buy amount", value: formatter.format(totalBuyAmount) },
    { label: "IPO + secondary investment", value: formatter.format(normalInvestment) },
    { label: "Total sell amount", value: formatter.format(totalSellAmount) },
    { label: "Total dividend", value: formatter.format(totalDividend) },
    { label: "Bonus shares received", value: String(summary.bonus_shares_received || 0) },
    { label: "Realized trading profit", value: formatter.format(totalProfit) },
    { label: `Share holding cost as of ${closingEndDate}`, value: formatter.format(summary.share_holding_cost || 0) },
    { label: "Share net cash result", value: formatter.format(summary.share_net_cash_result || 0) },
  ];

  const sipStats = [
    { label: "SIP investment", value: formatter.format(totalSipInvestment) },
    { label: "SIP redeemed", value: formatter.format(totalSipRedeemed) },
    { label: `SIP unrecovered capital as of ${closingEndDate}`, value: formatter.format(summary.sip_unrecovered_capital || 0) },
    { label: "SIP net cash result", value: formatter.format(summary.sip_net_cash_result || 0) },
  ];

  const grandStats = [
    { label: "Grand total investment", value: formatter.format(grandTotalInvestment) },
    { label: `Grand holding cost as of ${closingEndDate}`, value: formatter.format(summary.grand_holding_cost || 0) },
    { label: "Grand total received", value: formatter.format(summary.grand_total_received || 0) },
    { label: "Grand net cash result", value: formatter.format(grandProfitLoss) },
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
    { key: "charge", label: "Charge" },
    { key: "allotted", label: "Allotted" },
    { key: "total_amount", label: "Total" },
    { key: "profit_loss", label: "Profit/Loss" },
  ];

  const tableRows = sortHistoryNewestFirst(periodRecords).map((record) => {
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
      charge: record.category === "dividend" ? "-" : formatter.format(record.charge ?? record.asba_charge ?? 0),
      allotted:
        record.category === "dividend" && record.buy_sell === "cash"
          ? "-"
          : record.category === "sip" ? "-" : record.allotted,
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

    setError("");
    await runDelete(recordId, async () => {
      try {
        await deleteShareRecord(recordId);
        setPendingDeleteRow(null);
        loadData({ background: true });
      } catch (err) {
        setError(err.message || "Unable to delete share record.");
      }
    });
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
      <StatusNotice message={period.importNotice} kind="success" />
      <StatusNotice message={error} onDismiss={() => setError("")} />
      <StatusNotice message={warning} kind="warning" onDismiss={() => setWarning("")} />

      {data ? (
        <>
          <DashboardPeriodFilter {...period} />
          <section className="card">
                <h3>Share activity and closing position</h3>
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
          <DeleteConfirmationDialog
            record={pendingDeleteRow}
            title="Delete share entry?"
            message={
              pendingDeleteRow
                ? `This will remove the ${pendingDeleteRow.share_name} entry from ${pendingDeleteRow.date}.`
                : ""
            }
            onCancel={() => setPendingDeleteRow(null)}
            onConfirm={() => handleDelete(pendingDeleteRow?.id)}
          />
        </>
      ) : null}
    </main>
  );
}

export default ShareDashboard;
