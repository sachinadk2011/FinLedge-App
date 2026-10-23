# desktop-tasks.md — Desktop track: MSIX + .exe coexistence (agent tasks only)

Branch: new branch from `main`. Desktop only. Do not add mobile code, flags, or docs.
Read before every task: `desktop-codebase.md`, `AGENTS.md`, `PLAN.md`,
`SAFETY.md`, `TASKS.md`.
Release tasks also: `techSpec.md` and the update-policy JSON files.
Progress tracker: tick boxes and append notes only (AGENTS.md §9 / §12).
Whenever a desktop file or folder is added, removed, renamed, or moved, update
`docs/desktop-codebase.md` in the same task with its purpose. Keep desktop-only
structure notes out of the mobile-edited `CODEBASE.md`.

Out of scope for the agent (the user handles these): Partner Center, Store listing and
submission, certificates/identity values, hosting or pushing the website repo, manual
install testing on their machine.

## Fixed decisions

- Keep the `.exe` (nsis) target. Do NOT delete or comment out its code. Add a build
  target switch `exe | msix | both` (default `both`) so it can be turned off later.
- Tags stay `desktop-vX.Y.Z`.
- The Store build never self-updates.
- Data is copied, never moved. Nothing is deleted from the old location.
- Never invent publisher/identity values. Read them from one packaging config file with
  clearly marked placeholders the user fills in. Never commit certificates or keys.

---

## Phase 0 — Baseline

- [ ] 0.1 Run `pytest backend/tests/` and `npm run desktop-build` untouched; record results.
- [ ] 0.2 Document the current data-dir logic (`path_utils.get_data_dir()`,
  `FINLEDGE_DATA_DIR`, Electron `userData`) under Notes. Phase 3 depends on it.
