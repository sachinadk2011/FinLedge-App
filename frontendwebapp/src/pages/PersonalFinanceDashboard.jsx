import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { deletePersonalFinanceRecord, getPersonalFinanceData } from "../api/personalFinanceApi";
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
import { parseDate, isoDayKey, isoMonthKey } from "../utils/date";
import { buildDashboardBuckets } from "../utils/dashboardPeriod";
import { addTransferReceivers, getDirectionLabel, getSourceLabel } from "../utils/personalFinance";
import { summarizePersonalFlowRecords } from "../utils/summaries";
import { sortHistoryNewestFirst } from "../utils/history";

const formatter = {
  format: (val) => formatCurrency(val)
};

function buildBreakdownRows(values = {}, color) {
  return Object.entries(values)
    .map(([label, value]) => ({ label, value: Number(value || 0), color }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function buildFlowOverview(records, flowType, buckets, monthly) {
  const byKey = new Map(buckets.map((bucket) => [bucket.key, { ...bucket, income: 0, expenses: 0, netDisplay: 0, netRaw: 0 }]));
  for (const record of records) {
    if (flowType !== "combined" && record.flow_type !== flowType) continue;
    if (flowType === "combined" && record.source === "transfer") continue;
    const parsed = parseDate(record.date);
    if (!parsed) continue;
    const key = monthly ? isoMonthKey(parsed) : isoDayKey(parsed);
    const entry = byKey.get(key);
    if (!entry) continue;
    const amount = Number(record.amount || 0);
    if (record.source === "transfer") {
      const signedAmount = Number(record.signed_amount || 0);
      if (signedAmount >= 0) entry.income += signedAmount;
      else entry.expenses += Math.abs(signedAmount);
      entry.netRaw += signedAmount;
    } else if (record.direction === "income") {
      entry.income += amount;
      entry.netRaw += amount;
    } else {
      entry.expenses += amount;
      entry.netRaw -= amount;
    }
    entry.netDisplay = Math.abs(entry.netRaw);
  }

  return Array.from(byKey.values());
}

function FlowDashboard({ title, netLabel, summary, records, flowType, navigate, deletingId, setPendingDeleteRow, bounds, range, search, onSearchChange, category, onCategoryChange }) {
  const monthly = range === "year" || range === "all_time" || (range === "custom" && bounds && (bounds.end - bounds.start) / 86400000 > 60);
  const buckets = useMemo(() => buildDashboardBuckets(records, bounds, { monthly }), [records, bounds, monthly]);
  const overview = useMemo(() => buildFlowOverview(records, flowType, buckets, monthly), [records, flowType, buckets, monthly]);
  const flowRows = useMemo(
    () =>
      sortHistoryNewestFirst(records.filter((record) => record.flow_type === flowType))
        .map((record) => ({
          id: record.id,
          display_id: record.display_id || `${flowType === "cash" ? "C" : "B"}-${record.id}`,
          date: record.date,
          direction: getDirectionLabel(record),
          category: record.category,
          description: record.description || "-",
          amount: formatter.format(record.amount),
          source: getSourceLabel(record.source),
          raw: record,
        })),
    [records, flowType],
  );
  const filteredRows = flowRows.filter((row) => (category === "all" || row.category === category)
    && (!search.trim() || `${row.category} ${row.description}`.toLowerCase().includes(search.trim().toLowerCase())));
  const stats = flowType === "bank"
    ? [
        { label: "Income", value: formatter.format(summary.income || 0) },
        { label: "Expense", value: formatter.format(summary.expenses || 0) },
        ...(summary.transfer_out > 0 ? [{ label: "Transferred to Cash", value: formatter.format(summary.transfer_out || 0) }] : []),
        ...(summary.transfer_in > 0 ? [{ label: "Received from Cash", value: formatter.format(summary.transfer_in || 0) }] : []),
        { label: "Total income", value: formatter.format(summary.total_income || 0) },
        { label: "Total expense", value: formatter.format(summary.total_expenses || 0) },
        { label: "Net profit/loss", value: formatter.format(summary.net || 0) },
      ]
    : [
        { label: "Income", value: formatter.format(summary.income || 0) },
        { label: "Expense", value: formatter.format(summary.total_expenses || 0) },
        ...(summary.transfer_out > 0 ? [{ label: "Transferred to Bank", value: formatter.format(summary.transfer_out || 0) }] : []),
        ...(summary.transfer_in > 0 ? [{ label: "Received from Bank", value: formatter.format(summary.transfer_in || 0) }] : []),
        { label: "Total income", value: formatter.format(summary.total_income || 0) },
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
        {buildBreakdownRows(summary.expense_breakdown, "#f2555f").length ? <BarChart title={`${title} expense breakdown`} data={buildBreakdownRows(summary.expense_breakdown, "#f2555f")} /> : null}
        {buildBreakdownRows(summary.income_breakdown, "#22c55e").length ? <BarChart title={`${title} income breakdown`} data={buildBreakdownRows(summary.income_breakdown, "#22c55e")} /> : null}
      </div>
      <section className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div>
            <h3>{title} trend</h3>
          </div>
        </div>
        <InteractiveTimelineChart
          title={`${title} Overview`}
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
      </section>
      <section className="card">
        <h3>All {title} transactions</h3>
        <TransactionFilters search={search} onSearchChange={onSearchChange} category={category} onCategoryChange={onCategoryChange} categories={Array.from(new Set(flowRows.map((row) => row.category))).map((value) => ({ value, label: value }))} />
        <TransactionsTable
          columns={columns}
          rows={filteredRows}
          actions={(row) =>
            row.raw?.source !== "manual" ? (
              <span className="muted-text">Read-only</span>
            ) : (
              <>
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    navigate(
                      `/personal-finance-entry?edit=${row.id}&recordFlow=${row.raw.flow_type}`
                    )
                  }
                >
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
            )
          }
        />
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
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(true);
  const { deletingId, pendingDeleteRow, setPendingDeleteRow, runDelete } = useDeleteConfirmation();
  const [tableSearch, setTableSearch] = useState("");
  const [tableCategory, setTableCategory] = useState("all");
  const period = useDashboardPeriod("week");

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  function loadData(background = false) {
    if (!background) setLoading(true);
    getPersonalFinanceData()
      .then((response) => {
        setData(response);
        if (response?.warnings?.length) setWarning(response.warnings.join(" "));
      })
      .catch((err) => setError(err.message || "Unable to load Personal Expenses data."))
      .finally(() => { if (!background) setLoading(false); });
  }

  useEffect(() => { loadData(); }, []);

  async function handleDelete(row) {
    if (!row) return;
    setError("");
    await runDelete(row.id, async () => {
      try {
        await deletePersonalFinanceRecord(row.id, row.raw?.flow_type || "bank");
        setPendingDeleteRow(null);
        loadData(true);
      } catch (err) {
        setError(err.message || "Unable to delete record.");
      }
    });
  }

  const records = data?.records || [];
  const periodRecords = useMemo(() => period.filterRecords(records), [records, period.bounds]);
  const periodBounds = useMemo(() => period.boundsForRecords(records), [records, period.range, period.bounds]);
  const flowRecords = useMemo(() => addTransferReceivers(periodRecords), [periodRecords]);
  const summary = useMemo(() => summarizePersonalFlowRecords(flowRecords), [flowRecords]);
  const combinedStats = [
    { label: "Overall income", value: formatter.format(summary.combined?.overall_income || 0) },
    { label: "Overall expenses", value: formatter.format(summary.combined?.overall_expenses || 0) },
    { label: "Overall net/savings", value: formatter.format(summary.combined?.overall_net || 0) },
    { label: "Bank net", value: formatter.format(summary.bank?.net || 0) },
    { label: "Cash net", value: formatter.format(summary.cash?.net || 0) },
  ];
  const bankAnalytics = [
    { label: "Bank income", value: Number(summary.bank?.income || 0), color: "#22c55e" },
    { label: "Bank expenses", value: Number(summary.bank?.total_expenses || 0), color: "#f2555f" },
    { label: "Bank net", value: Number(summary.bank?.net || 0), color: Number(summary.bank?.net || 0) < 0 ? "#f5a524" : "#14b8a6" },
  ].filter((item) => item.value !== 0);
  const cashAnalytics = [
    { label: "Cash income", value: Number(summary.cash?.income || 0), color: "#22c55e" },
    { label: "Cash expenses", value: Number(summary.cash?.total_expenses || 0), color: "#f2555f" },
    { label: "Cash net", value: Number(summary.cash?.net || 0), color: Number(summary.cash?.net || 0) < 0 ? "#f5a524" : "#14b8a6" },
  ].filter((item) => item.value !== 0);

  const isMonthly = period.range === "year" || period.range === "all_time" || (period.range === "custom" && periodBounds && (periodBounds.end - periodBounds.start) / 86400000 > 60);
  const periodBuckets = useMemo(() => buildDashboardBuckets(periodRecords, periodBounds, { monthly: isMonthly }), [periodRecords, periodBounds, isMonthly]);
  const combinedOverview = useMemo(() => buildFlowOverview(periodRecords, "combined", periodBuckets, isMonthly), [periodRecords, periodBuckets, isMonthly]);

  const recentRows = sortHistoryNewestFirst(periodRecords)
    .map((record) => ({
      id: record.id,
      display_id: record.display_id || `${record.flow_type === "cash" ? "C" : "B"}-${record.id}`,
      date: record.date,
      flow: record.flow_type === "cash" ? "Cash Flow" : "Bank Flow",
      direction: getDirectionLabel(record),
      category: record.category,
      amount: formatter.format(record.amount),
      description: record.description || "-",
      source: getSourceLabel(record.source),
      raw: record,
    }));

  const combinedColumns = [
    { key: "date", label: "Date" },
    { key: "flow", label: "Flow" },
    { key: "direction", label: "Type" },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "amount", label: "Amount" },
    { key: "source", label: "Source" },
  ];

  return (
    <main className="page wide-dashboard personal-finance-dashboard-page">
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
      <DashboardPeriodFilter {...period} />

      {loading ? <p>Loading Personal Expenses dashboard...</p> : null}
      <StatusNotice message={period.importNotice} kind="success" />
      <StatusNotice message={error} onDismiss={() => setError("")} />
      <StatusNotice message={warning} kind="warning" onDismiss={() => setWarning("")} />

      {!loading ? (
        <>
          {activeView === "combined" ? (
            <>
              <section className="card">
                <h3>Combined Overview</h3>
                <StatGrid items={combinedStats} />
              </section>
              <div className="graph-grid">
                {bankAnalytics.length ? <BarChart title="Bank flow breakdown" data={bankAnalytics} /> : null}
                {cashAnalytics.length ? <BarChart title="Cash flow breakdown" data={cashAnalytics} /> : null}
              </div>
              <section className="card">
                <h3>Combined trend</h3>
                <InteractiveTimelineChart
                  title="Personal Expenses Overview"
                  data={combinedOverview}
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
              </section>
              <section className="card">
                <h3>All Personal Expenses transactions</h3>
                <TransactionFilters search={tableSearch} onSearchChange={setTableSearch} category={tableCategory} onCategoryChange={setTableCategory} categories={Array.from(new Set(recentRows.map((row) => row.category))).map((value) => ({ value, label: value }))} placeholder="Search by category or description" />
                <TransactionsTable
                  columns={combinedColumns}
                  rows={recentRows.filter((row) => (tableCategory === "all" || row.category === tableCategory) && (!tableSearch.trim() || `${row.category} ${row.description} ${row.flow}`.toLowerCase().includes(tableSearch.trim().toLowerCase())))}
                  actions={(row) =>
                    row.raw?.source !== "manual" ? (
                      <span className="muted-text">Read-only</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            navigate(
                              `/personal-finance-entry?edit=${row.id}&recordFlow=${row.raw.flow_type}`
                            )
                          }
                        >
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
                    )
                  }
                />
              </section>
            </>
          ) : null}

          {activeView === "bank" ? (
            <FlowDashboard
              title="Bank Flow"
              netLabel="Bank Net"
              summary={summary.bank}
              records={flowRecords}
              flowType="bank"
              navigate={navigate}
              deletingId={deletingId}
              setPendingDeleteRow={setPendingDeleteRow}
              bounds={periodBounds}
              range={period.range}
              search={tableSearch}
              onSearchChange={setTableSearch}
              category={tableCategory}
              onCategoryChange={setTableCategory}
            />
          ) : null}

          {activeView === "cash" ? (
            <FlowDashboard
              title="Cash Flow"
              netLabel="Cash Net"
              summary={summary.cash}
              records={flowRecords}
              flowType="cash"
              navigate={navigate}
              deletingId={deletingId}
              setPendingDeleteRow={setPendingDeleteRow}
              bounds={periodBounds}
              range={period.range}
              search={tableSearch}
              onSearchChange={setTableSearch}
              category={tableCategory}
              onCategoryChange={setTableCategory}
            />
          ) : null}
        </>
      ) : null}

      <DeleteConfirmationDialog
        record={pendingDeleteRow}
        title="Delete personal finance entry?"
        message={
          pendingDeleteRow
            ? `This will remove the ${pendingDeleteRow.category} entry from ${pendingDeleteRow.date}.`
            : ""
        }
        onCancel={() => setPendingDeleteRow(null)}
        onConfirm={() => handleDelete(pendingDeleteRow)}
      />
    </main>
  );
}

export default PersonalFinanceDashboard;

