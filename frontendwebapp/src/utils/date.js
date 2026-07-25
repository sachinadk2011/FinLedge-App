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
  // ISO date or datetime
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
  // Excel serial (numeric string)
  const num = Number(s);
  if (!isNaN(num) && num > 1000) {
    // Excel epoch starts 1899-12-30
    return new Date(Math.round((num - 25569) * 86400 * 1000));
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
  return d.toISOString().slice(0, 10);
}

/**
 * Return a "YYYY-MM" string for grouping by month.
 * Returns null if the value cannot be parsed.
 */
export function isoMonthKey(dateValue) {
  const d = parseDate(dateValue);
  if (!d) return null;
  return d.toISOString().slice(0, 7);
}
