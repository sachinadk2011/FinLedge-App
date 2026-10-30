/**
 * utils/format.js — Shared formatting utilities for FinLedge frontend.
 *
 * Centralises helpers that were previously copy-pasted into
 * BankDashboard, ShareDashboard, PersonalFinanceDashboard,
 * PersonalFinancePage, and Summary.
 */

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

const _currencyFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a number as a plain comma-separated decimal (e.g. "1,234.56").
 * Does NOT prepend a currency symbol — callers add "NPR", "Rs.", etc. as needed.
 */
export function formatCurrency(value) {
  return _currencyFmt.format(value ?? 0);
}
/** Match mobile chart labels: negatives keep their sign and large amounts use k/L. */
export function compactMoney(value) {
  const number = Number(value || 0);
  const sign = number < 0 ? "-" : "";
  const amount = Math.abs(number);
  if (amount >= 100000) {
    const compact = amount / 100000;
    return `${sign}${Number.isInteger(compact) ? compact.toFixed(0) : compact.toFixed(1)}L`;
  }
  if (amount >= 1000) {
    const compact = amount / 1000;
    return `${sign}${Number.isInteger(compact) ? compact.toFixed(0) : compact.toFixed(1)}k`;
  }
  return `${sign}${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
