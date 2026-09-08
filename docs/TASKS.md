# TASKS.md — v1.2.0 Progress Tracker

## v1.2.0 Progress

- [x] 1. Baseline inventory
  Notes: Completed from the current working tree on 2026-07-24.

  Rule files checked:
  - `docs/AGENTS.md`
  - `docs/PLAN.md`
  - `docs/TASKS.md`

  Requested lowercase files `docs/agent.md` and `docs/task.md` are not present in the repo; the existing tracked docs are uppercase/plural.

  Current module inventory:
  - App shell: `frontendwebapp/src/App.jsx`, `frontendwebapp/src/styles.css`
  - Bank module: `backend/routes/bank.py`, `backend/services/bank_service.py`, `frontendwebapp/src/pages/BankPage.jsx`, `frontendwebapp/src/pages/BankDashboard.jsx`, `frontendwebapp/src/components/BankForm.jsx`, `frontendwebapp/src/api/bankApi.js`
  - Share module: `backend/routes/share.py`, `backend/services/share_service.py`, `frontendwebapp/src/pages/SharePage.jsx`, `frontendwebapp/src/pages/ShareDashboard.jsx`, `frontendwebapp/src/components/ShareForm.jsx`, `frontendwebapp/src/api/shareApi.js`
  - Summary module: `backend/routes/summary.py`, `backend/services/summary_graph_service.py`, `frontendwebapp/src/pages/Summary.jsx`
  - Settings module: `frontendwebapp/src/pages/Settings.jsx`
  - Shared models/options: `backend/models.py`, `frontendwebapp/src/constants/options.js`

  Current backend state:
  - FastAPI app registers bank, share, and summary routers only.
  - Bank data is stored in `bank_transactions.xlsx` through `backend/services/bank_service.py`.
  - Share data is stored in `share_transactions.xlsx` through `backend/services/share_service.py`.
  - No Personal Finance router/service/data file exists yet.
  - Share categories currently include IPO, SIP, buy, sell, and dividend.
  - Bank categories are still the older broad categories: income, service cost, investment cost, operation cost.

  Current frontend state:
  - Top-level app navigation is still in `frontendwebapp/src/App.jsx`.
  - Current visible nav labels are Bank, Share, Summary, and Settings.
  - Routes exist for home, bank, bank dashboard, share, share dashboard, summary, and settings.
  - No Personal Finance page/dashboard/routes exist yet.
  - Tour guide component exists in the tree but is currently disabled in `App.jsx`.

  Step 1 only: no v1.2.0 implementation changes were made yet. Continue with Step 2 only after explicit confirmation.

- [x] 2. Rename modules (Bank Services, Share Portfolio, Financial Summary)
  Notes: Completed as visible UI text only. Routes, filenames, service names, and storage filenames were intentionally left unchanged for compatibility. Updated app header labels, top nav labels, Home cards, module page headings, dashboard headings, form headings/buttons, Summary page labels, and disabled tour copy.

- [x] 3. Bank Services category redesign
  Notes: Completed with the same existing form fields. Replaced the old broad category set with Interest Earned, Interest Tax, Mobile Banking Charge, Debit Card Charge, Cheque Book, Locker, Demat Renewal, Demat & MeroShare Renewal, Broker Renewal, MeroShare Renewal, and Other Charges. Interest Earned is stored as positive income; every other Bank Services category is stored as a negative charge. ATM Charge is consolidated into Debit Card Charge and SMS Charge into Mobile Banking Charge, including migration of existing rows. Dashboard category totals now use the new category list.

- [x] 4. Personal Expenses module (Bank Flow / Cash Flow / Combined Overview)
  Notes: Completed as a new independent module with its own backend route, service, model validation, frontend API, module home page, entry form page, and dedicated dashboard. Personal Expenses stores manual Bank Flow data in `personal_finance_bank_flow.xlsx` and Cash Flow data in `personal_finance_cash_flow.xlsx`, separate from Bank Services and Share Portfolio files. The `/personal-finance` module home opens first and shows three cards: Bank Flow, Cash Flow, and Combined Overview. Entry page supports Bank Flow and Cash Flow manual income/expense records with the required category lists, recent transaction table, edit/delete for manual rows, and read-only handling for synced rows. Bank Flow entry shows Bank Flow transactions only, Cash Flow entry shows Cash Flow transactions only, and combined entry mode shows both. View dashboard from a Bank Flow entry opens the Bank Flow dashboard, and View dashboard from a Cash Flow entry opens the Cash Flow dashboard. Backend services save a backend-generated `Timestamp` column for new/updated Bank Services, Share Portfolio, and Personal Expenses records.

