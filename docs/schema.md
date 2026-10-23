# Schema — SQLite (mobile) & desktop Excel parity

Defines the on-device SQLite schema for the mobile app and the exact
mapping to desktop Excel. Parity tests diff rows directly, so table
columns must mirror desktop's Excel headers exactly (see the mapping in
§3).

## 1. Tables

All tables use a single primary key `id INTEGER PRIMARY KEY AUTOINCREMENT`
(implicit `rowid`), ordered to match the desktop worksheet column order so
a diff test can compare column-by-column without reordering. NULLs are used
where desktop leaves a cell empty rather than writing a placeholder string.

### 1.1 `bank_transactions`

Mirrors `bank_transactions.xlsx` → sheet `Bank`.

| Column | Type | Desktop header |
|--------|------|----------------|
| id | INTEGER PRIMARY KEY | (implicit rowid) |
| date | TEXT NOT NULL | Date |
| category | TEXT NOT NULL | Category |
| amount | REAL NOT NULL | Amount |
| cumulative_amount | REAL NOT NULL | Cumulative Amount |
| description | TEXT | Description |
| created_timestamp | TEXT NOT NULL | Created Timestamp |
| last_updated_timestamp | TEXT NOT NULL | Last Updated Timestamp |
| updated_device | TEXT NOT NULL | Updated Device |

### 1.2 `share_transactions`

Mirrors `share_transactions.xlsx` → sheet `Share`.

| Column | Type | Desktop header |
|--------|------|----------------|
| id | INTEGER PRIMARY KEY | (implicit rowid) |
| date | TEXT NOT NULL | Date |
| share_name | TEXT NOT NULL | Share Name |
| category | TEXT NOT NULL | Category |
| per_unit_price | TEXT NOT NULL | Per Unit Price |
| asba_charge | REAL NOT NULL | ASBA Charge |
| allotted | INTEGER NOT NULL | Allotted |
| buy_sell | TEXT NOT NULL | Buy/Sell |
| total_amount | TEXT NOT NULL | Total Amount |
| profit_loss | TEXT NOT NULL | Profit/Loss |
| cumulative_profit | REAL NOT NULL | Cumulative Profit |
| created_timestamp | TEXT NOT NULL | Created Timestamp |
| last_updated_timestamp | TEXT NOT NULL | Last Updated Timestamp |
| updated_device | TEXT NOT NULL | Updated Device |

### 1.3 `personal_finance_bank_flow`

Mirrors `personal_finance_bank_flow.xlsx` → sheet `Bank Flow`.

| Column | Type | Desktop header |
|--------|------|----------------|
| id | INTEGER PRIMARY KEY | (implicit rowid) |
| date | TEXT NOT NULL | Date |
| flow_type | TEXT NOT NULL | Flow Type |
| direction | TEXT NOT NULL | Direction |
| category | TEXT NOT NULL | Category |
| amount | REAL NOT NULL | Amount |
| signed_amount | REAL NOT NULL | Signed Amount |
| description | TEXT | Description |
| source | TEXT NOT NULL | Source |
| created_timestamp | TEXT NOT NULL | Created Timestamp |
| last_updated_timestamp | TEXT NOT NULL | Last Updated Timestamp |
| source_ref | TEXT | Source Ref |
| updated_device | TEXT NOT NULL | Updated Device |

### 1.4 `personal_finance_cash_flow`

Mirrors `personal_finance_cash_flow.xlsx` → sheet `Cash Flow`.

| Column | Type | Desktop header |
|--------|------|----------------|
| id | INTEGER PRIMARY KEY | (implicit rowid) |
| date | TEXT NOT NULL | Date |
| flow_type | TEXT NOT NULL | Flow Type |
| direction | TEXT NOT NULL | Direction |
| category | TEXT NOT NULL | Category |
| amount | REAL NOT NULL | Amount |
| signed_amount | REAL NOT NULL | Signed Amount |
| description | TEXT | Description |
| source | TEXT NOT NULL | Source |
| created_timestamp | TEXT NOT NULL | Created Timestamp |
| last_updated_timestamp | TEXT NOT NULL | Last Updated Timestamp |
| source_ref | TEXT | Source Ref |
| updated_device | TEXT NOT NULL | Updated Device |

### 1.5 `transfers`

New table for cash ⇄ bank moves. This table has **no desktop
counterpart** — it is mobile-only and is excluded from Excel export
(Excel files store only the four data types above). `from_flow` and
`to_flow` are `bank` or `cash`.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PRIMARY KEY | (implicit rowid) |
| date | TEXT NOT NULL | ISO date of the transfer |
| from_flow | TEXT NOT NULL | `bank` or `cash` |
| to_flow | TEXT NOT NULL | `bank` or `cash` (must differ from from_flow) |
| amount | REAL NOT NULL | Always positive, magnitude of the move |
| description | TEXT | Optional note |
| created_timestamp | TEXT NOT NULL | |
| last_updated_timestamp | TEXT NOT NULL | |
| updated_device | TEXT NOT NULL | |

## 2. New `Updated Device` column

`updated_device` is added to **all four data types on both platforms**
(desktop Excel and mobile SQLite). It records which device last wrote the
row.

