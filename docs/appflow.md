# App Flow — Mobile navigation & user journey

How the user moves through the app, screen by screen. Grounded in
AGENTS.md §8 (module screens are Add-entry ⇄ Dashboard pairs, never
combined) and PLAN.md (Mobile section).

## 1. Top-level flow

```
Home (day-to-day Expense/Income only)
  ↓ (hamburger) drawer
  → each module's Add-entry ⇄ Dashboard pair
  → Financial Summary (combined, read-only)
  → Settings
      → Import/Export
          → Keep Notes import flow
          → Transfer sub-flow (Cash ⇄ Bank)
```

### 1.1 Home

The Home screen shows **day-to-day Expense/Income only**. It deliberately
excludes Bank Services and Share Portfolio figures — those live behind
their own module pairs. Home is the quick capture + overview surface for
daily spending and income.

### 1.2 Drawer

A hamburger opens the drawer (matches the design file's `.drawer`). It's
the entry point to every top-level destination: each module pair, Financial
Summary, Settings.

### 1.3 Module pairs

Every module is exactly two screens — **Add-entry ⇄ Dashboard** — never
combined into one page (AGENTS.md §8). The drawer links to the pair(s):
Bank Services, Share Portfolio, Personal Finance (Bank Flow / Cash Flow).
Each pair follows the Add-entry ⇄ Dashboard toggling pattern.

### 1.4 Financial Summary

A **combined, read-only** screen (analytics only — no forms, no mutation
endpoints). It aggregates across modules for the overall financial
position.

### 1.5 Settings

App-level settings, including the Import/Export entry point.

### 1.6 Import/Export

Holds both the Keep Notes import flow and the Transfer sub-flow.

## 4. Settings sub-navigation

Every Settings row (Profile, Import/Export, Investment, Backup & sync,
Privacy, About, How To Use, Version) is its own tappable destination that
navigates to a dedicated sub-screen — never static inline text sitting
inside one long Settings card. This mirrors desktop's Settings
left-nav/right-content pattern, adapted to mobile's screen-navigation
model. Import/Export's sub-screen specifically contains three distinct
actions, matching desktop's Import/Export plus the new mobile addition:
paste import (Keep Notes), Excel import (desktop-compatible files), Excel
export (to desktop-compatible files) — not folded together into one action.

## 2. Keep Notes import flow (sub-flow of Import/Export)

```
paste → parse preview/review → confirm → commit
```

1. **Paste** — user pastes raw note text (see keepNotesImport.md for the
   parser spec).
2. **Parse preview/review** — nothing is imported yet. A staged list shows
   each parsed item with its assigned module/category; rows are editable,
   splittable, deletable, searchable, with an Add button (keepNotesImport.md
   §4).
3. **Confirm** — ambiguous-type and checksum-mismatch rows are flagged and
   must be confirmed.
4. **Commit** — confirmed rows are written via the same service layer as
   manual entries (inheriting timestamps and `updated_device`).

## 3. Transfer sub-flow (Cash ⇄ Bank)

Part of Import/Export, **separate from normal expense entry**. Handles Cash
⇄ Bank moves using the `transfers` table (schema.md §1.5). It is its own
flow, distinct from recording a routine expense, so cash and bank balances
move together without being miscategorized as income/expense.
