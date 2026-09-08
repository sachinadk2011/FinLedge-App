import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { createTransfer, getPersonalFinanceData, updateTransfer } from "../api/personalFinanceApi";
import TransactionsTable from "../components/TransactionsTable";
import { getTodayInputValue } from "../utils/date";

const TRANSFER_DIRECTIONS = [
  { value: "bank_to_cash", label: "Bank to Cash  (Withdraw)" },
  { value: "cash_to_bank", label: "Cash to Bank  (Deposit)" },
];

const fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getDefaultForm() {
  return {
    dates: getTodayInputValue(),
    direction: "bank_to_cash",
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
        const allTransfers = (response?.records || [])
          .filter((r) => r.source === "transfer")
          .filter(
            (r, idx, arr) =>
              arr.findIndex(
                (x) => x.source_ref === r.source_ref && x.flow_type === r.flow_type
              ) === idx
          )
          .filter((r) => (r.signed_amount ?? -1) < 0)
          .reverse();
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
        direction: found.transfer_direction || "bank_to_cash",
        amount: String(found.amount || ""),
        description: (found.description || "").replace(
          /^(Withdrawn to Cash|Deposited to Bank)(: )?/,
          ""
        ),
      });
    });
  }, [editId]);

  useEffect(() => {
    if (!success && !error) return;
    const timer = window.setTimeout(() => {
      setSuccess("");
      setError("");
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [success, error]);

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.amount || amt <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateTransfer(editId, form);
        const dirLabel =
          form.direction === "bank_to_cash" ? "Bank to Cash withdrawal" : "Cash to Bank deposit";
        setSuccess(`Transfer updated: ${dirLabel} of ${fmt.format(amt)}.`);
        navigate("/personal-finance-transfer", { replace: true });
      } else {
        await createTransfer(form);
        const dirLabel =
          form.direction === "bank_to_cash" ? "Bank to Cash withdrawal" : "Cash to Bank deposit";
        setSuccess(`${dirLabel} of ${fmt.format(amt)} recorded successfully.`);
        setForm(getDefaultForm());
        loadHistory();
      }
    } catch (err) {
      setError(err.message || "Unable to record transfer.");
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
      dirLabel:
        r.transfer_direction === "bank_to_cash"
          ? "Bank to Cash"
          : r.transfer_direction === "cash_to_bank"
          ? "Cash to Bank"
          : r.description || "Transfer",
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
        {!isEditing && (
          <p style={{ marginBottom: "1.1rem", color: "#64748b", fontSize: "0.93rem" }}>
            Move money between your bank account and cash. The originating side&apos;s income is
            reduced and the receiving side&apos;s income is increased by the same amount. Transfer
            cannot exceed available income on the originating side.
          </p>
        )}

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
              {TRANSFER_DIRECTIONS.map((d) => (
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

        {success ? (
          <p className="success" style={{ marginTop: "1rem" }}>
            {success}
          </p>
        ) : null}
        {error ? (
          <pre className="error-pre" style={{ marginTop: "1rem" }}>
            {error}
          </pre>
        ) : null}
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


