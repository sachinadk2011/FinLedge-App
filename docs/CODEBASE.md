# CODEBASE.md — FinLedge repo structure and conventions

Skim this before any task. Updated as of the v1.2.0 work-in-progress.

---

## 1. Folder Structure

```
tracker financial/
├─ backend/
│  ├─ main.py                        — FastAPI app, router registration, static mount
│  ├─ engine_main.py                 — Uvicorn entrypoint
│  ├─ models.py                      — All Pydantic models + Enums (shared across modules)
│  ├─ routes/
│  │  ├─ bank.py
│  │  ├─ share.py
│  │  ├─ summary.py
│  │  └─ personal_finance.py
│  ├─ services/
│  │  ├─ bank_service.py
│  │  ├─ share_service.py
│  │  ├─ summary_graph_service.py
│  │  ├─ personal_finance_service.py
│  │  ├─ data_migration_service.py
│  │  └─ path_utils.py              — get_data_dir() resolution
│  └─ data/                          — legacy test files (bank.xlsx, share.xlsx)
│
├─ frontendwebapp/
│  ├─ src/
│  │  ├─ App.jsx                     — Routes + Layout (top nav bar)
│  │  ├─ main.jsx                    — ReactDOM entry
│  │  ├─ styles.css                  — All custom CSS (Tailwind + BEM-ish)
│  │  ├─ pages/
│  │  │  ├─ Home.jsx
│  │  │  ├─ BankPage.jsx
│  │  │  ├─ BankDashboard.jsx
│  │  │  ├─ SharePage.jsx
│  │  │  ├─ ShareDashboard.jsx
│  │  │  ├─ PersonalFinanceHome.jsx
│  │  │  ├─ PersonalFinancePage.jsx
│  │  │  ├─ PersonalFinanceDashboard.jsx
│  │  │  ├─ Summary.jsx
│  │  │  └─ Settings.jsx
│  │  ├─ components/
│  │  │  ├─ BankForm.jsx
│  │  │  ├─ ShareForm.jsx
│  │  │  ├─ PersonalFinanceForm.jsx
│  │  │  ├─ StatGrid.jsx
│  │  │  ├─ TransactionsTable.jsx
│  │  │  ├─ BarChart.jsx
│  │  │  ├─ InteractiveTimelineChart.jsx
│  │  │  ├─ ConfirmDialog.jsx
│  │  │  └─ UpdateNotice.jsx
│  │  ├─ api/
│  │  │  ├─ client.js                — fetch wrappers (postJson, getJson, putJson, deleteJson)
│  │  │  ├─ bankApi.js
│  │  │  ├─ shareApi.js
│  │  │  └─ personalFinanceApi.js
│  │  ├─ constants/
│  │  │  └─ options.js               — BANK_CATEGORIES, SHARE_CATEGORIES, PF_*
│  │  └─ utils/
│  │     └─ date.js                  — getTodayInputValue()
│  └─ dist/                          — built frontend output
│
├─ desktop/
│  ├─ main.js                        — Electron main process
│  ├─ preload.js                     — contextBridge (financialTracker API)
│  └─ package.json
│
├─ scripts/
│  ├─ finledge.mjs                   — dev/build script runner
│  ├─ migrate_v1_2_0.py             — CLI migration tool (--apply / preview)
│  ├─ sync-version.mjs
│  ├─ start-release.mjs
│  └─ verify-version.mjs
│
├─ docs/
│  ├─ PLAN.md
│  ├─ AGENTS.md
│  ├─ CODEBASE.md                    — this file
│  ├─ TASKS.md
│  └─ dev_journal.md
│
├─ .finledge-dev-data/               — dev-mode data directory
│  ├─ bank_transactions.xlsx
│  ├─ share_transactions.xlsx
│  ├─ personal_finance_bank_flow.xlsx
│  ├─ personal_finance_cash_flow.xlsx
│  └─ backups/
│
├─ package.json                      — root, scripts only
├─ requirements.txt                  — Python deps (fastapi, uvicorn, openpyxl, matplotlib)
└─ .env / .env.example
```

---

## 2. Module → File Map

