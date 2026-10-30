import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { createTransfer, getPersonalFinanceData, updateTransfer } from "../api/personalFinanceApi";
import TransactionsTable from "../components/TransactionsTable";
import StatusNotice from "../components/StatusNotice";
import {
  normalizeTransferDirection,
  PERSONAL_FINANCE_TRANSFER_DIRECTIONS,
  transferActionLabel,
} from "../constants/options";
import { getTodayInputValue } from "../utils/date";
import { clearAmountAndDescription } from "../utils/forms";
import { sortHistoryNewestFirst } from "../utils/history";

const fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getDefaultForm() {
  return {
    dates: getTodayInputValue(),
    direction: PERSONAL_FINANCE_TRANSFER_DIRECTIONS[0].value,
    amount: "",
    description: "",
  };
}

function PersonalFinanceTransferPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromFlow = searchParams.get("from") === "cash" ? "cash" : "bank";

  // Edit mode: ?edit=N means editing transfer sequential ID N
  const editIdRaw = searchParams.get("edit");
  const editId = editIdRaw ? Number(editIdRaw) : null;
  const isEditing = Boolean(editId);

  const [form, setForm] = useState(getDefaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [transferHistory, setTransferHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  function loadHistory(callback) {
    setLoadingHistory(true);
    getPersonalFinanceData()
      .then((response) => {
        const allTransfers = sortHistoryNewestFirst(response?.records || [])
          .filter((r) => r.source === "transfer")
          .filter(
            (r, idx, arr) =>
              arr.findIndex(
                (x) => x.source_ref === r.source_ref && x.flow_type === r.flow_type
              ) === idx
          )
          .filter((r) => (r.signed_amount ?? -1) < 0);
        if (callback) callback(allTransfers);
        setTransferHistory(allTransfers.slice(0, 12));
      })
      .catch(() => setTransferHistory([]))
      .finally(() => setLoadingHistory(false));
  }

  useEffect(() => {
    loadHistory((allTransfers) => {
      if (!editId) return;
      const found = allTransfers.find((r) => {
        const numPart = String(r.id || "").replace(/^transfer-/, "");
        return Number(numPart) === editId;
      });
      if (!found) return;
      setForm({
        dates: found.date || getTodayInputValue(),
        direction: normalizeTransferDirection(found.transfer_direction) || PERSONAL_FINANCE_TRANSFER_DIRECTIONS[0].value,
        amount: String(found.amount || ""),
        description: (found.description || "").replace(
          /^(Withdrawn to Cash|Deposited to Bank)(: )?/,
          ""
        ),
      });
    });
  }, [editId]);

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.amount || amt <= 0) {
      setError("Please enter a valid amount greater than 0.");
      setForm((prev) => clearAmountAndDescription(prev));
      return;
    }
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateTransfer(editId, form);
        const dirLabel = transferActionLabel(form.direction);
        setSuccess(`Transfer updated: ${dirLabel} of ${fmt.format(amt)}.`);
        setForm((prev) => clearAmountAndDescription(prev));
        navigate("/personal-finance-transfer", { replace: true });
      } else {
        await createTransfer(form);
        const dirLabel = transferActionLabel(form.direction);
        setSuccess(`${dirLabel} of ${fmt.format(amt)} recorded successfully.`);
        setForm((prev) => clearAmountAndDescription(prev));
        loadHistory();
      }
    } catch (err) {
      setError(err.message || "Unable to record transfer.");
      setForm((prev) => clearAmountAndDescription(prev));
    } finally {
      setSubmitting(false);
    }
  }

  const historyColumns = [
    { key: "date", label: "Date" },
    { key: "dirLabel", label: "Direction" },
    { key: "amount", label: "Amount" },
    { key: "description", label: "Notes" },
  ];

  const historyRows = transferHistory.map((r) => {
    const numPart = String(r.id || "").replace(/^transfer-/, "");
    return {
      id: r.id,
      _seqId: Number(numPart),
      date: r.date,
      dirLabel: PERSONAL_FINANCE_TRANSFER_DIRECTIONS.find(
        (direction) => direction.value === normalizeTransferDirection(r.transfer_direction)
      )?.label || r.description || "Transfer",
      amount: fmt.format(r.amount),
      description: (r.description || "").replace(
        /^(Withdrawn to Cash|Deposited to Bank)(: )?/,
        ""
      ) || "-",
    };
  });

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Personal Expenses</p>
          <h1>{isEditing ? "Edit Transfer" : "Transfer Money"}</h1>
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
          <button
            className="ghost"
            type="button"
            onClick={() => navigate(`/personal-finance-dashboard?view=${fromFlow}`)}
          >
            View Dashboard
          </button>
        </div>
      </header>

      <section className="card">
        <h2>{isEditing ? "Edit Transfer" : "Bank ↔ Cash Transfer"}</h2>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={form.dates}
              onChange={(e) => setForm((f) => ({ ...f, dates: e.target.value }))}
              required
            />
          </label>

          <label className="field">
            <span>Transfer Direction</span>
            <select
              value={form.direction}
              onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
            >
              {PERSONAL_FINANCE_TRANSFER_DIRECTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Amount</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </label>

          <label className="field">
            <span>Notes (optional)</span>
            <input
              placeholder="e.g., ATM withdrawal, cash deposit"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button type="submit" disabled={submitting}>
              {submitting
                ? isEditing ? "Saving..." : "Recording..."
                : isEditing ? "Save Changes" : "Transfer"}
            </button>
            {isEditing && (
              <button
                type="button"
                className="ghost"
                onClick={() => navigate("/personal-finance-transfer", { replace: true })}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <StatusNotice message={success} kind="success" onDismiss={() => setSuccess("")} />
        <StatusNotice message={error} onDismiss={() => setError("")} />
      </section>

      {!isEditing && (
        <section className="card">
          <h3>Recent transfers</h3>
          {loadingHistory ? (
            <p>Loading transfer history...</p>
          ) : historyRows.length === 0 ? (
            <p style={{ color: "#64748b" }}>No transfers recorded yet.</p>
          ) : (
            <TransactionsTable
              columns={historyColumns}
              rows={historyRows}
              actions={(row) => (
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    navigate(
                      `/personal-finance-transfer?edit=${row._seqId}&from=${fromFlow}`
                    )
                  }
                >
                  Edit
                </button>
              )}
            />
          )}
        </section>
      )}
    </main>
  );
}

export default PersonalFinanceTransferPage;