- [x] 5. Bank Flow live sync (Share Portfolio + Bank Services)
  Notes: Completed as a read-only backend aggregation, not a data copy. Bank Services remains in `bank_transactions.xlsx`, Share Portfolio remains in `share_transactions.xlsx`, and manual Personal Expenses remains in its two flow-specific files. Bank Flow derives current Share Portfolio cash impact live: IPO/secondary buy/SIP installment are Investment Expense; sell/cash dividend/SIP redeem are Investment Income; bonus dividends are excluded. It also derives Bank Services: Interest Earned is income and every other Bank Services row is Service Cost. This immediately includes existing records as well as future edits/deletes without duplicate rows. Bank Flow dashboard shows Income, Expense, Investment Expense, Investment Income, Interest Earned, Service Cost, Total Income, Total Expense, and Net Profit/Loss. Cash Flow stays independent with Income, Expense, and Net Profit/Loss. Personal Expenses entry tables show manual records from their own selected flow only, so edit/delete controls never include synced Bank Services or Share Portfolio activity. Dashboard tables retain the full read-only combined view. Transaction tables hide backend IDs, show descriptions, and temporarily retain Source labels for testing.

- [x] 6. Financial Summary dashboard (4 sections)
  Notes: Completed with four separated analytics sections: Bank Services summary, Share Portfolio summary, Personal Expenses summary, and Overall financial position. Financial Summary loads the Personal Expenses Combined Overview alongside the other source modules. The Overall financial position uses manual Personal Expenses movement only, so the live Bank Flow aggregation does not double-count Bank Services or Share Portfolio.

- [x] 7. Data migration
  Notes: Completed as an automatic backend-start migration in `backend/services/data_migration_service.py`, so it runs for `npm run desktop-dev` and packaged Electron releases before the API becomes ready. It copies the original Bank workbook into `backups/v1.1.0-to-v1.2.0/<timestamp>/`, writes a JSON report of every source-row decision there, builds and validates a staged workbook, then atomically activates it. Mappings include Income with `interest`/`int` → Interest Earned; Service Cost with `tax` → Interest Tax; bank/mobile + renew → Mobile Banking Charge; card + installment → Debit Card Charge; Investment Cost with MeroShare/Demat/Broker + renew → the corresponding renewal category; combined Demat + MeroShare + renew → Demat & MeroShare Renewal; unmatched legacy categories → Other Charges. The migration also upgrades Bank files to Created Timestamp and Last Updated Timestamp storage; neither timestamp is displayed in the Bank table. `npm run migrate:preview` remains available for a no-change review, and `npm run migrate:apply` remains available for an explicit - [x] 8. Settings redesign (left nav, Settings page only)
  Notes: Completed as a Settings-only layout change with no App.jsx navigation changes. `Settings.jsx` now uses a left navigation rail and right content panel for General, Investment, Import/Export, Backup, About, How To Use, Privacy, and Version. General keeps the existing Excel file location controls and desktop `window.financialTracker` bridge calls (`getDataLocations`, `openDataLocation`); Version reads `currentVersion` via `getUpdateStatus` when available. Backup shows a disabled placeholder; About and How To Use are stub panels for Step 9. Added matching layout styles in `styles.css` (`.settings-layout`, `.settings-nav`, `.settings-content`). Follow-up completion: General now lists all four live workbooks plus the data folder, with per-file Open actions via extended desktop bridge paths (`personalFinanceBankFile`, `personalFinanceCashFile`, targets `pf-bank`/`pf-cash`) and `shell.openPath` for file rows. Investment and Backup are disabled placeholders with "future update" copy. Import/Export is live via `backend/routes/settings.py` + `backend/services/settings_service.py`: per-type import validates exact HEADERS, backs up to `backups/import/<timestamp>/`, then replaces the live file; export downloads a single workbook or all files as a zip through `frontendwebapp/src/api/settingsApi.js`, with desktop save-dialog support via `saveExportFile`. Bugfix (2026-07-25): Open button for file rows was falling back to `shell.showItemInFolder()` when `shell.openPath()` returned an error string, opening the folder instead of the file. Fixed in `desktop/main.js` `app:open-data-location` handler by removing the fallback — `shell.openPath()` is now the only call for all four file targets (bank, share, pf-bank, pf-cash). Bugfix (2026-07-25): Import/Export data-type dropdown was empty on click because `settingsApi.js` resolved the backend URL at module load time, before Electron's contextBridge had exposed `window.financialTracker`, so `getSettingsDataTypes()` always threw. Fixed by making `getApiBase()` re-evaluate `window.financialTracker.getBackendBaseUrl()` lazily on every call.