| Module | Frontend Page(s) | Frontend Component | Frontend API | Backend Route | Backend Service | Data Model / Excel |
|---|---|---|---|---|---|---|
| **Bank Services** | `BankPage.jsx`, `BankDashboard.jsx` | `BankForm.jsx` | `bankApi.js` | `bank.py` | `bank_service.py` | `bank_transactions.xlsx` — 7 cols: Date, Category, Amount, Cumulative Amount, Description, Created Timestamp, Last Updated Timestamp |
| **Share Portfolio** | `SharePage.jsx`, `ShareDashboard.jsx` | `ShareForm.jsx` | `shareApi.js` | `share.py` | `share_service.py` | `share_transactions.xlsx` — 10 cols: Date, Share Name, Category, Per Unit Price, ASBA Charge, Allotted, Buy/Sell, Total Amount, Profit/Loss, Cumulative Profit |
| **Personal Finance** | `PersonalFinanceHome.jsx`, `PersonalFinancePage.jsx`, `PersonalFinanceDashboard.jsx` | `PersonalFinanceForm.jsx` | `personalFinanceApi.js` | `personal_finance.py` | `personal_finance_service.py` | `personal_finance_bank_flow.xlsx` + `personal_finance_cash_flow.xlsx` — 10 cols each: Date, Flow Type, Direction, Category, Amount, Signed Amount, Description, Source, Timestamp, Source Ref |
| **Financial Summary** | `Summary.jsx` | *(uses StatGrid, BarChart, InteractiveTimelineChart)* | *(reads bankApi + shareApi + personalFinanceApi)* | `summary.py` | `summary_graph_service.py` | *(analytics-only, reads from Bank + Share + PF, writes nothing)* |
| **Settings** | `Settings.jsx` | *(none)* | *(none)* | *(none)* | *(none)* | *(no data file; reads file paths from desktop bridge)* |
**Shared across modules:** `StatGrid.jsx`, `TransactionsTable.jsx`, `BarChart.jsx`, `InteractiveTimelineChart.jsx`, `ConfirmDialog.jsx`

---

## 3. Observed Conventions

### Backend

| Pattern | Detail |
|---|---|
| **Enum location** | All enums live in `backend/models.py` as `class XCategory(str, Enum)`. `BankCategory` uses Title Case values (`"Interest Earned"`). `ShareCategory` uses lowercase (`"ipo"`). |
| **Category source of truth** | Frontend: `frontendwebapp/src/constants/options.js` (exported arrays). Backend: `models.py` enums + `bank_service.py` has its own `BANK_SERVICE_CATEGORIES` list and `BANK_INCOME_CATEGORIES` set. **These are duplicated, not synced.** |
| **Request models** | Pydantic `BaseModel` subclasses in `models.py`. One per module: `BankAddRequest`, `ShareAddRequest` (union type), `PersonalFinanceAddRequest`. |
| **Route structure** | Each module has one router file. Routes: `POST /add`, `GET /data`, `DELETE /delete/{id}`, `PUT /update/{id}`. Personal Finance uses `PUT /update/{flow_type}/{id}` and `DELETE /delete/{flow_type}/{id}`. |
| **Error handling** | Every route wraps in `try/except`. `ValueError` → 400. `Exception` → 500. Response shape: `{"message": "...", "data": ...}`. |
| **Excel read/write** | Direct OpenPyXL in each service. No shared DAL. Every read/write function calls `_ensure_workbook_exists()` first. `load_workbook()` for reads, `sheet.append()` for writes, `workbook.save()` after every mutation. |
| **Excel IDs** | Row-based stable IDs: `row_idx - 1` (header excluded). Used for edit/delete URL params. |
| **Migration** | `data_migration_service.py` runs on FastAPI startup via `@app.on_event("startup")`. Uses backup-then-replace pattern with `shutil.copy2` → `os.replace`. |
| **Timestamps** | Bank records have `Created Timestamp` and `Last Updated Timestamp` columns. Personal Finance has a single `Timestamp` column. |

### Frontend