- [x] 0.3 All tests in this file use pytest `tmp_path` or `/tmp/finledge-test-<random>/`.
  Never touch `.finledge-dev-data/` or `%APPDATA%\Finledge\` (SAFETY.md).

## Phase 1 — Backup before every write

- [x] 1.1 One shared helper in `backend/services/excel_utils.py`:
  `snapshot_before_write(file_path)` copies the live workbook to
  `backups/auto/<file-stem>/<timestamp>.xlsx` before any add/update/delete save.
- [x] 1.2 Retention: all snapshots from last 24 h, then one per day for 30 days, then one
  per month for 12 months. Pruning only touches files under `backups/auto/`.
- [x] 1.3 Call it from the mutation paths in `bank_service.py`, `share_service.py`,
  `personal_finance_service.py` (both flows + transfer file). The Settings import already
  backs up — don't double it.
- [x] 1.4 If the snapshot fails, abort the write and return a clear plain-language error.
- [x] 1.5 `repair_or_recover_workbook()` can restore from `backups/auto/` (still excludes
  `corrupted/`) and surfaces a visible message when it recovers (SAFETY.md §6).
- [x] 1.6 Tests: snapshot before add/update/delete; retention keeps recent files; failed
  snapshot aborts write; concurrency (extend `test_concurrency.py`).
- [x] 1.7 Settings → Backup panel (now a placeholder): show backup folder + "Open backup
  folder" button. Plain copy only (AGENTS.md §14).

## Phase 2 — Cleanups (double counting, removals)

AGENTS.md §0.5: ambiguous = narrower action. PLAN.md Hard Constraints still apply.

- [x] Phase 2 task 1: Keep Personal Expenses independent from Bank Services and Share Portfolio; simplify requested copy and make chart colors consistent.
- [x] Phase 2 task 2: Match desktop Bank Services, Share Portfolio, and Personal Expenses dashboard ordering, period controls, filters, and compact chart labels to the mobile dashboard behavior while keeping Personal Expenses descriptions intact.
- [x] Phase 2 task 3: Hide zero-value category and breakdown bars when there are no transactions contributing to them in the selected period.
- [x] Phase 2 task 4: Widen module graphs, make their history slider fixed-height, keep all bars above zero with signed/color-coded labels, and match the mobile chart legend, colors, and compact-money rules. Financial Summary chart layout stays as it was.
- [x] Phase 2 task 5: Smooth chart history navigation, improve range controls, show bank income categories and both sides of Personal Expenses transfers, unify sign colors, overlay alerts, shorten transfer errors, focus edit forms, and apply readable chart rules to Financial Summary.
- [x] Phase 2 task 6: Keep Financial Summary charts in the right column with three visible periods, simplify the final net chart, show bank charges as signed red values, use colored overlay alerts for success/warning/error, and keep top navigation on one row at minimum window widths.
- [x] Phase 2 task 7: Make the top navigation text responsive with a readable minimum, remove redundant Settings descriptions, and add independent Month/Year/Custom controls inside each Financial Summary chart with a clear four-series overall graph.
- [x] Phase 2 task 8: Add All Time to module and Summary period controls, calculate each selected range through its category charts and detail metrics, show a floating Custom date panel, and make the full-width overall graph show five periods with signed labels in stable series colors.
- [x] Phase 2 task 9: Move Share Portfolio period controls above its dashboard details, increase navigation text size slightly, and improve full-screen spacing on the Home and Personal Expenses screens.
- [x] Phase 2 task 10: Keep alert messages flexible while pinning the dismiss button to the far-right edge.
- [x] Phase 2 task 11: Add a five-second alert countdown bar and clear submitted amount/description fields after entry success or failure while preserving dropdown selections.
- [x] Phase 2 task 12: Audit reuse across backend, renderer, and Electron; centralize notice timing and shared Share numeric/timestamp helpers, extract desktop update metadata helpers, and make backend tests visible to Git.

## Phase 3 — Shared data folder + running both builds safely

- [ ] 3.1 Default data dir for BOTH builds: `%USERPROFILE%\Documents\FinLedge`.
  `FINLEDGE_DATA_DIR` override keeps working.
- [ ] 3.2 One-time startup migration (same pattern as `data_migration_service.py`): if the new
  dir has no workbooks and `%APPDATA%\Finledge\` does, COPY workbooks over, open-validate
  each, write a JSON report, leave originals untouched. Never overwrite a non-empty dest.
  Re-running is a no-op.
- [ ] 3.3 If the folder isn't writable: plain error + let the user pick a folder in Settings.
  No silent fallback elsewhere.
- [ ] 3.4 Cross-instance lock: `.finledge.lock` in the data dir (pid, build type, heartbeat).
  A second instance (exe or MSIX) doesn't write; it shows "FinLedge is already open in the
  other version." Stale locks (dead pid / old heartbeat) are taken over.
  `requestSingleInstanceLock()` alone is not enough (different identities).
- [ ] 3.5 Settings → General shows data folder path and build type (Installer / Store).
- [ ] 3.6 Tests (tmp dirs): copy leaves source intact; rerun no-op; lock blocks second
  writer; stale lock taken over; unwritable folder handled.

## Phase 4 — MSIX packaging

- [ ] 4.1 Add the MSIX target to the Electron build next to nsis. Use electron-builder's
  `appx` target, or `msix` if the installed version offers it; check the version in use.
- [ ] 4.2 Packaging config file with placeholder identity values (Name, Publisher,
  PublisherDisplayName) for the user to fill in.
- [ ] 4.3 Version mapping in `sync-version.mjs`: 4-part, last part `0` (`1.3.0` → `1.3.0.0`).
- [ ] 4.4 Generate Store logo sizes from the existing FinLedge icon into a build assets folder.
- [ ] 4.5 Capability `runFullTrust`; no extra capabilities.
- [ ] 4.6 Make the Python sidecar work inside the package: package files are read-only, so all
  writes go to the Phase 3 data dir or a temp/cache dir.
- [ ] 4.7 Add a documented root command that builds a locally installable test package
  (self-signed, using a user-supplied test cert path from env var) so the user can test.

## Phase 5 — Store-aware behaviour

- [ ] 5.1 Detect Store build (`process.windowsStore`) and expose via preload bridge.
- [ ] 5.2 Store build: disable the update checker and update prompts. `.exe` flow unchanged.
- [ ] 5.3 Version panel shows the same version in both builds.

## Phase 6 — Root commands, scripts, workflow

- [ ] 6.1 Root scripts: `desktop-dev`, `desktop-build:exe`, `desktop-build:msix`,
  `desktop-build:all`. Existing `desktop-build` keeps today's behaviour.
- [ ] 6.2 `scripts/finledge.mjs`: target switch; extend `cleanDesktopArtifacts()` only for
  the new known output dirs (SAFETY.md §5).
- [ ] 6.3 `sync-version.mjs` / `verify-version.mjs`: include the 4-part MSIX version; verify
  fails on mismatch.
- [ ] 6.4 `.github/workflows/desktop-release.yml` (windows-latest): build `.exe`,
  `latest.yml`, `.blockmap` AND the MSIX; upload all to the same GitHub Release; fail if any
  expected file is missing.
- [ ] 6.5 `.exe` auto-update still works: `latest.yml`, `desktop-update-policy.json`, and the
  `update-policy.json` shim stay valid.

## Phase 7 — Website files (separate sibling folder, not in this repo)

- [ ] 7.1 Create `../finledge-website/` with plain static HTML/CSS: Home (with download
  links as placeholders), Privacy Policy, Terms and Conditions, Support. No git push.
- [ ] 7.2 Privacy Policy must match the real app: offline-first, local Excel files, no
  data sent to servers, backups, how to delete data. Note the update check contacts GitHub
  (`.exe` build only). Contact email as a placeholder.
- [ ] 7.3 Terms: as-is software, user responsible for own data and backups, not financial advice.

## Phase 8 — Automated verification

- [ ] 8.1 `pytest backend/tests/` green after every phase.
- [ ] 8.2 Automated tests cover: backup-before-write, data-dir migration, lock behaviour,
  corrupted-file recovery from `backups/auto/`.
- [ ] 8.3 Write a short manual test checklist (for the user) at the end of Notes: exe only,
  MSIX only, existing data then MSIX, both installed (lock message), uninstall keeps data.
- [ ] 8.4 Final response states anything not verified (e.g. "Static source/HTML check only —
  rendered-in-browser verification was NOT performed.").

## Notes / log

(append dated entries; include a "Docs touched" line per AGENTS.md §11)

### 2026-10-23 — Phase 2 task 11: Alert countdown and entry field cleanup

- **What changed:** Added a shrinking five-second progress bar to overlay alerts. Bank Services, Share Portfolio, Personal Expenses, and Bank ↔ Cash Transfer forms clear amount-related fields and descriptions after successful or failed submissions while retaining selected categories, entry types, flows, and transfer direction.
- **Verification:** `npm run build --prefix frontendwebapp` passed. The existing large-chunk warning remains.
- **Docs touched:** `docs/desktop-tasks.md` (checklist item and dated log).

### 2026-10-23 — Phase 2 task 10: Alert close button alignment

- **What changed:** Let alert text occupy the available row width and automatically push the close button to the far-right edge.
- **Verification:** `npm run build --prefix frontendwebapp` passed. The existing large-chunk warning remains.
- **Docs touched:** `docs/desktop-tasks.md` (checklist item and dated log).

### 2026-10-23 — Phase 2 task 9: Share controls and full-screen spacing

- **What changed:** Moved Share Portfolio's Week/Month/Year/Custom/All Time selector to the top of the dashboard, before its detail cards, matching the other module dashboard placement.
- **Navigation:** Increased the responsive navigation label range slightly while retaining the minimum readable size and horizontal scrolling at narrow widths.
- **Layout:** Reworked the Home and Personal Expenses landing screens to use a centered responsive content area and taller module cards at large screen sizes. Bounded wide dashboard pages at 1800px to avoid over-stretched content on very large displays.
- **Result:** Period controls are immediately visible in Share Portfolio, and Home/Personal Expenses use large displays more intentionally with less unused space.
- **Verification:** `npm run build --prefix frontendwebapp` passed. The existing large-chunk warning remains. Static source/HTML check only — rendered-in-browser verification was NOT performed.
- **Docs touched:** `docs/desktop-tasks.md` (checklist item and dated log).

### 2026-10-23 — Phase 2 task 8: All Time and floating custom ranges

- **What changed:** Added All Time controls to Bank Services, Share Portfolio, Personal Expenses, and each Financial Summary section. All Time uses each module's earliest dated record through today; Summary metrics, category charts, trend charts, and the overall position chart all use their selected date range.
- **Custom dates:** Custom now opens a floating panel with From/To dates and Apply/Cancel actions instead of placing date inputs inline.
- **Overall graph:** The full-width graph displays up to five periods. Negative values retain each series' normal color and include a minus sign in the label.
- **Settings:** Restored the Investment panel note that interest rate settings will be available in a future update, as requested. Other Settings description removals remain.
- **Verification:** `npm run build --prefix frontendwebapp` passed. The existing large-chunk warning remains. Static source/HTML check only — rendered-in-browser verification was NOT performed.
- **Docs touched:** `docs/desktop-tasks.md` (checklist item and dated log).

### 2026-10-23 — Phase 2 task 7: Header, Settings copy, and Summary chart controls

- **What changed:** Kept the desktop top bar in a stable two-column row. Navigation labels now keep a readable minimum size and can scroll horizontally when the available width is tight; the brand and route label have a bounded column.
- **Settings:** Removed redundant explanatory copy from General, Import/Export, Backup, Investment, Privacy, and Version panels while preserving required-column labels, status messages, and About/guide instructions.
- **Financial Summary:** Added independent Month/Year/Custom controls inside each corresponding chart card. Each chart filters its own data range and displays three periods at a time. The final graph now shows only per-period Bank Services net, Share Portfolio profit/loss, Personal Expenses net, and Overall net, with a separate legend entry for each.
- **Result:** Users can change the period for each Summary chart without a detached control panel, and the overall graph names its four series directly.
- **Verification:** `npm run build --prefix frontendwebapp` passed. The existing large-chunk warning remains. Static source/HTML check only — rendered-in-browser verification was NOT performed.
- **Docs touched:** `docs/desktop-tasks.md` (checklist item and dated log).

### 2026-10-23 14:53 +05:45 — Phase 2 task 6: Summary density and consistent alerts

- **What changed:** Financial Summary trend charts remain in the right column beside their breakdown charts and show three periods at a time. The final net-worth chart now contains one net series each for Bank Services, Share Portfolio profit/loss, Personal Expenses, and Overall position; the separate Share Portfolio in/out movement series were removed. The Personal Expenses net label no longer says “Manual.”
- **Color and alerts:** Bank charge categories now render as negative red values in both Bank Services category charts. Success, warning, and error messages use the same fixed overlay panel with green, amber, and red styling, including share-update dialog messages.
- **Navigation:** The application header remains a single horizontal row at narrow widths. Navigation links do not wrap into another row; the route label beside the logo can wrap within its own space.
- **Result:** The Summary keeps its two-column structure and reduced chart density, the final graph shows only the requested net series, and alerts share a consistent non-layout-shifting presentation.
- **Verification:** `npm run build --prefix frontendwebapp` passed. Static source/HTML check only — rendered-in-browser verification was NOT performed. The browser runner could not start because Chrome is not installed at its expected path.
- **Docs touched:** `docs/desktop-tasks.md` (this checklist item and dated log).

### 2026-10-23 14:22 +05:45 — Phase 2 task 5: Dashboard navigation, summaries, and notices

- **What changed:** Added one-step older/newer chart controls beside the direct history slider and enabled short chart transitions. Reworked month/year/custom controls into a compact segmented selector with aligned custom date inputs.
- **Summary fixes:** Bank Services category charts now include earned-interest categories as well as charges. Personal Expenses creates a receiving-side view of each transfer for Bank Flow and Cash Flow calculations and transaction lists while retaining one transfer in the combined list. Negative share profit/loss values use a minus sign and red; other charts use the matching income, expense, and net colors.
- **Usability:** Added the shared `StatusNotice` overlay, which does not reserve page space and dismisses automatically after five seconds. Transfer-limit errors now read “Exceeds your Bank/Cash income.” Edit navigation scrolls to the entry form and focuses its first field.
- **Financial Summary:** Converted its timeline graphs to the same fixed-height history slider, compact labels, signed values, color rules, and legends used by module dashboards.
- **Result:** Users can move through chart periods one step at a time or jump with the slider, review income and transfers on the correct side, see readable loss indicators, and edit entries without searching down the page.
- **Verification:** `npm run build --prefix frontendwebapp` passed. Scoped `git diff --check` passed, and the touched-source marker scan found no TODO/debug placeholders. Static source/HTML check only — rendered-in-browser verification was NOT performed. The Playwright browser could not start because Chrome is not installed at its expected path.
- **Docs touched:** `docs/desktop-tasks.md` (this checklist item and dated log), `docs/desktop-codebase.md` (new shared notice component).

### 2026-10-23 09:22 +05:45 — Phase 2 task 4: Full-width readable dashboard charts

- **What changed:** Bank Services, Share Portfolio, and Personal Expenses dashboard
  pages now use the available viewport width. Trend charts choose the number of visible
  periods from chart width, showing at least 7 daily buckets or 5 monthly buckets when
  available. The history control is a separate fixed-height slider directly below the
  plot, with bar spacing increased for clearer marks and labels.
- **Chart rules:** Module trend bars use absolute heights from zero; negative values
  remain signed in compact labels and use their semantic negative color. Share Portfolio
  now charts signed net portfolio flow (inflow green, outflow red). Bank and Personal
  Expenses use the mobile legend semantics: income green, expense red, net positive teal,
  net negative amber. Hover tooltips retain full precision. Compact values match mobile
  (`k` and `L`). Financial Summary keeps its existing chart layout and brushing.
- **Mobile rules consulted:** Read `feature/mobile-v1` chart components, period utilities,
  design color/compact-money rules, and mobile task notes. No mobile files or shared/mobile
  markdown files were edited.
- **Result:** Module trend graphs use the full renderer width and show larger, spaced bars,
  signed values, and a color legend. The slider changes only the visible history window.
- **Verification:** `npm run build --prefix frontendwebapp` passed. Browser preview was
  attempted, but the in-app browser blocked the local development address.
  Static source/HTML check only — rendered-in-browser verification was NOT performed.
- **Docs touched:** `docs/desktop-tasks.md` (this checklist item and dated log).

### 2026-10-23 08:59 +05:45 — Phase 2 task 3: Hide empty breakdown categories

- **What changed:** Bank Services only lists charge categories with transactions in the
  selected period. Share Portfolio omits zero-valued breakdown rows. Personal Expenses
  omits empty income/expense categories and hides breakdown panels with no contributing
  values.
- **Result:** Empty periods still show zero in the summary metrics, while category and
  breakdown charts show only values contributed by selected-period records.
- **Verification:** `npm run build --prefix frontendwebapp` passed; the existing large
  JavaScript chunk warning remains.
- **Docs touched:** `docs/desktop-tasks.md` (this checklist item and dated log).

### 2026-10-23 08:49 +05:45 — Phase 2 task 2: Period-aware module dashboards

- **What changed:** Added reusable period range controls, date filtering, and transaction
  search/category filters. Bank Services defaults to month; Share Portfolio and Personal
  Expenses default to week. Year and custom date ranges are available, and custom ranges
  switch to monthly chart buckets when they span more than 60 days.
- **Dashboard behavior:** Period selection recalculates summary metrics, category
  breakdowns, chart series, and transaction rows. The dashboard order is metrics, range
  control, category breakdown, trend graph, and transactions. Transaction edit/delete
  controls remain available where supported.
- **Charts:** Added compact labels above timeline bars while preserving full-precision
  hover tooltips. Share investment outflows use red and proceeds/profit use green; Personal
  Expenses income/expense/net use green/red/teal (amber for negative net). Category bars
  remain one consistent color per breakdown.
- **Scope:** Personal Expenses remains based on its own Bank Flow/Cash Flow and transfer
  records only. Its entry form and description field were left intact. No mobile source or
  shared/mobile-edited markdown was changed.
- **Result:** Users can review past periods with matching totals, charts, categories, and
  transaction lists across the three module dashboards.
- **Verification:** `npm run build --prefix frontendwebapp` passed. Browser rendering
  could not be launched because the Playwright environment has no installed Chrome.
  Static source/HTML check only — rendered-in-browser verification was NOT performed.
- **Docs touched:** `docs/desktop-tasks.md` (this checklist item and dated log),
  `docs/desktop-codebase.md` (new reusable renderer files and responsibilities).

### 2026-10-22 23:14 +05:45 — Phase 2 task 1: Personal Expenses separation and dashboard cleanup

- **What changed:** Removed the live Bank Services and Share Portfolio readers and
  Share Portfolio sync writers from Personal Expenses. Personal Expenses now reads
  its own Bank Flow and Cash Flow rows plus transfers. Legacy linked-module rows and
  share-only categories are excluded from its records and totals; those rows remain
  in their workbooks. Removed share-only category choices from the Personal Expenses
  API model. Financial Summary continues to calculate Bank Services and Share
  Portfolio from their own module data.
- **UI cleanup:** Removed the explanatory paragraph below Bank ↔ Cash Transfer and
  redundant descriptions from the Personal Expenses and Share dashboards and
  Financial Summary. Kept the Personal Expenses home card subtitles and the
  “Search share (IPO only)” control. The transfer page does not display a save-folder
  message. Breakdown bars now use semantic colors and stable colors for categories.
- **Result:** Personal Expenses contains only everyday entries and bank/cash
  transfers; investment, SIP, share-market, dividend, and linked-module rows do not
  contribute there. Existing transfers and Financial Summary calculations remain.
- **Mobile comparison:** Checked `feature/mobile-v1`; its matching transfer and share
  dashboard still contain the explanatory copy, so there was no completed mobile
  cleanup to mirror. No mobile code or mobile-shared docs were edited.
- **Verification:** `pytest backend/tests/` — 82 passed. `npm run build
  --prefix frontendwebapp` passed (Vite reported its existing large-chunk warning).
  The transfer route rendered in a browser and its DOM showed the heading and form
  without the removed paragraph or a save-folder message. Screenshot-based visual
  inspection timed out in the browser controller.
- **Docs touched:** `docs/desktop-tasks.md` (this checklist item and task log),
  `docs/desktop-codebase.md` (new regression test file map), `.gitignore` (allow the
  new desktop regression test file).

### 2026-10-22 — Phase 0 desktop backend audit and Phase 1 backups

- Phase 0 scope followed the user's direction to audit backend organization and
  scalability. Findings are in `docs/desktop-backend-audit-phase0.md`. Route/service
  separation is present; Personal Finance, Share, and Settings services combine
  multiple concerns and are candidates for later desktop-only splits.
- Phase 0 baseline item 0.1 remains unchecked: the backend tests were run after
  implementation, not untouched, and `npm run desktop-build` was not run. Item 0.2
  remains unchecked because the requested Phase 0 scope was the backend structure
  audit, not the separate data-directory documentation task. No dev or production
  workbook directory was used. Item 0.3 is checked; added tests use `tmp_path`.
- Phase 1 complete: added `snapshot_before_write()` and the 24-hour/daily/monthly
  retention policy; wired it before Bank, Share, Personal Expenses flow, transfer,
  and persisted sync-row mutations. Settings import keeps its existing backup path.
  Snapshot errors abort saves with a plain-language message. Recovery now searches
  timestamp-named `backups/auto/` snapshots, still skips `corrupted/`, and surfaces
  a warning through API responses to the desktop pages. Settings → Backup shows the
  backup folder and an open-folder button.
- Verification: `pytest backend/tests/` — 75 passed. Frontend production build passed.
  Browser preview showed the Backup panel; a development update overlay obscured
  part of it, and Electron's native folder action was not tested in the packaged app.
- Test coverage is in `backend/tests/test_auto_backups.py`, including add/update/delete,
  retention, snapshot failure, recovery warning, and concurrent writes. This provides
  the requested concurrency coverage without editing the existing ignored
  `test_concurrency.py` file.
- Docs touched: `docs/desktop-tasks.md` (progress ticks and this dated log),
  `docs/desktop-backend-audit-phase0.md` (desktop audit and implementation record).

### 2026-10-22 — Desktop codebase map

- Added `docs/desktop-codebase.md` as the desktop-only architecture and file map,
  including responsibilities for current backend, Electron, renderer, scripts,
  release files, and desktop documentation.
- Added a standing instruction above to update that map whenever desktop files or
  folders are added, removed, renamed, or moved.
- Docs touched: `docs/desktop-codebase.md` (new desktop map),
  `docs/desktop-tasks.md` (maintenance rule and dated log).

### 2026-10-23 — Reuse and scalability audit

- Checked reusable boundaries across backend services, renderer pages/components,
  and Electron main-process code. Shared period controls, charts, table filters,
  transactions, and stat grids are already used across the relevant dashboards.
- Removed page-level notice timers so the shared `StatusNotice` and
  `useDismissibleMessage` own dismissal timing and progress consistently.
- Reused `excel_utils.py` numeric and timestamp helpers from Share service instead
  of keeping duplicate implementations.
- Moved Personal Expenses summary calculations and Share FIFO lot calculations
  behind focused service modules while preserving the existing service-facing API.
- Extracted pure release-note, version-comparison, and release-URL helpers to
  `desktop/utils/updateMetadata.js`; included this folder in the packaged app.
- Kept the general `tests/` ignore rule but added explicit exceptions for
  `backend/tests/` and its files, so the backend suite is visible to Git.
- Verification: all 82 existing backend tests passed; frontend production build passed;
  `npm run desktop-build` completed and the packaged `app.asar` contains
  `utils/updateMetadata.js`. The frontend build reports the existing large-chunk
  advisory; Electron Builder's first sandboxed attempt was blocked at `node_modules`
  access, then the elevated retry succeeded.
- Docs touched: `docs/desktop-tasks.md`, `docs/desktop-codebase.md`.