- [x] 9. About / How To Use content
  Notes: Completed as in-place replacement of the two Settings placeholder stubs in `Settings.jsx`. About panel now contains: FinLedge overview (offline-first, local Excel files, no cloud), per-module descriptions matching Home page card content (Bank Services = "is my bank account worth it?", Share Portfolio = investment tracking, Personal Expenses = everyday income/expenses with Bank Flow + Cash Flow + Combined Overview, Financial Summary = read-only analytics), Bank Flow live sync explanation (what syncs, what is read-only, bonus dividend exclusion), and data storage info (file names, no external transmission). Version panel reuses the existing `appVersion` from `getUpdateStatus`. How To Use panel now contains: three-step workflow pattern (enter → review → analyse), per-module entry form instructions, dashboard reading guide, Import/Export explanation (zip and per-file), and a short FAQ covering synced entry editing, upgrade migration safety, and data privacy. All content uses existing CSS classes (`.card`, `.settings-panel`, `.subtitle`, `.settings-version-row`) with no new styles or layout changes. Bugfix (2026-07-25): How To Use panel rewrote entirely to remove duplication with About. The old version repeated the module-purpose descriptions that About already contains. New content is purely task-oriented: numbered step-by-step instructions per module (Bank Services, Share Portfolio, Bank Flow, Cash Flow) with exact UI button labels as they appear in the app ("Add Bank Service Entry", "Add Share Entry", "Add Personal Expenses Entry", "View dashboard", "Recent transactions"); a dashboard reading guide with every stat card name and its meaning for all five dashboard views; a step-by-step Import/Export section with exact button labels; and a FAQ rewritten to answer "Why does a Bank Flow entry appear that I did not add?" instead of "Can I edit a synced Bank Flow entry?" (clearer framing for the expected confusion).

  Follow-up pass (2026-07-25) — bugfixes and feature additions to Steps 8 & 9:

  1. **Version display fixed** (`desktop/main.js`, `desktop/preload.js`, `Settings.jsx`)
     — Added `ipcMain.handle('app:get-version', () => app.getVersion())` in `main.js`. This
     reads the version directly from Electron's `app.getVersion()` (populated from
     `package.json` at build time) without waiting for the update-checker to fire.
     Exposed as `getAppVersion()` in `preload.js` contextBridge. `Settings.jsx` now calls
     `bridge.getAppVersion()` first; falls back to `getUpdateStatus()` if unavailable.
     Version section shows `—` instead of `Loading...` until the IPC round-trip completes.
     "Check for updates" button added to the Version section.

  2. **About + How To Use flattened to single cards** (`Settings.jsx`)
     — Both sections now render as a single `<section className="card settings-panel">`
     with `<h4>` headings separating topics instead of separate box-per-topic.
     About card ends with a Version row inline.
     How To Use card contains all instructions, dashboard reading guide, Import/Export
     guide, and FAQ in one continuous scroll — no separate boxes.

  3. **Import — lenient column validation** (`backend/services/settings_service.py`,
     `backend/routes/settings.py`, `frontendwebapp/src/api/settingsApi.js`, `Settings.jsx`)
     — Old app versions exported `Cumulative Total` instead of `Cumulative Amount`, had no
     `Description` column, no timestamp columns, etc. Import now:
     • Applies a **column alias table** so `Cumulative Total`, `Cumulative Balance`,
       `Running Total`, `Note/Notes/Remarks`, `Type`/`Transaction Type`, `Created At` etc.
       are all transparently remapped to the current canonical header before any check.
     • Validates only the **minimum required columns** per type:
       Bank = `Date, Category, Amount`;
       Share = `Date, Share Name, Category, Per Unit Price, Allotted, Buy/Sell`;
       Personal Expenses = `Date, Direction, Category, Amount`.
     • **Auto-calculates derived columns** if missing:
       - `Cumulative Amount` (Bank): recalculated as a fresh running sum from row 1;
         in merge mode continues from the last live row's cumulative.
       - `Signed Amount` (PF): `+amount` for income rows, `−amount` for expense rows.
       - `Total Amount` (Share): `Per Unit Price × Allotted` when absent.
       - `Description`: empty string `""` when absent.
       - `Source` (PF): `"manual"` when absent.
     • **Noon timestamp fallback**: if timestamp columns (`Created Timestamp`,
       `Last Updated Timestamp`, `Timestamp`) are missing (pre-timestamp app versions),
       each row gets a timestamp from its own `Date` column at `12:00:00`, e.g.
       `2025-01-10 12:00:00`. This covers old exports that pre-date the audit columns.
     • Live file is always backed up to `backups/import/<timestamp>/` before any write.
     • The `Required columns` preview in the import UI now shows only the minimal set.

  4. **Import merge / replace mode** (`settings_service.py`, `settings.py`, `settingsApi.js`,
     `Settings.jsx`, `styles.css`)
     — First click on "Import file" calls `GET /settings/has-data/{dataType}` to check
     whether the live file already has rows. If yes, an inline **Replace / Merge** radio
     prompt appears (purple-bordered card, two option cards with `:has()` highlight):
     • **Replace** — discard all live rows and use only the import file.
     • **Merge** — keep all existing rows, append imported rows after them.
     Confirm button label changes to `Confirm — Replace` or `Confirm — Merge`.
     Cancel resets to Replace mode and hides the prompt.
     The `mode` field is sent as a `multipart/form-data` field alongside the file.
     New CSS classes: `.settings-merge-prompt`, `.settings-merge-options`,
     `.settings-merge-option` (added to `styles.css`).

  5. **Post-import category migration** (`backend/services/settings_service.py`)
     — After all column aliasing and row remapping, every imported row's category
     and direction values are now normalised to the **current v1.2.0 valid set**
     before being written to disk. This prevents import from producing rows with
     unknown categories that would silently break dashboards and table filters.
     Applies to all three data types:

     • **Bank Services** — mirrors `data_migration_service._map_legacy_category`
       exactly. Old v1.1.0 categories (`Income`, `Service Cost`, `Investment Cost`,
       `Operation Cost`) and retired categories (`ATM Charge`, `SMS Charge`) are
       mapped to the matching v1.2.0 category using description-keyword rules.
       Amount sign is corrected at the same time (income → positive, charge → negative)
       so the recalculated Cumulative Amount is always correct.
       Unknown categories fall back to `Other Charges`.

     • **Share Portfolio** — category is lowercased and aliased to the canonical key
       stored in the workbook (`ipo`/`sip`/`buy`/`sell`/`dividend`). Handles verbose
       labels (`Secondary Buy`, `IPO Entry`, `Dividend (Cash)`, `SIP Investment` etc.).
       Unknown labels default to `buy`.

     • **Personal Expenses** — `Direction` is normalised first (`Credit`/`In`/`Inflow`
       → `income`; `Debit`/`Out`/`Cost` → `expense`). Then `Category` is mapped to the
       nearest current valid label for that direction. Expense aliases: `Food & Dining`
       → `Food`, `Utilities` → `Bills`, `Stock` → `Share Market` etc. Income aliases:
       `Wages`/`Monthly Salary` → `Salary`, `Capital Gain` → `Investment Return`,
       `Cash Back` → `Refund` etc. Unknown categories fall back to `Other` (expense)
       or `Other Income` (income). `Signed Amount` is always recalculated from the
       normalised direction so it can never be inconsistent with the direction column.

     Verified with smoke tests: all 10 migration scenarios pass (bank category mapping,
     all 5 share category aliases, 5 PF direction+category pairs).

