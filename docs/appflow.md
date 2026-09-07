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

### 3.1 Transfer semantics (functional behavior)

- A recorded transfer **moves money between flows**: cash → bank adds to
  Bank and subtracts from Cash; bank → cash does the reverse. The net shift
  is applied to the Expenses dashboard "Bank balance" / "Cash balance" stat
  boxes via the mobile `transferAdjustments()` helper.
- Transfers are **neutral** (not income/expense) — they render without a
  +/- sign in history and do not feed income/expense totals.
- Transfers appear in the Expenses dashboard history in every tab: Combined
  tab shows all transfers; Bank flow shows transfers that involve Bank; Cash
  flow shows transfers that involve Cash.
- Transfer history rows carry `_table: "transfers"` + `_id`, so they get a
  working ✎ Edit and delete button like other stored rows.

## 5. Edit-entry flow

Every deletable stored row whose history list renders a working delete
button also renders a working **✎ Edit** button. Both appear on rows tagged
with `_table` + `_id` (manual bank, personal expense, share, and transfer
rows — never on read-only synced rows).

1. Tapping ✎ stores `editingEntry = { table, id }` and opens the
   `entry-edit` screen.
2. The screen pre-fills a per-table form (bank / share / personal /
   transfer; transfers get a direction chip pair). Derived share columns
   and the transfer nested amount sign are recomputed by the repository on
   save — the user never edits derived values directly.
3. **Save changes** runs the matching repository `update*` function (a real
   SQL write, with any recomputes and timestamp stamping), calls
   `reloadStore()`, toasts "Saved", and goes back to the previous screen.

## 6. Shares quick updates

The Shares dashboard "Update IPO allotment" and "Update SIP shares" cards
write to SQLite directly:

- IPO allotment update applies the new `allotted` to the newest `ipo` row
  for that share and recomputes FIFO.
- SIP quantity update adjusts the newest SIP installment row so total
  allotted equals the entered number, then recomputes.
- Both throw (→ toast) when the share has no matching rows; the name field
  uses the same share-name suggestion panel as the add-entry form.

## 7. Income section category filter

The Home Income/Expense category checkboxes only list categories that exist
for the **current Home mode** (`row.direction === appState.homeMode`) — so
income mode never shows expense categories (Food, Entertainment, …).
Switching modes resets the selection so the checked set always matches the
mode.