- **Share Portfolio and Personal Finance (both Bank Flow and Cash Flow)
  currently store a single `Timestamp` column, not split Created/Last
  Updated** (per CODEBASE.md's Known Issues). This migration must split
  that single column into `Created Timestamp` and `Last Updated Timestamp`
  — using the existing value for both — in the **same pass** that adds
  `Updated Device`. Bank Services already has the split
  (`Created Timestamp` / `Last Updated Timestamp`); it only gains
  `Updated Device`.
- Desktop adds the `Updated Device` header to each of the four Excel
  workbooks; for Share Portfolio and Personal Finance it also splits the
  single `Timestamp` header into `Created Timestamp` and
  `Last Updated Timestamp` (see §4 for the exact migration).
- Mobile adds the `updated_device` column to each of the four SQLite
  tables (bank_transactions, share_transactions, personal_finance_bank_flow,
  personal_finance_cash_flow). Because mobile doesn't exist yet, its schema
  is created fresh with all three columns (`created_timestamp`,
  `last_updated_timestamp`, `updated_device`) from the start — no split is
  needed there since a pre-existing single-column state never existed.
- **Migration default for existing rows**: existing rows have no recorded
  device, so they are stamped `"legacy"`. Do not guess a device identity
  for rows that predate the column. New and subsequently edited rows store
  the actual device identifier.
- The change is never mobile-only: the desktop schema must gain the column
  in the same task, with its own migration path (see §4 and rules.md).

## 3. SQLite-column → Excel-header mapping (lossless export)

Export writes each SQLite row to the desktop worksheet, one cell per
column, in header order. The mapping is the "Desktop header" column in §1.
Concrete rules:

- Export **only** the four data tables. `transfers` has no Excel target
  and is never exported.
- Column order on the worksheet is the fixed header row; the SQLite columns
  each map to exactly one header. The `id` primary key is **not** written
  to Excel — row identity in desktop remains the worksheet row index (header
  excluded), exactly as the backend read functions assume
  (`id = row_idx - 1`).
- Values are written as desktop writes them:
  - Share `per_unit_price`, `total_amount`, `profit_loss` are stored as
    **strings** in SQLite and written back as strings, preserving the exact
    user-entered decimal text with no float rounding.
  - All other numeric columns are REAL and written as numbers.
  - NULL description/source_ref cells are written as empty cells, matching
    how desktop leaves them blank.
- `updated_device` maps to the `Updated Device` header on each worksheet,
  and back to `updated_device` on import.

### 3.1 Round-trip acceptance test (required before this phase is done)

A parity/export test must pass before this phase is marked done:

1. Seed the four SQLite tables with a representative row set covering:
   empty and populated description/source_ref, positive and negative
   amounts, income and expense directions, share dividend/buy/sell/sip
   rows, and both `bank` and `cash` flows.
2. Insert a couple of `transfers` rows and confirm they are **not**
   emitted to any workbook.
3. Export each table to its Excel workbook using the mapping above.
4. Re-import every workbook back into a fresh SQLite database.
5. Assert that, for every row of every one of the four data tables, the
   re-imported column values equal the originally exported column values
   **byte-for-byte** (string fields compared as exact strings, floats
   compared bit-identical, e.g. via their IEEE-754 representation, not
   approximate equality). This is the lossless guarantee: no data is
   altered by an export → re-import cycle.
6. The test fails if any value differs after the round trip.

## 4. Migration path

Both platforms get a migration, never mobile-only:

- **Mobile**: the SQLite schema is **created fresh** with all three columns
  from the start — `created_timestamp`, `last_updated_timestamp`,
  `updated_device` — on each of the four data tables. No split or backfill
  is needed on mobile because no pre-existing single-column state exists.
  `transfers` ships with these columns from creation. (No
  `ALTER TABLE`/`ADD COLUMN` is required; the columns are DDL from day one.)
- **Desktop**: two changes are applied to each of the four workbooks, in
  the same migration pass:
  1. **Add `Updated Device`** as a new header on each of the four
     workbooks.
  2. **Split the single `Timestamp` into `Created Timestamp` and
     `Last Updated Timestamp`** for Share Portfolio and Personal Finance
     (Bank Flow and Cash Flow). Use the existing `Timestamp` value for
     **both** new columns on each existing row. Bank Services already has
     `Created Timestamp` / `Last Updated Timestamp`, so it only gains
     `Updated Device`.
  - Backfill existing rows' `Updated Device` with `"legacy"` (rows predate
    the column; do not guess a device).
  - Follow the same backup-then-replace rule used elsewhere — copy the
    original workbook to `backups/...` first, then build/stage the upgraded
    workbook and activate it atomically. Never modify a workbook in place
    without a backup file.
  - Concretely: add the `Updated Device` header in `bank_service.py`
    (`HEADERS`), and in `share_service.py` and
    `personal_finance_service.py` replace `Timestamp` with
    `Created Timestamp` + `Last Updated Timestamp` and add
    `Updated Device`.
- The change must land on both schemas together. See rules.md
  (Backend/shared) and AGENTS.md §0.