- [x] 10. Testing + Code deduplication
  Notes: Completed in two passes on 2026-07-25.

  **Pass A — Module-by-module backend test suite (`backend/tests/`)**
  Created `conftest.py` with a session-scoped isolated data dir (pytest tmp_path), so tests
  never touch production Excel files. Written and verified:

  - `test_bank.py` — 18 tests covering:
    • Add: income positive, charge negative, all 11 categories, invalid category rejected,
      positive amount for charge rejected, zero amount rejected, negative income rejected,
      missing date defaults
    • List: records+summary shape, required field presence, cumulative chain integrity, summary dict
    • Update: description change, out-of-range id, cumulative correctness post-edit
    • Delete: record removed, out-of-range id, cumulative reindexed after delete

  - `test_share.py` — 16 tests covering:
    • Add: IPO, secondary buy, sell, cash dividend, bonus dividend, invalid category,
      negative price, zero quantity
    • List: records+summary shape, non-empty, required fields, cumulative_profit presence
    • Allotment update: update allotted value, invalid id
    • Delete: record removed, invalid id

  - `test_personal_finance.py` — 17 tests covering:
    • Add: bank income signed positive, bank expense signed negative, cash income, cash expense,
      signed amount magnitude, invalid flow_type, invalid direction, invalid category
    • List: bank+cash shape, required fields, synced row source values valid,
      synced row id is not a plain integer (ensures edit/delete gate works)
    • Update: description change, invalid id
    • Delete: bank manual record, cash manual record, invalid id

  - `test_settings.py` — 15 tests covering:
    • data-types: all 4 ids present, required fields, bank minimal headers
    • has-data: valid type responds, invalid type 400
    • Import replace: current format, old column alias accepted ("Cumulative Total"),
      old categories migrated (no "Service Cost"/"ATM Charge" survival),
      missing required column rejected, cumulative recalculated post-import
    • Import merge: appends rows, cumulative still correct
    • Export: bank returns xlsx, export-all returns zip

  **Total: 66 tests — 66 passed, 0 failed.**

  **Bugs found and fixed during testing:**
  - Backup dir used second-resolution timestamp → collision when two imports run in same second.
    Fixed: `datetime.now().strftime("%Y%m%d-%H%M%S-%f")` + `exist_ok=True`
    (`backend/services/settings_service.py`)
  - `BankCategory` enum not imported in `bank_service.py` → `BANK_SERVICE_CATEGORIES` drift risk.
    Fixed: derive from enum (`[c.value for c in BankCategory]`).

  **Pass B — Code deduplication refactor (backend + frontend)**

  *Backend — new `backend/services/excel_utils.py` (single source of truth):*
  - `to_float()` — previously copy-pasted verbatim in `bank_service.py`, `share_service.py`,
    `personal_finance_service.py`. All three now import from `excel_utils`.
  - `to_int()` — previously only in `share_service.py`; moved to `excel_utils` for reuse.
  - `current_timestamp()` / `current_timestamp_us()` — previously duplicated in same 3 files.
  - `validate_record_id()`, `api_response()`, `ensure_workbook_exists()` — available for future
    consolidation. Not yet wired into service files (their `_ensure_workbook_exists` has
    bank-specific schema-upgrade logic that would need careful migration).

  *Backend — category constants:*
  - `bank_service.py`: `BANK_SERVICE_CATEGORIES` list now derived from `BankCategory` enum —
    impossible to drift when new categories are added to the enum.

  *Frontend — new `src/hooks/useDismissibleMessage.js`:*
  - Replaces 5 identical `useEffect + setTimeout` auto-dismiss blocks from
    `BankPage.jsx`, `BankDashboard.jsx`, `SharePage.jsx`, `ShareDashboard.jsx`,
    `PersonalFinancePage.jsx`. Ready to import; existing pages retain their old code until
    they are individually updated (safe — hook is additive).

  *Frontend — extended `src/utils/format.js`:*
  - `formatCurrency()` — replaces 5 identical `Intl.NumberFormat` instances across dashboards.
  - `getSourceLabel()` — replaces duplicated logic in Personal Expenses pages.

  *Frontend — extended `src/utils/date.js`:*
  - Added `parseDate()`, `isoDayKey()`, `isoMonthKey()`, `dayLabelFormatter`,
    `monthLabelFormatter` — all previously duplicated inside dashboard components.

  *Frontend — `src/api/settingsApi.js`:*
  - Removed 61-line verbatim copy of `getApiBase`/`handleResponse`/`readJsonSafe`/`formatDetail`.
  - Now imports `{ getApiBase, handleResponse }` from `./client.js` (which exports them).

   *Frontend — `src/constants/options.js`:*
  - Added `export const BANK_INCOME_CATEGORIES` Set — single source of truth replacing
    inline `new Set(["interest earned", ...])` in `BankDashboard.jsx` and `Summary.jsx`.

  **Pass C — Additional Refactorings (Backend & Frontend Deduplication)**

  *Backend — settings_service.py & models.py:*
  - Defined `PF_EXPENSE_CATEGORIES` and `PF_INCOME_CATEGORIES` sets at `models.py` module level and reused them in validator.
  - `settings_service.py` now imports validation lists directly from `models.py` (`BankCategory`, `ShareCategory`, `PF_EXPENSE_CATEGORIES`, `PF_INCOME_CATEGORIES`) eliminating redundant valid category listings.
  - `data_migration_service.py` now imports `to_float` as `_amount` from `excel_utils.py` to eliminate local duplicate code.

  *Frontend — Dashboards & Summary Pages:*
  - Refactored `BankDashboard.jsx`, `ShareDashboard.jsx`, `PersonalFinanceDashboard.jsx`, and `Summary.jsx` to import date parsing (`parseDate`), date formatting (`dayLabelFormatter`, `monthLabelFormatter`), and keys formatting (`isoDayKey`, `isoMonthKey`) directly from `src/utils/date.js`.
  - Wired `formatCurrency` from `src/utils/format.js` directly into `BankDashboard.jsx`, `ShareDashboard.jsx`, `PersonalFinanceDashboard.jsx`, and `Summary.jsx` to delegate decimal formatting and clean up local redundant implementations.

  **Pass D — Excel Corrupted File Recovery & Summary Resilience (2026-07-25)**
  - Added `repair_corrupted_workbook` and `safe_load_workbook` in `backend/services/excel_utils.py`:
    • Detects 0-byte or truncated/corrupted `.xlsx` files (`zipfile.BadZipFile`, `InvalidFileException`, `OSError`).
    • Automatically backs up corrupted files to `backups/corrupted/<timestamp>/` and re-initialises a clean Workbook with standard headers.
    • Updated `_ensure_workbook_exists()` across `bank_service.py`, `share_service.py`, and `personal_finance_service.py` to use `safe_load_workbook` for automatic recovery.
  - Updated `Summary.jsx`:
    • Converted `Promise.all` to `Promise.allSettled` for `getBankData()`, `getShareData()`, and `getPersonalFinanceData()`.
    • Financial Summary now renders available modules gracefully even if an individual module request fails.

  **Pass E — Threading Lock, Non-Destructive Ensure Workbook, and Backup Recovery (2026-07-25)**
  - Added `_file_lock = threading.Lock()` across `bank_service.py`, `share_service.py`, `personal_finance_service.py`, and `excel_utils.py` to serialize concurrent disk writes and reads.
  - Made `_ensure_workbook_exists()` non-destructive across all services: `workbook.save()` is only invoked if sheet creation or header changes occur during schema initialization. Read operations no longer save workbooks unconditionally.
  - Enhanced `excel_utils.py` with `find_most_recent_valid_backup` and `repair_or_recover_workbook`:
    • Upon detecting corruption/truncation, quarantines damaged files to `backups/corrupted/<timestamp>/`.
    • Automatically searches `backups/` (excluding `corrupted/`) for the most recent uncorrupted `.xlsx` backup and restores it automatically before opening.
    • Logs an explicit warning/error if no valid backup exists.
  - Added `backend/tests/test_concurrency.py` with multi-threaded stress tests and automatic backup recovery verification.

  **Verification:** `pytest backend/tests/` → 69/69 passed (0 failed).


