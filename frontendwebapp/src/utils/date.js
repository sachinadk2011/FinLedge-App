/**
 * utils/date.js — Shared date helpers for FinLedge frontend.
 *
 * Centralises helpers previously copy-pasted into
 * BankDashboard, ShareDashboard, PersonalFinanceDashboard, and Summary.
 */

export function getTodayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const adjusted = new Date(now.getTime() - offset * 60 * 1000);
  return adjusted.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Formatters (reuse instances — avoid creating new ones on every render)
// ---------------------------------------------------------------------------

export const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a date value that may be a JS Date, ISO string, or Excel serial number
 * into a proper JS Date.  Returns null if the value is falsy or unparseable.
 */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  // Date-only values represent a calendar day, not a UTC instant.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  // ISO datetime values are converted to local time before grouping.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
  // Excel serial (numeric string)
  const num = Number(s);
  if (!isNaN(num) && num > 1000) {
    // Excel epoch starts 1899-12-30
    const excelDate = new Date(Math.round((num - 25569) * 86400 * 1000));
    return new Date(excelDate.getUTCFullYear(), excelDate.getUTCMonth(), excelDate.getUTCDate());
  }
  return null;
}

/**
 * Return an "YYYY-MM-DD" string for grouping by day.
 * Returns null if the value cannot be parsed.
 */
export function isoDayKey(dateValue) {
  const d = parseDate(dateValue);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Return a "YYYY-MM" string for grouping by month.
 * Returns null if the value cannot be parsed.
 */
export function isoMonthKey(dateValue) {
  const d = parseDate(dateValue);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
