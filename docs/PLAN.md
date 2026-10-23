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


## Mobile (mobile-v1.0.0)

FinLedge is also shipping a mobile app as a separate runtime. Desktop
and mobile are diverging tracks — see AGENTS.md §0 before starting any
task. The mobile app:

- **Separate runtime via Capacitor**: a native Android app wrapping a
  web frontend, running standalone rather than as a desktop extension.
- **SQLite storage**: replaces the desktop Excel workbooks with a local
  SQLite database (see docs/schema.md).
- **Own service layer**: reimplements the desktop backend logic directly
  in the app rather than calling Python:
  - bank category totals
  - share FIFO lot-matching
  - personal-finance sync-row computation
- **Keep Notes bulk import** is a v1.0.0 priority.
- **Deferred from mobile-v1.0.0**: bank-flow live sync and the interest
  engine.