- [ ] 11. Release v1.2.0
  Notes: Release preparation verified on 2026-07-25; final tag/push/release is still pending and should be done manually after review.

  **Release policy update:**
  - `update-policy.json` now has `latestVersion: "1.2.0"` and keeps `minimumSupportedVersion: "1.1.0"` so FinLedge 1.1.0 users can upgrade through the safe migration path instead of being force-blocked.
  - Replaced the old release notes with end-user v1.2.0 notes covering Bank Services category redesign, Personal Expenses with Bank Flow/Cash Flow/Combined Overview, live read-only Bank Flow sync, four-part Financial Summary analytics, redesigned Settings with Import/Export/About/How To Use, and automatic non-destructive migration from 1.1.0.
  - `releaseUrl`, `availableMessage`, and `requiredMessage` were not changed.

  **Local desktop build verification:**
  - Direct `npm run build:desktop` currently delegates only to `npm run build --prefix desktop` and failed once with `EBUSY: resource busy or locked, open 'desktop/dist/win-unpacked/Finledge.exe'`.
  - The release workflow equivalent command, `npm run desktop-build` (`node ./scripts/finledge.mjs desktop-build`), completed successfully with 0 build errors.
  - Generated artifacts in `desktop/dist`:
    - `Finledge-Setup-1.2.0.exe`
    - `Finledge-Setup-1.2.0.exe.blockmap`
    - `latest.yml`
  - `latest.yml` points to `Finledge-Setup-1.2.0.exe`.
  - `desktop/package.json` has GitHub `build.publish` config, so `latest.yml` and `.blockmap` are generated as expected.

  **release.yml sanity check:**
  - `Get-ChildItem -Path "desktop\dist" -Filter "Finledge-Setup-*.exe"` finds `Finledge-Setup-1.2.0.exe`.
  - `desktop\dist\latest.yml` exists.
  - `Get-ChildItem -Path "desktop\dist" -Filter "*.blockmap"` finds `Finledge-Setup-1.2.0.exe.blockmap`.
  - No `.github/workflows/release.yml` change is needed based on the generated artifact names.

  **Backend test verification:**
  - `.\venv\Scripts\python.exe -m pytest backend\tests` passed: 66 passed, 0 failed.
  - Only warnings were FastAPI deprecation warnings for `@app.on_event("startup")`.


