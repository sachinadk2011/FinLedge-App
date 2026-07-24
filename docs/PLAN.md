# PLAN.md

## Vision
FinLedge is evolving from a finance tracker into an offline-first
Personal Financial Operating System.

## Hard Constraints (do not violate these in any task)
1. Preserve current UI and navigation exactly — this includes the
   top-level app navigation (Bank Services, Share Portfolio, Personal
   Finance, Financial Summary, Settings). Never move app nav into a
   sidebar or restructure it.
2. Preserve workflow: Home → Module → Entry Form → Transaction Table →
   Dashboard button.
3. Every module keeps its own dedicated dashboard — never consolidate.
4. Expand business logic; do not redesign existing UI patterns.
5. Migration must never destroy user data.
6. Financial Summary is analytics-only, no data entry.

## Modules (v1.2.0)
- Bank → Bank Services: category list replaced entirely with Interest
  Earned, Interest Tax, Mobile Banking Charge, Debit Card Charge, ATM
  Charge, SMS Charge, Cheque Book, Locker, Demat Renewal, Broker
  Renewal, MeroShare Renewal, Other Charges. No new fields — same form
  structure (date, category, amount, description).
- Share → Share Portfolio: unchanged logic, renamed only. New: one-way
  auto-sync into Personal Finance > Bank Flow on IPO/Buy/SIP/Sell/
  Dividend, tagged source="share-sync", read-only in Personal Finance UI.
- Personal Finance (NEW): own storage split by flow:
  personal_finance_bank_flow.xlsx and personal_finance_cash_flow.xlsx. Three
  sub-views: Bank Flow, Cash Flow, Combined Overview (Combined Overview
  only aggregates Bank Flow + Cash Flow, never touches bank_
  transactions.xlsx or share_transactions.xlsx directly). No connection
  to Bank Services' bank_transactions.xlsx.
- Summary → Financial Summary: 4 separate sections, not merged —
  Bank Services summary, Share Portfolio summary, Personal Finance
  summary, Overall financial position (net worth trend).
- Settings: only the Settings page internals get a left-nav + right-
  content layout. App-level navigation is untouched (see Constraint 1).
  Sections: General, Investment, Import/Export, Backup (placeholder),
  About, How To Use, Privacy, Version.

## Deferred — do not build in v1.2.0
- v1.3.0: opportunity cost engine, bank interest rate settings, real/
  actual profit calculation, daily interest engine (simulate via daily
  closing balance)
- v2.0.0: Google Sign-In, Google Drive sync, conflict resolution,
  cross-platform desktop, Android support
