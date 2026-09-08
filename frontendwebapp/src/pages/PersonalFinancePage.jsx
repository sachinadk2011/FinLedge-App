import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import {
  addPersonalFinanceEntry,
  deletePersonalFinanceRecord,
  getPersonalFinanceData,
  updatePersonalFinanceEntry,
} from "../api/personalFinanceApi";
import ConfirmDialog from "../components/ConfirmDialog";
import PersonalFinanceForm from "../components/PersonalFinanceForm";
import TransactionsTable from "../components/TransactionsTable";
import {
  PERSONAL_FINANCE_EXPENSE_CATEGORIES,
  PERSONAL_FINANCE_INCOME_CATEGORIES,
} from "../constants/options";
import { getTodayInputValue } from "../utils/date";

function getDefaultForm(flowType = "bank") {
  const normalizedFlow = flowType === "cash" ? "cash" : "bank";
  return {
    dates: getTodayInputValue(),
    flow_type: normalizedFlow,
    direction: "expense",
    category: PERSONAL_FINANCE_EXPENSE_CATEGORIES[0],
    amount: "",
    description: "",
    source: "manual",
  };
}

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function normalizeEditCategory(record) {
  const categories =
    String(record.direction || "").toLowerCase() === "income"
      ? PERSONAL_FINANCE_INCOME_CATEGORIES
      : PERSONAL_FINANCE_EXPENSE_CATEGORIES;
  const found = categories.find((category) => category.toLowerCase() === String(record.category || "").toLowerCase());
  return found || categories[0];
}

function getSourceLabel(source) {
  if (source === "share-sync") return "Share Portfolio";
  if (source === "bank-services-sync") return "Bank Services";
  return "Manual";
}

function PersonalFinancePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editIdRaw = searchParams.get("edit");
  const requestedFlow = ["bank", "cash", "combined"].includes(searchParams.get("flow"))
    ? searchParams.get("flow")
    : "bank";
  const recordFlow = searchParams.get("recordFlow") === "cash" ? "cash" : "bank";
  const editId = editIdRaw ? Number(editIdRaw) : null;
  const [form, setForm] = useState(() => getDefaultForm(requestedFlow));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);

  const loadData = ({ background = false } = {}) => {
    if (!background) setLoading(true);
    setError("");
    return getPersonalFinanceData()
      .then((response) => {
        setData(response);
        return response?.records || [];
      })
      .catch((err) => {
        setError(err.message || "Unable to load Personal Expenses data.");
        return [];
      })
      .finally(() => {
        if (!background) setLoading(false);
      });
  };

  useEffect(() => {
    loadData().then((records) => {
      if (!editId) return;
      const record = records.find(
        (item) => Number(item.id) === Number(editId) && String(item.flow_type || "bank") === recordFlow,
      );
      if (!record) {
        setError("Personal Expenses record not found for editing.");
        return;
      }
      if (record.source !== "manual") {
        setError("Synced Personal Expenses records are read-only.");
        return;
      }
      setForm({
        dates: record.date || getTodayInputValue(),
        flow_type: String(record.flow_type || "bank").toLowerCase() === "cash" ? "cash" : "bank",
        direction: String(record.direction || "expense").toLowerCase() === "income" ? "income" : "expense",
        category: normalizeEditCategory(record),
        amount: String(Math.abs(Number(record.amount || 0))),
        description: record.description || "",
        source: "manual",
      });
    });
  }, [editId, recordFlow, requestedFlow]);

  useEffect(() => {
    if (editId) return;
    setForm((prev) => ({ ...prev, flow_type: requestedFlow === "cash" ? "cash" : "bank" }));
  }, [editId, requestedFlow]);

  useEffect(() => {
    if (!success && !error) return;
    const timer = window.setTimeout(() => {
      setSuccess("");
      setError("");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [success, error]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      if (editId) {
        await updatePersonalFinanceEntry(editId, recordFlow, form);
        setSuccess("Entry updated successfully.");
        navigate(`/personal-finance-entry?flow=${form.flow_type}`, { replace: true });
      } else {
        await addPersonalFinanceEntry(form);
        setSuccess("Entry saved successfully.");
      }
      setForm((prev) => ({
        ...getDefaultForm(prev.flow_type),
        flow_type: prev.flow_type,
        direction: prev.direction,
        category: prev.direction === "income" ? PERSONAL_FINANCE_INCOME_CATEGORIES[0] : PERSONAL_FINANCE_EXPENSE_CATEGORIES[0],
      }));
      loadData({ background: true });
    } catch (err) {
      setError(err.message || "Unable to save Personal Expenses entry.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(recordId) {
    if (!recordId) return;
    setDeletingId(recordId);
    setError("");
    try {
      await deletePersonalFinanceRecord(recordId, pendingDeleteRow?.raw?.flow_type || requestedFlow);
      setPendingDeleteRow(null);
      loadData({ background: true });
    } catch (err) {
      setError(err.message || "Unable to delete Personal Expenses record.");
    } finally {
      setDeletingId(null);
    }
  }

  const tableRows = useMemo(
    () =>
      [...(data?.records || [])]
        .filter((record) => record.source === "manual")
        .filter((record) => requestedFlow === "combined" || record.flow_type === form.flow_type)
        .reverse()
        .slice(0, 12)
        .map((record) => ({
          id: record.id,
          display_id: record.display_id || `${record.flow_type === "cash" ? "C" : "B"}-${record.id}`,
          date: record.date,
          flow: record.flow_type === "cash" ? "Cash Flow" : "Bank Flow",
          direction: record.direction === "income" ? "Income" : "Expense",
          category: record.category,
          description: record.description || "-",
          amount: formatter.format(record.amount),
          source: getSourceLabel(record.source),
          raw: record,
        })),
    [data, form.flow_type, requestedFlow],
  );

  const columns = [
    { key: "date", label: "Date" },
    { key: "flow", label: "Flow" },
    { key: "direction", label: "Type" },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "amount", label: "Amount" },
    { key: "source", label: "Source" },
  ];

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Personal Expenses</p>
          <h1>{editId ? "Edit personal expenses entry" : "Add personal expenses entry"}</h1>
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
          <button className="ghost" type="button" onClick={() => navigate(`/personal-finance-dashboard?view=${form.flow_type}`)}>
            View dashboard
          </button>
        </div>
      </header>

      {loading ? <p>Loading Personal Expenses data...</p> : null}
      <PersonalFinanceForm
        value={form}
        onChange={setForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editId ? "Update Personal Expenses Entry" : "Add Personal Expenses Entry"}
      />

      {/* Transfer banner */}
      <Link
        to={`/personal-finance-transfer?from=${form.flow_type}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.9rem 1.25rem",
          borderRadius: "12px",
          background: "linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%)",
          border: "1px solid #c7d2fe",
          textDecoration: "none",
          color: "#312e81",
          marginBottom: "0.25rem",
          transition: "box-shadow 0.15s, transform 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 18px rgba(99,102,241,0.13)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "";
          e.currentTarget.style.transform = "";
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontWeight: 600, fontSize: "0.95rem" }}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
            <path d="M7.5 3.75a.75.75 0 0 1 .75.75v1.19l1.72-1.72a.75.75 0 1 1 1.06 1.06L8.81 7.25H10a.75.75 0 0 1 0 1.5H7A.75.75 0 0 1 6.25 8V5a.75.75 0 0 1 .75-.75h.5ZM14 15.75a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-1.19l-1.72 1.72a.75.75 0 1 1-1.06-1.06l2.22-2.22H15a.75.75 0 0 1-.75-.75ZM3 12a9 9 0 0 1 16.83-4.5h-1.6a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 .75-.75v-3a.75.75 0 0 0-1.5 0v1.41A10.5 10.5 0 1 0 22.5 12a.75.75 0 0 0-1.5 0A9 9 0 0 1 3 12Z"/>
          </svg>
          Transfer money between Bank &amp; Cash
        </span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem", opacity: 0.85 }}>Transfer →</span>
      </Link>

      {success ? <p className="success">{success}</p> : null}
      {error ? <pre className="error-pre">{error}</pre> : null}


      <section className="card">
        <h3>Recent transactions</h3>
        <TransactionsTable
          columns={columns}
          rows={tableRows}
          actions={(row) =>
            row.raw?.source !== "manual" ? (
              <span className="muted-text">Read-only</span>
            ) : (
              <>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => navigate(`/personal-finance-entry?edit=${row.id}&recordFlow=${row.raw.flow_type}`)}
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

      <ConfirmDialog
        open={Boolean(pendingDeleteRow)}
        title="Delete personal finance entry?"
        message={
          pendingDeleteRow
            ? `This will remove the ${pendingDeleteRow.category} entry from ${pendingDeleteRow.date}.`
            : ""
        }
        confirming={deletingId === pendingDeleteRow?.id}
        onCancel={() => setPendingDeleteRow(null)}
        onConfirm={() => handleDelete(pendingDeleteRow?.id)}
      />
    </main>
  );
}

export default PersonalFinancePage;
