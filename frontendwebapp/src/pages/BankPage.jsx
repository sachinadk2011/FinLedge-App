import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { addBankEntry, getBankData, updateBankEntry } from "../api/bankApi";
import BankForm from "../components/BankForm";
import { BANK_CATEGORIES } from "../constants/options";
import { getTodayInputValue } from "../utils/date";

const VALID_BANK_CATEGORIES = new Set(
  (BANK_CATEGORIES || [])
    .map((category) =>
      String(
        typeof category === "string" ? category : category?.value ?? category?.label ?? "",
      )
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean),
);

function BankPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editIdRaw = searchParams.get("edit");
  const editId = editIdRaw ? Number(editIdRaw) : null;
  const [form, setForm] = useState({
    dates: getTodayInputValue(),
    category: "income",
    amount: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!editId) return;

    setLoading(true);
    setError("");
    getBankData()
      .then((response) => {
        const record = (response?.records || []).find((r) => Number(r.id) === Number(editId));
        if (!record) {
          throw new Error("Bank record not found for editing.");
        }
        const normalizedCategory = VALID_BANK_CATEGORIES.has(String(record.category || "").trim().toLowerCase())
          ? String(record.category || "").trim().toLowerCase()
          : "income";
        setForm({
          dates: record.date || getTodayInputValue(),
          category: normalizedCategory,
          // Keep the UI as positive entry; API normalizes sign based on category.
          amount: String(Math.abs(Number(record.amount || 0))),
          description: record.description || "",
        });
      })
      .finally(() => setLoading(false));
  }, [editId]);

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
        await updateBankEntry(editId, form);
        setSuccess("Entry updated successfully.");
        // Clear edit mode but keep the user on the same page.
        navigate("/bank", { replace: true });
        setForm({
          dates: getTodayInputValue(),
          category: "income",
          amount: "",
          description: "",
        });
      } else {
        await addBankEntry(form);
        setSuccess("Entry saved successfully.");
        // Keep user on the same page for quick entry.
        setForm((prev) => ({
          ...prev,
          amount: "",
          description: "",
        }));
      }
    } catch (err) {
      setError(err.message || "Unable to save bank entry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Bank Module</p>
          <h1>{editId ? "Edit bank entry" : "Add bank entry"}</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" type="button" onClick={() => navigate(-1)}>
            Back
          </button>
          <Link className="ghost" to="/">
            Home
          </Link>
          <button className="ghost" type="button" onClick={() => navigate("/bank-dashboard")}>
            View dashboard
          </button>
        </div>
      </header>
      {loading ? <p>Loading entry...</p> : null}
      <BankForm
        value={form}
        onChange={setForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editId ? "Update Bank Entry" : "Add Bank Entry"}
      />
      {success ? <p className="success">{success}</p> : null}
      {error ? <pre className="error-pre">{error}</pre> : null}
    </main>
  );
}

export default BankPage;