| Pattern | Detail |
|---|---|
| **Component style** | Functional components with hooks. No class components. No state management library (no Redux, no Context). |
| **State** | `useState` per page component. Form state is a single object. Error/success are separate `useState` strings. |
| **Form pattern** | Controlled inputs. `value`/`onChange` props passed to form component. `onSubmit` handler in parent page. |
| **API calls** | `client.js` provides `postJson`, `getJson`, `putJson`, `deleteJson` — all return parsed JSON. Desktop vs web base URL resolved at import time. |
| **Dashboard pattern** | Fetch data in `useEffect`, store in state. Build chart data via `useMemo` with helper functions (`buildDailyBankOverview`, etc.). Render `StatGrid` → `BarChart` → `InteractiveTimelineChart` → `TransactionsTable`. |
| **Message auto-dismiss** | `useEffect` with `setTimeout(5000)` to clear error/success strings. |
| **CSS** | Tailwind utility classes inline + custom BEM-ish classes in `styles.css` (`.page`, `.page-header`, `.card`, `.stat-grid`, `.error-pre`, `.success`, `.ghost`, `.eyebrow`). |
| **Naming** | Files: PascalCase `.jsx` (components), camelCase `.js` (api/utils). Functions: camelCase. |

---

## 4. Known Issues / Gotchas for v1.2.0

### Category lists are duplicated, not centralized

The Bank Services category list lives in **three places** that must be kept in sync manually:

1. `frontendwebapp/src/constants/options.js` → `BANK_CATEGORIES` array
2. `backend/models.py` → `BankCategory` enum
3. `backend/services/bank_service.py` → `BANK_SERVICE_CATEGORIES` list + `BANK_INCOME_CATEGORIES` set

If you add/remove/rename a category, you must update all three. The `BankCategory` enum is the Pydantic validation source of truth, but `bank_service.py` has its own copy because it needs runtime flexibility (legacy category detection during migration).

### Personal Finance uses two separate Excel files, not one

`personal_finance_service.py` defines `BANK_FLOW_FILE_PATH` and `CASH_FLOW_FILE_PATH` as separate `.xlsx` files (not two sheets in one file). The `flow_type` parameter selects which file to read/write. The `FILE_PATH` alias points to `BANK_FLOW_FILE_PATH` by default — this is used by `_ensure_workbook_exists()` which only creates the bank flow file on first call. The cash flow file is created lazily on first write.

### `Summary.jsx` already imports `personalFinanceApi`

The Financial Summary page (`Summary.jsx`) already calls `getPersonalFinanceData` from `personalFinanceApi.js`. If the PF data format changes, Summary will break.

### Bank Service headers changed in v1.2.0

The `HEADERS` list in `bank_service.py` was extended from 5 to 7 columns (added `Created Timestamp`, `Last Updated Timestamp`). The `_ensure_workbook_exists()` function handles this upgrade, but old 5-column files in the wild will get a header row inserted on first read. The `data_migration_service.py` handles the full upgrade including populating timestamps.

### `data_migration_service.py` retires "ATM Charge" and "SMS Charge"

The migration service maps `RETIRED_CATEGORIES = {"atm charge", "sms charge"}` into `Debit Card Charge` and `Mobile Banking Charge` respectively. These two categories are NOT in `BANK_CATEGORIES` or `BankCategory` — they only exist in the migration code. If a user manually re-creates them, they'll be treated as a charge but won't appear in the dashboard chart (the chart iterates `BANK_CATEGORIES`).

### `BANK_INCOME_CATEGORIES` includes legacy "income" string

`bank_service.py` line 33: `BANK_INCOME_CATEGORIES = {"interest earned", "income"}`. The `"income"` entry is there for backward compatibility with pre-migration data. `Summary.jsx` has its own copy: `const BANK_INCOME_CATEGORIES = new Set(["interest earned", "income"])`.

### Desktop bridge: Settings page only

`Settings.jsx` uses `window.financialTracker` (Electron preload bridge) for `getDataLocations()` and `openDataLocation()`. In web mode, it shows "Desktop app only" placeholders. No other page uses the bridge for data.

### Route prefix for Personal Finance

Personal Finance uses `/personal-finance` (kebab-case) as its route prefix, matching the pattern of other modules (`/bank`, `/share`, `/summary`). But its page routes in `App.jsx` are `/personal-finance`, `/personal-finance-entry`, and `/personal-finance-dashboard` — note the entry page is `/personal-finance-entry`, not just `/personal-finance`.
