import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { addShareEntry, getShareData, updateShareEntry } from "../api/shareApi";
import ShareForm from "../components/ShareForm";
import { getTodayInputValue } from "../utils/date";

function SharePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editIdRaw = searchParams.get("edit");
  const editId = editIdRaw ? Number(editIdRaw) : null;
  const [form, setForm] = useState({
    dates: getTodayInputValue(),
    share_name: "",
    category: "ipo",
    per_unit_price: "",
    allotted: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [knownShares, setKnownShares] = useState([]);
  const [portfolioRows, setPortfolioRows] = useState([]);

  const loadShareMeta = () => {
    setLoading(true);
    setError("");
    return getShareData()
      .then((response) => {
        const records = response?.records || [];

        const names = Array.from(new Set(records.map((r) => String(r.share_name || "").trim()).filter(Boolean))).sort(
          (a, b) => a.localeCompare(b)
        );
        setKnownShares(names);

        // Remaining shares by share name (tracker-only).
        const remainingByName = new Map();
        for (const record of records) {
          const name = String(record.share_name || "").trim();
          if (!name) continue;
          const category = String(record.category || "").trim().toLowerCase();
          const qty = Number(record.allotted || 0);
          const delta = category === "sell" ? -qty : ["ipo", "buy"].includes(category) ? qty : 0;
          remainingByName.set(name, (remainingByName.get(name) || 0) + delta);
        }

        const rows = Array.from(remainingByName.entries())
          .map(([share_name, remaining]) => ({ share_name, remaining }))
          .filter((row) => row.remaining > 0)
          .sort((a, b) => a.share_name.localeCompare(b.share_name));
        setPortfolioRows(rows);

        return records;
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadShareMeta()
      .then((records) => {
        if (!editId) return;
        const record = (records || []).find((r) => Number(r.id) === Number(editId));
        if (!record) {
          throw new Error("Share record not found for editing.");
        }
        setForm({
          dates: record.date || getTodayInputValue(),
          share_name: record.share_name || "",
          category: String(record.category || "ipo").toLowerCase(),
          per_unit_price: String(record.per_unit_price ?? ""),
          allotted: String(record.allotted ?? ""),
          buy_sell: String(record.buy_sell || record.category || "").toLowerCase(),
          _dividendType:
            String(record.category || "").toLowerCase() === "dividend"
              ? String(record.buy_sell || "cash").toLowerCase()
              : undefined,
          _totalAmount:
            ["buy", "sell"].includes(String(record.category || "").toLowerCase()) ? String(record.total_amount ?? "") : "",
        });
      })
      .catch((err) => setError(err.message || "Unable to load share entry for editing."))
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

    const payload = {
      ...form,
      buy_sell: form.category === "dividend" ? String(form._dividendType || "cash").toLowerCase() : form.category,
    };
    console.log("[SharePage] submit payload", payload);

    try {
      const response = editId ? await updateShareEntry(editId, payload) : await addShareEntry(payload);
      console.log("[SharePage] /share/add response", response);
      if (editId) {
        setSuccess("Entry updated successfully.");
        navigate("/share", { replace: true });
        setForm({
          dates: getTodayInputValue(),
          share_name: "",
          category: "ipo",
          per_unit_price: "",
          allotted: "",
          _dividendType: undefined,
          _totalAmount: "",
        });
      } else {
        setSuccess("Entry saved successfully.");
        setForm((prev) => ({
          ...prev,
          share_name: "",
          per_unit_price: "",
          allotted: prev.category === "dividend" && prev._dividendType === "cash" ? "0" : "",
          _totalAmount: "",
        }));
      }

      // Refresh suggestions + portfolio panel after saving.
      loadShareMeta();
    } catch (err) {
      setError(err.message || "Unable to save share entry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Share Module</p>
          <h1>{editId ? "Edit share entry" : "Add share entry"}</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" type="button" onClick={() => navigate(-1)}>
            Back
          </button>
          <Link className="ghost" to="/">
            Home
          </Link>
          <button className="ghost" type="button" onClick={() => navigate("/share-dashboard")}>
            View dashboard
          </button>
        </div>
      </header>
      {loading ? <p>Loading entry...</p> : null}

      <div className="split-layout">
        <div>
          <ShareForm
            value={form}
            onChange={setForm}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitLabel={editId ? "Update Share Entry" : "Add Share Entry"}
            suggestions={knownShares}
          />
          {success ? <p className="success">{success}</p> : null}
          {error ? <pre className="error-pre">{error}</pre> : null}
        </div>

        <aside className="card sticky-panel">
          <h3>Portfolio (Remaining)</h3>
          <div className="table-wrapper mini-table">
            <table>
              <thead>
                <tr>
                  <th>Share Name</th>
                  <th>Remaining Shares</th>
                </tr>
              </thead>
              <tbody>
                {portfolioRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="empty-state">
                      No remaining shares yet.
                    </td>
                  </tr>
                ) : (
                  portfolioRows.map((row) => (
                    <tr key={row.share_name}>
                      <td>{row.share_name}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.remaining}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default SharePage;
