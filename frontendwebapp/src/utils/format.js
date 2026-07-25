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

// ---------------------------------------------------------------------------
// Source labels (Personal Finance synced rows)
// ---------------------------------------------------------------------------

/**
 * Return a human-readable label for a Personal Finance row's source field.
 * Used in both PersonalFinancePage and PersonalFinanceDashboard.
 */
export function getSourceLabel(source) {
  if (source === "bank-services-sync") return "Bank Services";
  if (source === "share-sync") return "Share Portfolio";
  return "Manual";
}
