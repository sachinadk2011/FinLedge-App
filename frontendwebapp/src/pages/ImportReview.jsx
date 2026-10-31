import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { confirmReviewedSettingsImport } from "../api/settingsApi";
import StatusNotice from "../components/StatusNotice";

const STORAGE_KEY = "finledge.import-review.v1";

const REVIEW_FIELDS = {
  bank: ["Date", "Category", "Amount", "Description"],
  share: ["Date", "Share Name", "Category", "Per Unit Price", "Charge", "Allotted", "Buy/Sell", "Total Amount"],
  "pf-bank": ["Date", "Flow Type", "Direction", "Category", "Amount", "Description", "Source", "Source Ref"],
  "pf-cash": ["Date", "Flow Type", "Direction", "Category", "Amount", "Description", "Source", "Source Ref"],
  "pf-transfer": ["Date", "Transfer Direction", "Amount", "Description"],
};

function readReview() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function cellValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function reviewErrorText(error) {
  const message = String(error?.message || "Import could not be confirmed.");
  if (message.toLowerCase().includes("not enough available quantity")) {
    return "This sale is ordered before enough shares are available. Move the same-day purchase above the sale, or correct the transaction dates, then try again.";
  }
  return message;
}

function ImportReview() {
  const navigate = useNavigate();
  const [review, setReview] = useState(() => readReview());
  const [rows, setRows] = useState(() => (readReview()?.rows || []).map((row, index) => ({
    ...row,
    _review_key: String(row._review_key || row["Row ID"] || `row-${index}`),
  })));
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [completed, setCompleted] = useState(false);
  const [movedKey, setMovedKey] = useState("");

  useEffect(() => {
    if (!review && !completed) {
      navigate("/settings", { replace: true });
      return;
    }
    if (completed) return;
    const persisted = { ...review, rows };
    delete persisted.currentStep;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch { /* The current review remains available in memory. */ }
  }, [review, rows, navigate, completed]);

  const fields = REVIEW_FIELDS[review?.data_type] || [];
  const filteredIndexes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.map((row, index) => ({ row, index })).filter(({ row }) =>
      !term || Object.values(row).some((value) => cellValue(value).toLowerCase().includes(term))
    );
  }, [rows, search]);

  if (completed) {
    return (
      <main className="page">
        <header className="page-header"><div><p className="eyebrow">Import data</p><h1>Import complete</h1></div></header>
        <StatusNotice message={success} kind="success" />
        <p>The reviewed data has been saved. You are still on the Import page.</p>
      </main>
    );
  }

  if (!review) return null;

  function updateField(index, field, value) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index
      ? { ...row, [field]: value, _edited: true }
      : row));
    setError("");
  }

  function removeRow(index) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setError("");
  }

  function moveRow(index, offset) {
    const target = index + offset;
    if (target < 0 || target >= rows.length) return;
    const moved = rows[index];
    setMovedKey(String(moved._review_key || moved["Row ID"] || `row-${index}`));
    setRows((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setError("");
  }

  function cancelReview() {
    localStorage.removeItem(STORAGE_KEY);
    navigate("/settings");
  }

  async function confirmImport() {
    setSubmitting(true);
    setError("");
    try {
      const result = await confirmReviewedSettingsImport(review.data_type, rows, review.mode || "replace");
      localStorage.removeItem(STORAGE_KEY);
      const mergeReport = result?.data?.merge_report;
      const importedCount = review.mode === "merge" && mergeReport
        ? Number(mergeReport.added || 0) + Number(mergeReport.updated || 0)
        : (result?.data?.imported_rows ?? rows.length);
      const skippedCount = Number(mergeReport?.skipped_unchanged || 0);
      setSuccess(`Import complete: ${importedCount} ${importedCount === 1 ? "record" : "records"} added or updated${skippedCount ? `; ${skippedCount} unchanged rows skipped` : ""}.`);
      setCompleted(true);
    } catch (exception) {
      setError(reviewErrorText(exception));
    } finally {
      setSubmitting(false);
    }
  }

  const report = review.merge_report || {};

  return (
    <main className="page wide-dashboard">
      <header className="page-header">
        <div>
          <p className="eyebrow">Import data</p>
          <h1>Review import</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" type="button" onClick={cancelReview}>Cancel import</button>
          <Link className="ghost" to="/settings">Settings</Link>
        </div>
      </header>

      <StatusNotice message={success} kind="success" />
      <StatusNotice message={error} onDismiss={() => setError("")} />

      <section className="card">
        <h2>Import summary</h2>
        <p className="subtitle" style={{ marginTop: 12 }}>
          {review.label || review.data_type} · {review.filename || "Excel workbook"} · {review.mode === "merge" ? "Merge" : "Replace"}
        </p>
        <div className="stat-grid">
          <div className="stat-card"><span className="stat-label">Rows to review</span><strong className="stat-value">{rows.length}</strong></div>
          {review.mode === "merge" ? (
            <>
              <div className="stat-card"><span className="stat-label">New rows</span><strong className="stat-value">{report.added || 0}</strong></div>
              <div className="stat-card"><span className="stat-label">Already present</span><strong className="stat-value">{report.skipped_unchanged || 0}</strong></div>
              <div className="stat-card"><span className="stat-label">Conflicts</span><strong className="stat-value">{report.conflicts || 0}</strong></div>
            </>
          ) : null}
        </div>
        {review.validation_error ? (
          <StatusNotice kind="warning" message={`Ordering check: ${review.validation_error}. You can adjust the row order below and confirm again.`} />
        ) : null}
      </section>

      <section className="card">
        <label className="field">
          <span>Search reviewed rows</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by date, amount, category, or description" />
        </label>
      </section>

      {filteredIndexes.map(({ row, index }) => (
        <section
          className={`card${movedKey && movedKey === String(row._review_key || row["Row ID"] || `row-${index}`) ? " import-row-moved" : ""}`}
          key={String(row._review_key || row["Row ID"] || index)}
        >
          <div className="page-header" style={{ marginBottom: 12 }}>
            <h3>Row {index + 1}</h3>
            <div className="header-actions">
              <button
                className="ghost import-row-icon-button"
                type="button"
                onClick={() => moveRow(index, -1)}
                disabled={index === 0}
                aria-label={`Move row ${index + 1} up`}
                title="Move up"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5m0 0 6 6m-6-6-6 6" /></svg>
              </button>
              <button
                className="ghost import-row-icon-button"
                type="button"
                onClick={() => moveRow(index, 1)}
                disabled={index === rows.length - 1}
                aria-label={`Move row ${index + 1} down`}
                title="Move down"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14m0 0 6-6m-6 6-6-6" /></svg>
              </button>
              <button className="ghost danger" type="button" onClick={() => removeRow(index)}>Remove row</button>
            </div>
          </div>
          <div className="import-review-grid">
            {fields.map((field) => (
              <label className="field" key={field}>
                <span>{field}</span>
                <input
                  type={field === "Date" ? "date" : "text"}
                  inputMode={["Amount", "Per Unit Price", "Charge", "Allotted", "Total Amount"].includes(field) ? "decimal" : undefined}
                  value={cellValue(row[field])}
                  onChange={(event) => updateField(index, field, event.target.value)}
                />
              </label>
            ))}
          </div>
          {row._edited ? <p className="subtitle">Edited · saved with a new update timestamp</p> : null}
        </section>
      ))}

      {rows.length === 0 ? <section className="card"><p className="subtitle">No rows remain. Add at least one row before confirming.</p></section> : null}

      <div className="import-review-footer">
        <p className="subtitle">
          {rows.length} reviewed {rows.length === 1 ? "row" : "rows"} will be {review.mode === "merge" ? "merged" : "used to replace the selected data type"}.
        </p>
        <button type="button" onClick={confirmImport} disabled={submitting || rows.length === 0}>
          {submitting ? "Saving import…" : "Confirm import"}
        </button>
      </div>
    </main>
  );
}

export default ImportReview;
