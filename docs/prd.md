# PRD — FinLedge (desktop + mobile)

Product requirements for FinLedge as a whole — both platforms share one
vision, one data model, and one set of business rules. Desktop and mobile
are diverging tracks in implementation only (AGENTS.md §0), not in
product behavior.

## 1. Problem statement

People track their personal finances across disconnected spreadsheets,
bank statements, and scattered notes, which makes it hard to see a single,
trustworthy picture of their money. Existing tools are either hostile to
offline/local-first use, force cloud accounts, or don't understand
Nepalese-specific finance shapes (share IPOs/SIPs, bank service charges,
interest tax, cash vs bank flows). FinLedge exists to give a single,
offline-first personal financial operating system that runs on both the
desktop and a phone — with identical numbers on every device.

## 2. Target users

- Individuals who track day-to-day expenses/income and cash vs bank
  movements on a phone.
- Investors who manage a Share Portfolio (IPO/SIP/buy/sell, FIFO
  lot-matching, dividends) and want it alongside their bank and cash
  activity.
- People who keep informal notes (e.g. Google Keep) of their daily
  spending and want those bulk-imported rather than re-entered by hand.
- Users who want full local control of their data (offline-first, no
  mandatory cloud), and who may already use the desktop app.

## 3. Core features

For the whole product, on both platforms:

- **Bank Services**: interest and charge tracking across accounts.
- **Share Portfolio**: buy/sell/IPO/SIP/dividend tracking with FIFO
  lot-matching and cumulative profit.
- **Personal Finance**: separate Bank Flow and Cash Flow with a combined
  overview; Bank Flow derives read-only activity from Bank Services and
  Share Portfolio; Cash ⇄ Bank transfers keep balances consistent.
- **Financial Summary**: combined, read-only analytics across modules
  (overall financial position).
- **Settings** and **Import/Export**.

Core features shipped as of the **mobile release**:

- **Keep Notes bulk import** — paste raw notes, parse to a review/edit
  screen, confirm, and commit via the same service layer as manual entries
  (keepNotesImport.md).
- **Lossless SQLite ⇄ Excel compatibility** — the mobile SQLite schema
  mirrors desktop Excel headers so rows can be exported/imported
  byte-identically; export → re-import → byte-identical row data
  (schema.md §3).

**Mobile-only additions (do not remove for "desktop consistency"):**

- Week/Month/Year/Custom time-range filters on every dashboard.
- Cash ⇄ Bank transfer entry in Personal Expenses.
- A combined Overall Summary view.
- A user Profile in Settings (name + greeting personalization).

None of these exist on desktop, and a future agent doing a "desktop
consistency" pass must not strip them out.

## 4. Success criteria

- **Computation parity between desktop and mobile**, verified by a
  **shared test suite** that runs the same business-logic cases against
  both platforms' service layers and asserts identical output
  (rules.md — Backend/shared; AGENTS.md §8).
- Keep Notes bulk import exists and works end-to-end on mobile with a
  review gate before commit.
- Lossless SQLite ⇄ Excel round trip passes (export → re-import →
  byte-identical row data) as required before the mobile phase is marked
  done.
- Shared duplicate-row identities, category lists, and schema changes
  (e.g. `updated_device`) land on both platforms together.
