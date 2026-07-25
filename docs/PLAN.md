# PLAN.md

## Vision
FinLedge is evolving from a finance tracker into an offline-first
Personal Financial Operating System.

## Hard Constraints (do not violate these in any task)
1. Preserve current UI and navigation exactly — this includes the
   top-level app navigation (Bank Services, Share Portfolio, Personal
   Expenses, Financial Summary, Settings). Never move app nav into a
   sidebar or restructure it.
2. Preserve workflow: Home → Module → Entry Form → Transaction Table →
   Dashboard button.
3. Every module keeps its own dedicated dashboard — never consolidate.
4. Expand business logic; do not redesign existing UI patterns.
5. Migration must never destroy user data.
6. Financial Summary is analytics-only, no data entry.

## Modules (v1.2.0)
- Bank → Bank Services: category list replaced entirely with Interest
  Earned, Interest Tax, Mobile Banking Charge, Debit Card Charge, Cheque
  Book, Locker, Demat Renewal, Demat & MeroShare Renewal, Broker
  Renewal, MeroShare Renewal, Other Charges. No new fields — same form
  structure (date, category, amount, description).
- Share → Share Portfolio: unchanged storage and primary logic, renamed
  only. Its cash-impact events are derived live in Personal Expenses > Bank
  Flow: IPO/Buy/SIP installment are Investment Expense; Sell/Cash Dividend/
  SIP redeem are Investment Income. No Share data is copied into another
  workbook.
- Personal Expenses (NEW): own manual storage split by flow:
  personal_finance_bank_flow.xlsx and personal_finance_cash_flow.xlsx. Three
  sub-views: Bank Flow, Cash Flow, Combined Overview. Bank Flow derives
  read-only Bank Services and Share Portfolio cash activity at read time,
  while all source workbooks remain separate.
- Summary → Financial Summary: 4 separate sections, not merged —
  Bank Services summary, Share Portfolio summary, Personal Expenses
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
