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

  **Follow-up — desktop branding rename "Financial Tracker" → "FinLedge"**
  Notes: Completed as visible UI text only per AGENTS.md §6 Hard Rule 2 (renaming UI labels, no logic changes). Updated desktop window title and loading text in `desktop/main.js`, the badge mark `FT` → `FL` and header text "Financial Tracker" → "FinLedge" in `frontendwebapp/src/App.jsx`, the Home hero eyebrow in `frontendwebapp/src/pages/Home.jsx`, and the page title in `frontendwebapp/index.html`. Files, routes, service names, API/bridge identifiers (`window.financialTracker`), and `package.json` package names were intentionally left unchanged, matching the v1.2.0 module rename pattern.