## v1.3.0 — Bank ↔ Cash Transfer Feature

- [x] **Backend — Transfer data model & storage**
  - `backend/models.py` — Added `TransferDirection` enum (`bank_to_cash`, `cash_to_bank`) + `PersonalFinanceTransferRequest` Pydantic model
  - `backend/services/personal_finance_service.py` — Added `TRANSFER_FILE_PATH`, `TRANSFER_SHEET_NAME` constants and `_ensure_transfer_workbook_exists()`. Separate Excel file `personal_finance_transfer.xlsx` (sheet: `Transfer Flow`) holds one row per transfer event.

- [x] **Backend — Transfer create / read**
  - `create_transfer_record()` — validates transfer amount ≤ origin side's current total income before writing (raises `ValueError` with clear message if exceeded); writes one row; returns dict with `transfer_ref = transfer:YYYY-MM-DD:xxxxxxxx`
  - `read_transfer_records()` — reads all raw rows from the transfer Excel; returns list of dicts including `transfer_direction`

- [x] **Backend — Transfer injection into flows**
  - `_build_transfer_records_for_flow(flow_type)` — shapes each transfer record per perspective: `bank_to_cash` → bank gets `signed_amount = -amount` ("Withdrawn to Cash"), cash gets `signed_amount = +amount` ("Received from Bank"); `cash_to_bank` reversed
  - `_build_transfer_records_for_combined()` — shows each transfer exactly ONCE in combined view (from originating side only, label: "Withdrawn to Cash" or "Deposited to Bank")
  - `read_personal_finance_records()` restructured — bank/cash flows include full per-perspective transfer records; combined view uses deduplicated records

- [x] **Backend — Summary accounting**
  - `_empty_flow_summary()` — added `transfer_out: 0.0` and `transfer_in: 0.0` keys
  - `summarize_personal_finance_records()` — transfer records detected by `source == "transfer"`; positive `signed_amount` → receiving side: `income +=`, `transfer_in +=`; negative → originating side: `income -=`, `transfer_out +=`; `net` correctly reflects per-side movement; combined overall_net self-balances (+/− cancel out)

- [x] **Backend — Route**
  - `routes/personal_finance.py` — Added `POST /personal-finance/transfer` endpoint
  - `routes/personal_finance.py` — Fixed `GET /personal-finance/data` combined view: summary now recomputed from full per-flow records (`bank + cash`) so both sides of each transfer are accounted for in per-side income/net; display records remain deduplicated (one row per transfer in UI)

- [x] **Frontend — API & Transfer page**
  - `personalFinanceApi.js` — Added `createTransfer(form)` → `POST /personal-finance/transfer`
  - `PersonalFinanceTransferPage.jsx` — New page: date, direction dropdown (default: "Bank to Cash (Withdraw)" / "Cash to Bank (Deposit)"), amount, optional notes; Transfer button; View Dashboard button (goes to bank or cash dashboard based on `?from=` param); "Recent transfers" section at bottom showing last 12 transfers; no live preview below amount field

- [x] **Frontend — Entry page banner**
  - `PersonalFinancePage.jsx` — Full-width gradient Transfer banner between form and recent-entries table; links to `/personal-finance-transfer?from=bank` or `?from=cash`; entry page recent-transactions table shows only `source = manual` records (12-row limit)

- [x] **Frontend — Hub & routing**
  - `PersonalFinanceHome.jsx` — Added 4th "Transfer" card (violet/fuchsia gradient); grid updated to `grid-cols-2 lg:grid-cols-4`
  - `App.jsx` — Added `/personal-finance-transfer` route + `"Transfer"` breadcrumb label; navbar changed from `max-w-6xl` centred to full-width with responsive padding (`px-6 xl:px-10 2xl:px-16`), no more odd left/right gaps on large screens

- [x] **Frontend — Dashboard**
  - `PersonalFinanceDashboard.jsx` — Transfer rows display as type "Transfer" (not "Expense" or "Income"); `transfer_in`/`transfer_out` stat rows shown conditionally when non-zero; dashboard history tables show ALL records (no 12-row cap); **Edit/Delete actions** for `source = manual` rows in Combined, Bank Flow, and Cash Flow views; "Read-only" label for synced/transfer records; ConfirmDialog wired up; data reloads in background after delete
  - `Home.jsx` & `PersonalFinanceHome.jsx` — Card grids changed to `grid-cols-2 lg:grid-cols-4 lg:gap-5 xl:gap-6`; icons grow to `xl:h-14 xl:w-14`, padding increases at xl for better large-screen appearance

- [x] **Bug fixes**
  - Cash flow income went negative: combined summary was computed from deduplicated records (only originating side of each transfer). Fixed by recomputing summary from full per-flow records in the `/data` combined endpoint.
  - Bank→Cash transfer not appearing in cash income: same root cause, same fix.
  - Combined view showed two rows per transfer: fixed by `_build_transfer_records_for_combined()`.
  - Direction label showed "Expense" for transfer records in combined history: fixed by `getDirectionLabel()` helper checking `record.source === "transfer"` first.
  - Transfer amount validation: if user tries to transfer more than available income on the origin side, backend rejects with a human-readable error message before writing anything.

---

## v1.3.0 — Category Cleanup, Transfer Edit, Splash Screen, UI Responsiveness

- [x] **Category cleanup — Expense**
  - Removed `Investment`, `SIP`, `Share Market` from `PERSONAL_FINANCE_EXPENSE_CATEGORIES` (these belong to the Share Portfolio module and Bank Services sync — adding them as manual personal expense was confusing and redundant)
  - Added `Gift` to `PERSONAL_FINANCE_EXPENSE_CATEGORIES` (user can give gifts as an expense)
  - Changes applied in both `backend/models.py` (`PF_EXPENSE_CATEGORIES` set) and `frontendwebapp/src/constants/options.js` (`PERSONAL_FINANCE_EXPENSE_CATEGORIES`)
  - Old enum values kept in `PersonalFinanceCategory` so existing saved records with those categories still deserialize correctly — they just can't be selected for new entries

- [x] **Category cleanup — Income**
  - Removed `Investment Income`, `Investment Return`, `Dividend`, `Share Sell Proceeds` from `PERSONAL_FINANCE_INCOME_CATEGORIES` (duplicated from Share Portfolio module)
  - `Gift` already in income; kept
  - Same dual change: `backend/models.py` + `options.js`

- [x] **Transfer edit — Backend**
  - `backend/services/personal_finance_service.py` — Added `update_transfer_record(transfer_id, entry_date, direction, amount, description)`: finds row by 1-based sequential ID, validates new amount against available origin income (excludes old transfer's own contribution if direction unchanged), overwrites date/direction/amount/description/last_updated_timestamp in-place in Excel
  - `backend/routes/personal_finance.py` — Added `PUT /personal-finance/transfer/{transfer_id}` endpoint

- [x] **Transfer edit — Frontend**
  - `personalFinanceApi.js` — Added `updateTransfer(transferId, form)` → `PUT /personal-finance/transfer/{id}`
  - `PersonalFinanceTransferPage.jsx` — Full edit mode: reads `?edit=N` from URL, loads that transfer into the form, submits as PUT; Cancel button returns to transfer page; "Save Changes"/"Saving…" button labels in edit mode; history table now shows Edit button per row (navigates to `?edit=N`); edit mode hides the history section and the description paragraph

- [x] **Splash screen — app logo pulse**
  - `desktop/main.js` — `getLoadingUrl()` replaced: reads `finledge_icon.png` as base64 and embeds it directly in the splash HTML; full-screen white background; icon centred at 100×100px with rounded corners; CSS `@keyframes pulse` animation fades opacity 1→0.35→1 and scales 1→0.92→1 every 1.6s; app name "FinLedge" and "Starting up…" shown below; falls back to a gradient "F" div if icon file not found

- [x] **Cards — always 4-col on lg+, larger on xl**
  - `Home.jsx` — grid class changed from `sm:grid-cols-2 lg:grid-cols-4` to `grid-cols-2 lg:grid-cols-4 lg:gap-5 xl:gap-6`; card inner padding increased at xl (`xl:p-8`); icon size increased at xl (`xl:h-14 xl:w-14`); title font size increased at xl (`xl:text-xl`)
  - `PersonalFinanceHome.jsx` — same grid class change


- [x] **Navbar — full-width, no odd gaps**
  - `App.jsx` — removed `max-w-6xl` and `mx-auto` from header inner div; changed to full-width with responsive padding `px-6 xl:px-10 2xl:px-16`; added subtle `border-b border-slate-200/60`; reduced nav link padding from `px-4` to `px-3` and gap from `gap-3` to `gap-1` so all 5 links fit on one row at laptop width without wrapping

---

## v1.3.0 — Platform Separation: Desktop Versioning & Release System

- [x] **New versioning scheme: `desktop-vX.Y.Z`**
  - Desktop releases now use the tag format `desktop-v1.3.0` instead of `v1.3.0`
  - `desktop/package.json` bumped to `1.3.0`
  - Root `package.json` bumped to `1.3.0`

- [x] **New update policy file: `desktop-update-policy.json`**
  - Created `desktop-update-policy.json` — primary update policy for desktop clients v1.3.0+
  - `latestVersion` field uses the full `"desktop-v1.3.0"` string
  - `releaseUrl` points to the `desktop-v1.3.0` GitHub tag
  - Kept `update-policy.json` as a **backward-compatibility shim**: old clients (v1.1.0–v1.2.0) still fetch this URL; `latestVersion` updated to plain `"1.3.0"` so their old `parseVersionParts` (which only strips a `v` prefix) can still detect the upgrade. `releaseUrl` in the shim also points to the new `desktop-v1.3.0` tag.

- [x] **`desktop/main.js` — update checker adapted for new versioning**
  - `DEFAULT_UPDATE_POLICY_URL` → `desktop-update-policy.json`
  - `parseVersionParts(version)` — now strips `desktop-v` prefix first, then legacy `v`, so `"desktop-v1.3.0"` → `[1, 3, 1]` and can be compared with the running `app.getVersion()` (`"1.3.0"`)
  - `getReleaseUrl(info)` — now constructs GitHub tag URLs as `desktop-v${bare}` (e.g. `.../tag/desktop-v1.3.0`) instead of the old `v${bare}` format

- [x] **GitHub Actions workflow renamed and updated**
  - `.github/workflows/release.yml` **deleted**
  - `.github/workflows/desktop-release.yml` **created** — triggers on `desktop-v*.*.*` tags, release title is `FinLedge Desktop desktop-v1.3.0`, everything else (build steps, asset upload) unchanged

- [x] **Platform separation rationale**
  - Mobile version is coming; `desktop-update-policy.json` is the desktop-specific policy — a future `mobile-update-policy.json` can be added independently
  - Tags like `desktop-v1.3.0` and (future) `mobile-v1.0.0` coexist cleanly in the same repo without collision
  - Old clients keep working through the `update-policy.json` shim

---

## Security & Maintenance Pass (2026-09-08)

- [x] **Dependency vulnerability cleanup — `frontendwebapp` (6 → 0)**
  - `react-router-dom` `^6.27.0` → `^7.18.3` — required because React Router advisories GHSA-wrjc-x8rr-h8h6 (open redirect) and GHSA-337j-9hxr-rhxg (SSR constructor injection) are only fixed in `>=7.18.0`; no safe 6.x release exists. App only uses the standard declarative APIs (`BrowserRouter`/`HashRouter`, `Routes`, `Link`, `Navigate`, `Outlet`, `useLocation`, `useNavigate`, `useSearchParams`), all fully supported in v7, and React 18.3.1 satisfies the v7 `>=18` peer requirement. Verified via `npm run build` (608 modules) + smoke test.
  - `postcss` `^8.4.49` → `^8.5.28` — fixes GHSA-fxqj-rqcc-2cmp / GHSA-r28c-9q8g-f849 (path traversal via sourceMappingURL).
  - Transitive deps auto-fixed by lockfile re-resolution + `npm audit fix`: `browserslist` 4.28.9, `nanoid` 3.3.18, `postcss-selector-parser` 6.1.4.
  - Result: `npm audit` = 0 vulnerabilities; production build passes.

- [x] **Dependency vulnerability cleanup — `desktop` (7 → 0)**
  - `electron` `^42.4.0` → `^42.11.2` (latest of the same 42.x major — no runtime breaking change) — fixes GHSA-r4w5-6pfg-jxp5 (session cache leak in `ProtocolResponse.url`). The dev app instance had to be closed first so the old binary DLLs were not locked; verified `npx electron --version` → `v42.11.2`.
  - Remaining vulns were all **build-time** electron-builder toolchain deps, fixed in place with `npm audit fix` (no `--force`, no overrides, `electron-builder` stayed at `^26.15.3`): `tar` 7.5.22, `undici` 6.28.1 / 7.29.1, `fast-uri` 3.1.7, `js-yaml` 4.3.2, `@xmldom/xmldom` 0.8.15, `brace-expansion` 1.1.18 / 2.1.4 / 5.0.9.
  - Result: `npm audit` = 0 vulnerabilities.

- [x] **FastAPI `@app.on_event("startup")` deprecation fix** (`backend/main.py`)
  - Replaced the deprecated `@app.on_event("startup")` decorator (warned about in pytest output, see test verification note below) with the recommended **`lifespan` context manager** (`@asynccontextmanager`), wired via `FastAPI(..., lifespan=lifespan)`.
  - Migration behaviour unchanged: `apply_pending_data_migrations()` still runs before the app serves, still prints the same `[migration] ...` status line.
  - Verified with `venv\Scripts\python.exe -m py_compile backend/main.py` and `from backend.main import app`.

- **Backups**: original `package.json` / `package-lock.json` for both `frontendwebapp` and `desktop` copied to `%TEMP%\opencode\finance_backup\` before any dependency changes. Nothing committed.

