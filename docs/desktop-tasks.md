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

- [x] 3.1 Packaged data dir: `%USERPROFILE%\Documents\FinLedge`; development defaults to
  `%APPDATA%\Finledge Development`. `FINLEDGE_DATA_DIR` overrides either location.
  Startup preparation creates any missing module workbook files after migration.
- [x] 3.2 One-time startup migration (same pattern as `data_migration_service.py`): packaged
  builds look for prior data in `%APPDATA%\Finledge`; development copies prior data from
  the project `.finledge-dev-data` folder into `%APPDATA%\Finledge Development`. Migration
  validates workbooks, writes a JSON report, leaves originals untouched, never overwrites a
  non-empty destination, and is a no-op after completion. If default-folder migration fails,
  startup falls back to the original data folder and reports that choice in Settings.
- [x] 3.3 If the folder isn't writable: plain error + let the user pick a folder in Settings.
  No silent fallback elsewhere.
- [x] 3.4 Cross-instance lock: `.finledge.lock` in the data dir (pid, build type, heartbeat).
  A second instance (exe or MSIX) doesn't write; it shows "FinLedge is already open in the
  other version." Stale locks (dead pid / old heartbeat) are taken over.
  `requestSingleInstanceLock()` alone is not enough (different identities).
- [x] 3.5 Settings → General shows data folder path and build type (Development / Testing / Installer / Microsoft Store).
- [x] 3.6 Tests (tmp dirs): copy leaves source intact; rerun no-op; lock blocks second
  writer; stale lock taken over; unwritable folder handled.
- [x] 3.7 Default Electron user-data roots now use a dedicated `FinLedge Data` child
  folder, with a timestamped source backup before recognized workbooks/backups are copied;
  legacy bank/share filenames are normalized, originals remain, and explicit/saved custom
  data locations are left as selected.

## Phase 4 — MSIX packaging

- [x] 4.1 Add the MSIX-family target to the Electron build next to nsis. Use electron-builder's
  `appx` target, or `msix` if the installed version offers it; check the version in use.
- [x] 4.2 Packaging config file with placeholder identity values (Name, Publisher,
  PublisherDisplayName) for the user to fill in.
- [x] 4.3 Version mapping in `sync-version.mjs`: 4-part, last part `0` (`1.3.0` → `1.3.0.0`).
- [x] 4.4 Generate Store logo sizes from the existing FinLedge icon into a build assets folder.
- [x] 4.5 Capability `runFullTrust`; no extra capabilities.
- [x] 4.6 Make the Python sidecar work inside the package: package files are read-only, so all
  writes go to the Phase 3 data dir or a temp/cache dir.
- [x] 4.7 Add a documented root command that builds a locally installable test package
  (self-signed, using a user-supplied test cert path from env var) so the user can test.
- [x] AppX installation UX audit: verify manifest registration, keep package updates Windows-managed,
  and offer a per-version optional desktop shortcut from the app on first launch.
- [x] AppX follow-up: correct the shortcut package identity lookup, generate the EXE icon
  from the canonical PNG used by AppX assets, and build/inspect separate Testing packages.
- [x] AppX runtime follow-up: use an in-app shortcut prompt, bind the taskbar window to the
  package AUMID, use Explorer-accessible AppX data/icon paths, and distinguish preparation
  failures from folders that actually need user selection.
- [x] Add the target-size AppX icon resources Windows requires to avoid its system backplate;
  correct the installed Testing build's undefined shortcut AUMID variable.

## Phase 5 — Store-aware behaviour

- [x] 5.1 Detect AppX using `process.windowsStore`, expose package-managed updates via preload,
  and keep the Store distribution marker for production channel labeling.
- [x] 5.2 Disable automatic/manual update checks and renderer update prompts for all AppX builds;
  NSIS update behavior remains available.
- [x] 5.3 Version panel reads the packaged Electron version for both AppX and NSIS builds.

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

### 2026-10-27 — Preserve legacy data sources and reduce packaged startup time

- **Data safety:** Legacy workbook migration now retains source files. Timestamped source
  backups are still made before new or changed workbook merges, and unchanged already
  migrated rows do not cause another migration snapshot.
- **Startup:** The packaged Python sidecar now uses PyInstaller onedir. EXE and AppX
  include the engine folder, avoiding repeated runtime extraction during preparation and
  backend launches.
- **Test-package names:** Combined EXE/AppX test builds now use stable output filenames;
  the incrementing AppX revision remains inside the package so Windows can still perform
  in-place test upgrades without accumulating newly revision-suffixed filenames.
- **Data model:** Production EXE and AppX keep using `Documents\\FinLedge\\FinLedge Data`
  outside their install folders. The cross-build lock remains necessary while both
  builds use the same Excel files.
- **Docs touched:** `backend/services/data_directory_service.py`,
  `backend/tests/test_data_directory_service.py`, `.gitignore`,
  `backend/tests/test_settings.py`,
  `desktop/scripts/build-sidecar.ps1`, `desktop/package.json`,
  `desktop/services/childProcessManager.js`, `desktop/tests/dataDirectory.test.cjs`,
  `desktop/services/dataDirectoryRuntime.js`, `docs/desktop-appx-testing.md`,
  `docs/desktop-codebase.md`, `docs/desktop-tasks.md`, `scripts/finledge.mjs`.

### 2026-10-26 — Data backup paths, import timestamps, and backend isolation

- **Backup-folder investigation:** The checked migration and backup code copies existing
  backup trees and does not remove `migration`, `auto`, or `import` directories. Automatic
  retention removes individual old snapshot `.xlsx` files under `auto`; it does not remove
  the backup directories. The active backup location is a sibling `backups` directory beside
  `FinLedge Data`, which can make older `FinLedge Data\backups` contents appear missing when
  Settings opens the active path. Startup workbook-schema migrations now use the same shared
  backup resolver instead of creating a second nested backup tree.
- **Import audit fields:** Imported Bank, Share, Personal Expenses, and Bank/Cash Transfer
  rows preserve timestamps present in the source file. Older `Timestamp`/`Created At` headers
  map to `Created Timestamp`; missing timestamps are filled from the source's other audit time
  when available, otherwise from import time. Imported rows record `desktop` as updated device.
- **Transfer requirements:** Settings now labels the minimum transfer columns as `Date`,
  `Transfer Direction`, and `Amount`. Validation accepts both `Transfer Direction` and the
  workbook's canonical `Direction` header.
- **Test update notices:** Test packages now read a local policy file on each check. The
  build-machine copy lives in ignored `desktop/test-update-policy/`; when that path is not
  available, each installed test app uses its own user-data policy folder. Test notice actions
  are previews and do not launch production downloads or installers.
- **Backend ownership:** Desktop builds use distinct local port ranges near 8000 (production
  EXE starts at 8001, Store at 8101, test EXE at 8201, test AppX at 8301, and dev at 8401;
  development Vite uses the corresponding 8051/8151/8251/8351/8451 ranges). They retry
  within their range if a port is occupied, then request an OS-assigned port, and verify the backend using
  a per-launch token before opening the dashboard. The PyInstaller onedir sidecar avoids
  unpacking its full Python payload on each launch. A single-instance
  lock prevents repeated clicks from starting overlapping copies. The splash appears before
  data/backend startup, and backend output is written to the desktop log. Desktop development
  starts its own Vite server on a separate OS-assigned port instead of attaching to an existing
  Vite process. The standalone backend command keeps port 8000. Electron clears background
  update timers and stops backend/Vite process trees on exit; the backend also exits if its
  Electron parent disappears.
- **Data path:** Desktop development defaults to `%APPDATA%\Finledge Development\FinLedge Data`
  on Windows, unless `FINLEDGE_DATA_DIR` explicitly overrides it. Test and production data
  roots are separate from that path.
- **Verification:** Python and JavaScript syntax checks, isolated timestamp/port/policy checks,
  and the frontend build were run. No real user data folders were read or changed. A clean
  AppX install/upgrade and installed EXE behavior still require manual testing on Windows.
- **Docs touched:** `docs/desktop-tasks.md`, `docs/desktop-codebase.md`.

### 2026-10-25 — Settings import isolation and dedicated data folder

- **Import safety:** Bank Services imports now reject recognizable Personal Expenses
  and Share Portfolio workbooks. Bank Flow/Cash Flow imports require the Personal
  Expenses Direction column and reject files whose embedded Flow Type belongs to the
  other flow. A failed existing-data check now stops the import instead of continuing
  with a possible replace. The confirmation clarifies that its data check covers all
  dates, and a successful import moves the matching dashboard to All Time for that visit.
- **Transfers:** Added Personal Expenses Bank/Cash Transfers to Settings import/export
  and export-all. Transfer imports validate direction and map rows into the dedicated
  transfer workbook with generated references where needed.
- **Data folder:** Default development, test, and packaged locations now use a
  `FinLedge Data` child folder. On first launch, recognized workbook files and backups
  are copied there only after timestamped copies are created under
  `backups/migration/YYYY-MM-DD - hh-mm-ss AM-or-PM - Data Folder Migration`. Source files
  are never deleted. Legacy `bank.xlsx`/`share.xlsx` files are copied to their current
  canonical filenames. Explicit `FINLEDGE_DATA_DIR` and saved custom locations remain
  untouched. Settings' existing folder-open action opens the active child folder.
- **Backup names:** New migration, import, corruption, and automatic snapshot names use
  `YYYY-MM-DD - hh-mm-ss ...` formatting. Recovery and retention scan by workbook and
  file metadata, so old compact timestamp names remain usable; existing backups were
  not renamed or removed.
- **Dashboard import fix:** The Personal Expenses import target had been writing into a
  generic `Personal Finance` sheet while the dashboards read `Bank Flow` or `Cash Flow`.
  Settings now uses each flow's actual sheet name. On read/check/merge, existing rows in
  the former sheet are backed up and copied into the correct sheet with duplicate checks;
  the original sheet stays intact. Import success/error notices are short and no longer
  expose full filesystem paths.
- **Docs touched:** `docs/desktop-tasks.md` (this log), `docs/desktop-codebase.md`.

### 2026-10-24 — AppX packaging and launch UX audit

- **Root cause:** Windows App Installer owns the install/update progress screen and its
  post-install action. Electron has only a short “Starting up…” splash; the React
  `UpdateNotice` and manual updater controls were a separate policy-update path. There
  was no app code that reinstalled or relaunched AppX. The AppX update path is now
  disabled at startup, IPC, preload/UI, and notice levels.
- **Manifest and metadata:** Confirmed AppX manifest configuration provides the package
  identity, `Windows.FullTrustApplication` entry point, packaged executable, Start menu
  visual assets, publisher display name, and version mapping. Kept the production Store
  identity and publisher unchanged and the local `.Testing` package identity separate.
  Changed the visual background to transparent and aligned executable product metadata
  to `FinLedge`; the existing NSIS artifact filename pattern remains unchanged.
- **Shortcut and icon:** The in-app prompt checks for the desktop link before asking,
  records “Not now” for the current package version, and asks again only when an update
  changes that version and no link exists. Links use Windows `shell:AppsFolder` identity
  activation; the ICO cache lives in the writable user-data directory. BrowserWindow now
  uses the ICO, and the splash logo no longer draws a rounded square/shadow.
- **Data and startup:** Existing data preparation is idempotent, the workbook marker
  prevents repeated fresh-workbook creation, and data files remain outside the package.
  Shortcut prompting waits for backend health. Package updates remain Windows-managed.
- **Verification:** Desktop data tests passed (9/9); frontend production build passed;
  config JSON and JS syntax checks passed. NSIS x64 installer build passed in a
  temporary output folder; its FinLedge product/version metadata was inspected. A
  clean AppX install, second launch, data upgrade, Start menu/shortcut behavior, and
  packaged sidecar shutdown need an actual signed install smoke test. The test
  certificate is not configured in this session.
- **Docs touched:** `desktop/services/desktopShortcutManager.js`, `desktop/main.js`,
  `desktop/services/windowManager.js`, `desktop/package.json`,
  `desktop/appx-package-config.json`, `desktop/preload.js`,
  `desktop/ipc/updateHandlers.js`, `frontendwebapp/src/components/UpdateNotice.jsx`,
  `frontendwebapp/src/pages/settings/VersionSettingsSection.jsx`,
  `docs/desktop-appx-testing.md`, `docs/desktop-appx-audit.md`,
  `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-23 — Desktop main-process modularization and ignored test folders

- **What changed:** Reduced `desktop/main.js` from a monolithic file to an Electron composition root. Moved runtime configuration, data-directory lifecycle, child-process management, icon fallback generation, window creation, update-policy behavior, and data/update IPC handlers into focused desktop modules. The behavior is composed through small service factories and IPC registration functions.
- **Test ignore policy:** Restored the repository's broad `tests/` ignore behavior by removing the `!` exceptions for backend and desktop test directories. Existing local test files were left untouched and remain ignored, consistent with the user's policy.
- **Other files:** Split Personal Expenses transfer workbook operations and row shaping into `backend/services/personal_finance_transfers.py`, while preserving route-facing functions. Moved pure Share Portfolio totals into `backend/services/share_summary.py`; FIFO lot logic already lives in `share_lot_calculations.py`. The remaining larger share service stays cohesive around its single workbook and mutation lock. Shared renderer/mobile files were not refactored.
- **Verification:** JavaScript syntax and JSON configuration checks passed. Full application and test-suite execution was not performed.
- **Docs touched:** `docs/desktop-tasks.md`, `docs/desktop-codebase.md`.

### 2026-10-23 — Phase 4 AppX packaging

- **What changed:** Added Electron Builder's `appx` target alongside the existing NSIS installer. Installed Electron Builder is 26.15.3 and supports `appx` but not a native `msix` target, so the generated Store-family artifact has the `.appx` extension. Added `desktop/appx-package-config.json` with visibly marked identity placeholders; no publisher identity was invented.
- **Version and assets:** AppX uses the four-part version with revision `0` (`1.3.0` → `1.3.0.0`). Version sync reports this mapping and version verification checks the `setBuildNumber: false` setting. Added a Windows PowerShell generator for the required Store logo sizes from `desktop/assets/finledge_icon.png`; builder resources keep these outside the app payload. The manifest declares only `runFullTrust`.
- **Sidecar and local package:** Backend workbook/report writes resolve through `FINLEDGE_DATA_DIR` into the app's selected data folder; exports use the OS temporary directory. Added root command `npm run desktop-build:msix:test`, which requires `FINLEDGE_TEST_CERT_PATH` (and optional `FINLEDGE_TEST_CERT_PASSWORD`) and refuses unfilled identity placeholders. Its test-only package marker directs data to `%LOCALAPPDATA%\Finledge AppX Test` and disables legacy migration. Usage is in `docs/desktop-appx-testing.md`.
- **Verification limits at the 2026-10-23 checkpoint:** At that point the identity and certificate were not configured, so no installable package had been built. The identity was configured later; see the 2026-10-24 signing-failure follow-up below.
- **Docs touched:** `docs/desktop-tasks.md`, `docs/desktop-codebase.md`, `docs/desktop-appx-testing.md`.

### 2026-10-23 — Phase 3 shared data folder

- Set packaged Windows builds to `%USERPROFILE%\Documents\FinLedge`; `FINLEDGE_DATA_DIR` remains an override.
- Added a pre-backend one-time workbook copy/validation report. It leaves legacy files intact, skips non-empty destinations, and does not overwrite existing workbooks. It also copies and validates backup history.
- Added a write check and Settings folder picker, plus a cross-build heartbeat lock and build-type display.
- Added Python migration tests and Node resolver/lock tests. Full backend suite passed (87 tests); desktop data tests passed (3 tests). The Windows installer build completed.
- Docs touched: `docs/desktop-tasks.md`, `docs/desktop-codebase.md`.

### 2026-10-26 — AppX test build and backend startup/shutdown check

- **Build output:** The combined test build now uses a unique temporary directory
  under ignored `desktop/build/` and copies only the finished AppX, NSIS installer,
  and blockmap files into the existing `desktop/dist/`. This avoids editing the
  previously locked `desktop/dist/win-unpacked/Finledge-Testing.exe` and keeps one
  standard artifact folder. AppX test revisions 21, 22, and 24 were produced; the
  build hit intermittent Windows locks during Electron extraction/resource editing
  on earlier attempts.
- **Startup failures found during install testing:** The packaged backend could not
  import a stale `_noon_timestamp` name from the workbook import module. After that
  was removed, a second failure surfaced: Windows `os.kill(pid, 0)` returned
  `WinError 87` for a live Electron process, so the backend watchdog exited the
  sidecar with code 0. The watcher now checks its owner with Windows process wait
  handles and retains `os.kill` for non-Windows platforms.
- **Tested install:** Installed AppX revision 24 as an in-place update to the
  separate `SachinAdhikari.Finledge.Testing` identity; Windows reported version
  `1.3.0.24`, status `Ok`. The app reached the renderer, the sidecar served its
  `/health` endpoint on OS-assigned port `57487`, the per-launch token matched, and
  data migration reported `not-needed`. Test package data was preserved.
- **Shutdown check:** Force-stopped only the test Electron parent process. The
  sidecar exited and port `57487` was released. The app used a dynamically assigned
  port because its preferred test port was occupied; it did not use port 8000.
- **Update policy files:** The JSON in `desktop/services/` is a shared starter
  template and should be tracked. The build-machine override in
  `desktop/test-update-policy/` is local and ignored. Added a narrow ignore
  exception so the broad `test-*` rule no longer hides the starter template.
- **Icon investigation:** The desktop AppX shortcut targets `explorer.exe` with the
  AppX AUMID, which is how Windows activates the package; its shortcut icon is the
  FinLedge icon. Repository code does not change the Windows Explorer executable
  or its registry icon. The reported Task Manager/File Explorer icon appearance
  could not be visually inspected in this run.
- **Verification:** Frontend production build and Python syntax compilation passed;
  combined NSIS/AppX test build succeeded; AppX install/update and backend start,
  health, and forced-parent shutdown were verified. A visual UI review of the
  Explorer icon and an NSIS install/launch were not completed.
- Docs touched: `docs/desktop-tasks.md`, `docs/desktop-codebase.md`.

### 2026-10-25 — Shared data migration and Store update handoff

- **Data location:** Default EXE and production AppX now resolve to
  `Documents/FinLedge/FinLedge Data`; the backup folder is its sibling at
  `Documents/FinLedge/backups`. Development and testing remain in their own
  per-user roots, with their backup folder beside their `FinLedge Data` child.
- **Migration safety:** Backend startup now validates expected FinLedge columns,
  stores a timestamped migration backup before changing or removing legacy
  workbooks, merges nonduplicate rows when both locations contain data, restores
  damaged workbooks from valid backups, validates the final copy, and writes a
  migration report. Legacy source files are retained if any backup or validation
  step fails. Existing backup history is copied to the sibling backup folder when
  it was stored inside a legacy data folder.
- **Updates:** Store AppX checks `appxLatestVersion` in the remote desktop policy
  and opens Microsoft Store for installation; the configured GitHub fallback is
  used if the Store link cannot open. `exeStoreMigration.enabled` is false by
  default and can later offer EXE users a Store listing while allowing them to
  dismiss and continue using EXE.
- **Platform boundary:** Microsoft Store owns AppX package download, installation
  progress, and relaunch. This implementation does not fake an in-app installer
  progress bar or bypass the Store.
- **Verification:** Python syntax, Electron JavaScript syntax, policy JSON, and
  whitespace checks passed. Two isolated migration scenarios passed inside a
  temporary workspace directory: merge distinct source rows, then recover a
  corrupt legacy workbook from its backup. Full signed AppX install/update and
  NSIS upgrade behavior still require Windows package smoke testing.

### 2026-10-24 — Initialize fresh-install workbooks

- **What changed:** Data-folder preparation now initializes missing Bank, Share,
  Personal Expenses Bank/Cash, and transfer workbooks after non-destructive legacy
  migration. Each owning service creates its workbook using its canonical schema,
  so fresh test and production installs have inspectable files before the UI is used.
- **AppX install behavior:** Windows owns the AppX/App Installer update screen. After
  an update succeeds, its action may return as “Reinstall”; the AppX package cannot
  use the custom directory and shortcut wizard provided by the NSIS `.exe`. AppX
  package files live in Windows-managed storage; FinLedge's data folder is separate.
- **Docs touched:** `backend/services/workbook_initialization.py`,
  `backend/engine_main.py`, `docs/desktop-codebase.md`, `docs/desktop-tasks.md`,
  `docs/desktop-appx-testing.md`.

### 2026-10-24 — AppX signing failure diagnosis and repair

- **Root cause:** Electron Builder 26.15.3 selected its default legacy `winCodeSign-2.6.0` SignTool (10.0.17763.1). It reproduced `A required function is not present` while signing a disposable copy of the valid package, both with and without timestamping. The same publisher-matching certificate from the Windows certificate store failed with the legacy tool and succeeded with the newer tool, isolating the failure to the old toolset. The PFX password was not used in this reproduction.
- **Fix:** Pin `build.toolsets.winCodeSign` to `1.1.0`, which selects Electron Builder's checksum-pinned Windows Kits 10.0.26100 bundle. No signing was disabled and the AppX identity, NSIS target, and production/test marker behavior were retained.
- **Verification:** The bundled 10.0.26100 SignTool signed and verified a disposable AppX copy with the test publisher certificate, both with and without a DigiCert timestamp. Electron Builder's AppX target then produced a signed package in a separate validation output folder; SignTool verification passed, MakeAppx extraction succeeded, and `Add-AppxPackage` installed it with status `Ok` and the expected package family name. The embedded marker pointed to `%LOCALAPPDATA%\Finledge AppX Test` and disabled legacy migration. A separate NSIS target build also completed and its installer signature verified. The original unsigned artifact in `desktop/dist/Finledge-1.3.0.appx` was not overwritten.
- **Security:** The verification used the test certificate's store thumbprint instead of a PFX password argument. Electron Builder's `builder-util` redacts password-style signing arguments in its logs (`removePassword`). No password was printed.
- **Limit:** The full `npm run desktop-build:msix:test` wrapper (frontend + sidecar rebuild + AppX target) was not rerun; the Electron Builder AppX packaging/signing stage and NSIS target were verified separately against the existing packaged app. Launching the installed app and Store certification/submission remain unverified.
- **Docs touched:** `desktop/package.json`, `docs/desktop-appx-testing.md`, `docs/desktop-tasks.md`.

### 2026-10-24 — Isolated AppX test identity

- **What changed:** The local test AppX uses the distinct `Finledge-Testing` display/artifact name and `SachinAdhikari.Finledge.Testing` package identity. Its new output folder is `desktop/artifacts/testing/appx/`.
- **Test data:** AppX test packages now use a distinct Electron user-data directory and attempt a validated copy from the prior AppX test-data folder, without reading production data. The first launch creates the destination before starting the sidecar.
- **Verification:** The earlier package under `desktop/dist-testing/` has the expected test manifest identity and embedded marker. The runtime path fix still requires a rebuild and installed-app smoke test.
- **Docs touched:** `scripts/finledge.mjs`, `desktop/scripts/mark-test-build.js`, `desktop/services/dataDirectory.js`, `desktop/services/dataDirectoryRuntime.js`, `desktop/services/runtimeConfig.js`, `desktop/main.js`, `desktop/ipc/dataHandlers.js`, `desktop/services/windowManager.js`, `desktop/package.json`, `package.json`, `.gitignore`, `.github/workflows/desktop-release.yml`, `docs/desktop-appx-testing.md`, `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-24 — Isolated development and installer test builds

- **What changed:** Added `npm run desktop-build:exe:test`, which makes a separately identified NSIS test installer, writes to `desktop/artifacts/testing/exe/`, and embeds a test marker so runtime mode, Settings label, window title, and data location identify it as Testing. `npm run desktop-dev` remains Development; production installer and Store data keep their existing shared production folder.
- **Build organization:** New production builds go to `desktop/artifacts/production/`; AppX and EXE test builds go to their own folders under `desktop/artifacts/testing/`. Existing `desktop/dist*` outputs were preserved. These and generated AppX logo assets are ignored by Git.
- **AppX startup audit:** The unavailable path in the report exactly matched the former hard-coded AppX test-data path. Packaged Windows apps can redirect AppData writes into package-specific storage, so a host-visible path can differ from the app's logical path. Test builds now use Electron's app-specific `userData` path, whose parent app name is set before path resolution. The former test folder is included only as a legacy test migration source. The Settings folder-open action now reports shell errors instead of claiming success. The visible wizard is Windows' native package UI; the only custom Electron startup UI is a short “Starting up…” splash, with no fake install progress.
- **Distribution labels:** Packaged test markers take precedence and display Testing; unpackaged/local development displays Development; a Store-targeted channel marker together with Electron's packaged-AppX signal identifies Microsoft Store; other AppX packages display AppX Package and other packaged builds display Installer. Test mode is passed to the sidecar as `FINLEDGE_MODE=testing`; test and Store-targeted builds skip update checks.
- **Verification:** Desktop data/runtime tests passed (7/7), the frontend production bundle completed, and PyInstaller produced the sidecar. The sidecar `--prepare-data` smoke check created a new isolated temporary folder and returned `new_install`; that temporary data was removed afterward. The NSIS test package was built successfully with a distinct output path and embedded `exe` marker. The unsigned test installer reports `NotSigned`, which is expected for this local test command. A fresh signed AppX build/install/launch was not possible because the test PFX is absent and `FINLEDGE_TEST_CERT_PATH` is unset. The incomplete `desktop/dist-appx-validation/` folder remains because Windows reports its lone `app.asar` is locked; no other existing build outputs were deleted.
- **Docs touched:** `scripts/finledge.mjs`, `desktop/main.js`, `desktop/services/dataDirectory.js`, `desktop/services/dataDirectoryRuntime.js`, `desktop/services/runtimeConfig.js`, `desktop/services/windowManager.js`, `desktop/ipc/dataHandlers.js`, `desktop/scripts/mark-test-build.js`, `desktop/package.json`, `package.json`, `.gitignore`, `.github/workflows/desktop-release.yml`, `docs/desktop-appx-testing.md`, `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-24 — Combined Windows test build and release-path correction

- Replaced the separate AppX and EXE test commands with `npm run desktop-build:test`. It builds the frontend and sidecar once, then builds both NSIS and AppX in one Electron Builder invocation.
- Restored the standard Electron Builder output to `desktop/dist/` for both production and test builds. The production build and GitHub release workflow use that same directory; the release build clears and rebuilds it and selects only `Finledge-Setup-*` production packages. Test outputs use Testing names/identities and are never published by the test command.
- The test AppX uses the `.Testing` package identity; the test EXE uses a distinct application ID. Both are marked Testing and use separate app-specific data folders. Runtime package type distinguishes the AppX test from the EXE test. Production data remains unchanged.
- Certificate lookup now accepts `FINLEDGE_TEST_CERT_PATH` and its optional password from either the PowerShell environment or root `.env`. The current shell has no test certificate configured, so the combined signed build cannot run until that setting is available.
- Kept historical `desktop/dist-*` and `desktop/artifacts/` outputs untouched and Git-ignored; new builds do not create separate output folders. Updated the release workflow and desktop-only build documentation. No mobile-owned files were edited.
- Verification: `npm run desktop:test-data` passed (8/8); syntax and whitespace checks passed. A new signed combined package run and interactive install/launch remain unverified because the test signing certificate is not configured in this shell.
- Docs touched: `desktop/package.json`, `desktop/services/runtimeConfig.js`, `desktop/scripts/mark-build-channel.js`, `scripts/finledge.mjs`, `package.json`, `.github/workflows/desktop-release.yml`, desktop runtime tests, `docs/desktop-appx-testing.md`, `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-23 — Legacy `.exe` migration and Settings structure

- Confirmed the previous packaged `.exe` data location is included in the legacy source scan (`app.getPath("userData")`, normally `%APPDATA%\Finledge`). On first launch after an update, those workbooks and backups are copied to Documents; later `.exe` updates use the shared folder. MSIX uses that same folder, so an existing MSIX dataset is discovered directly.
- The startup report distinguishes migrated data, data already present, and a new setup. The new-setup status remains in the backend report but is no longer shown as a notice in General Settings.
- Split the oversized Settings page into purpose-specific section components under `frontendwebapp/src/pages/settings/`; the page now handles navigation and shared state. Reviewed the remaining largest renderer files; dashboard views already use shared chart, filter, and stat components, so no further structural changes were needed here.
- Split the large Settings import/export service into data configuration, normalization, workbook import, and workbook export modules. `settings_service.py` remains a compatibility facade for existing routes.
- Verification: all 87 backend tests passed, the frontend production build passed, and the Windows installer rebuilt with the final files. The production bundle reports the existing large-chunk advisory.
- Docs touched: `docs/desktop-tasks.md`, `docs/desktop-codebase.md`.

### 2026-10-23 — Separate development data folder

- Development Electron now stores active workbooks under `%APPDATA%\Finledge Development`.
  Existing `.finledge-dev-data` workbooks are copied there on first startup. Packaged
  production remains in Documents\FinLedge and reads legacy data from `%APPDATA%\Finledge`.
- The npm-based production-path test command remains deferred until the installer package
  target is available, as requested.
- Verification: `node --check desktop/main.js` passed. No real data folders were read or changed.
- Docs touched: `docs/desktop-tasks.md`, `docs/desktop-codebase.md`.

### 2026-10-23 — Keep app available when migration fails

- The Electron log showed migration stopped on an invalid legacy workbook (`File is not a zip
  file`), which prevented the backend from starting. Default startup now falls back to the
  previous development or packaged data folder after a migration error, and Settings reports
  that fallback. Explicit `FINLEDGE_DATA_DIR` paths and folders selected in Settings do not
  auto-fallback.
- Verification: JavaScript syntax and scoped whitespace checks passed. The user's workbook
  files were not modified.
- Docs touched: `docs/desktop-tasks.md`, `docs/desktop-codebase.md`.

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

### 2026-10-28 — Desktop workbook migration recovery

- Fixed migration selection so a valid but empty destination is backed up before a
  verified legacy workbook replaces it. Legacy data sheets are mapped by normalized
  header names into canonical module sheets; `Timestamp`, missing last-updated time,
  and missing device values are handled during merge. Duplicate detection uses
  business columns while ignoring derived values and audit metadata.
- Added physical AppX `LocalCache\Roaming` discovery for production package folders,
  excluding Testing packages, alongside legacy AppData and Documents locations.
  Electron now writes the migration report to its startup log.
- Added a path/size/mtime source fingerprint. Completed migrations return early when
  the fingerprint is unchanged and all five destination workbooks exist. Recovery
  searches backups only when a source or destination workbook exists and is damaged;
  legacy workbooks remain untouched.
- Verification: `pytest backend/tests/` — 92 passed. The first run printed the
  success summary but needed interruption during shutdown; the clean rerun exited
  successfully. `node --test desktop/tests/dataDirectory.test.cjs` passed all 7 tests.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-30 — Separate client workbooks and synchronize safely

- Testing/production EXE and AppX now resolve their own active workbook directories;
  each Settings path, dashboard API and import/export uses that exact client path. Both
  clients synchronize through a channel-specific Roaming folder (`Finledge Testing EXE`
  or `Finledge`) containing shared workbooks, backups, an identity map, and a journal.
- Legacy root migration now verifies each workbook backup by hash, sheet structure and
  record content. After migration, background metadata backfill, shared sync and a
  second destination/Row ID/hash check succeed, a durable cleanup manifest permits
  removal of only migrated root-level workbook files. Cleanup resumes after crashes;
  unrelated files and any source involved in a failure remain in place.
- Legacy metadata upgrades run per workbook in a daemon after the API starts, with a
  verified backup, staged write, validation, service lock and optimistic fingerprint
  check before atomic replacement. Valid IDs/timestamps/device labels are retained;
  old duplicate rows get distinct UUID5 IDs from canonical workbook/sheet, normalized
  business values, Created Timestamp and a shared duplicate ordinal. Exact duplicate
  rows have no original distinguishing information, so their ID-to-physical-row
  pairing cannot be inferred, although the IDs remain unique and consistent between
  clients.
- Added isolated tests for backup/copy/validation failures, interrupted migration and
  cleanup, repeated migration, duplicate legacy records, concurrent client sync,
  conflict resolution, journal idempotence, locked workbooks, failed atomic commits,
  and simultaneous user edits.
- Verification: `pytest backend/tests/` — 151 passed. The workspace venv launcher
  points at an unavailable base-Python location, so the run used the available Python
  3.13 runtime with the workspace venv's packages and a fresh pytest-managed temp root.
  `node --test desktop/tests/dataDirectory.test.cjs` — 23 passed;
  `npm test --prefix frontendwebapp` passed; `npm run build --prefix frontendwebapp`
  passed. Signed EXE/MSIX installation and live packaged shared-folder behavior were
  not verified. No real user data directories were accessed.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Align AppX workbook targets and isolate client launch locks

- Compared the workbook opened by AppX Settings with its live dashboard. The displayed
  Roaming path contained one bank row, while the dashboard returned 34; those 34 rows
  match the package-effective LocalCache workbook. AppX Settings now resolves the
  displayed and opened locations to the same package-effective workbook.
- The EXE launch was being rejected by Electron's shared single-instance guard while
  AppX was running. Added a client-local lock file under each client's Electron
  user-data folder so EXE and AppX can run together while duplicate launches of the
  same client remain blocked.
- Added desktop tests for AppX Settings/open-path resolution and per-client lock
  behavior. Packaged re-verification and final test results are pending.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Bank/Cash transfer import and validation

- Added a shared JSON definition for canonical transfer directions, aliases, and
  origin/destination flows. Backend services and import mapping plus the renderer's
  `options.js` and transfer UI consume the same rules.
- Transfer imports now accept valid values from `Direction` or `Flow Type`, reject
  share workbooks, report the invalid-direction row count, and save canonical rows.
  Imports replay dated income and transfer events and reject an overdraft with the
  side's available amount. Create/update validation now runs under the same
  reentrant Personal Expenses lock as the workbook write; update checks the selected
  origin after excluding the edited transfer.
- Added the transfer workbook location to Settings and Electron's open-file map.
  The sidecar build includes the shared JSON rules.
- Verification: focused transfer tests passed (15); frontend production build passed.
  Edge rendered the transfer selector and Settings row in Playwright snapshots; the
  screenshot command timed out. `pytest backend/tests/` — 107 passed. A packaged
  sidecar build was not run.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Desktop data safety and import visibility

- Changed Personal Expenses flow moves to validate and save the destination row
  before deleting the source row. Both workbook writes take a pre-write snapshot
  inside the same lock. Transfer workbook initialization now copies legacy rows from
  the old generic sheet to `Transfer Flow` while preserving the old sheet.
- Added the `app:get-backend-port` IPC getter. Preload resolves the selected port on
  first use, caches it, and the renderer awaits the resulting API base URL.
- Changed day/month grouping keys to local date parts and taught date-only ISO values
  to remain calendar dates in negative-offset time zones. Removed the frontend ignore
  rule hiding its npm smoke-test script, and limited request-payload logs to DEV.
- Settings now navigates to the matching dashboard after a successful import and
  selects the all-dates range. Settings and migration notices are path-free; explicit
  file-location fields remain available in General Settings.
- Verification: `pytest backend/tests/` — 110 passed; `npm run build --prefix
  frontendwebapp` passed; `npm test --prefix frontendwebapp` passed; 12 desktop
  Node tests passed. The local Playwright CLI did not return a rendered snapshot, so
  rendered UI verification was not completed.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Faster desktop startup

- Confirmed no renderer route calls the deprecated `/summary/graphs/*` paths and
  that Matplotlib is imported only inside the unused PNG renderer. Added PyInstaller
  exclusions for matplotlib, numpy, PIL, and tkinter.
- Removed Electron's blocking `spawnSync --prepare-data`. The single backend sidecar
  now prepares/migrates data before `uvicorn.run`; `--prepare-data` remains available
  for test use. Legacy-folder fallback is retained for a preparation failure.
- Backend readiness now polls every 100ms with a 300ms request timeout. The renderer
  opens as soon as the backend port is selected, shows a short connecting screen until
  `/health` responds, and lazily loads dashboards, Summary, and Settings.
- Added a versioned, atomic migration marker with workbook stat fingerprints so
  unchanged migration inputs skip workbook opens. Added timestamped launch, data-ready,
  backend-spawn, health-ok, and first-paint log phases.
- Verification: `pytest backend/tests/` — 119 passed; `npm run desktop:test-data`
  — 12 passed; `npm run build --prefix frontendwebapp` passed. JavaScript syntax
  checks and `git diff --check` passed. Real startup timing requires a packaged
  install and was not verified.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Behavior-preserving desktop refactor checkpoints

- Consolidated workbook creation, row reading, and locked snapshot/save/close flows
  in `excel_utils`; centralized workbook header aliases and name-based row mapping
  across imports and migrations.
- Routed Share Portfolio recalculation through shared FIFO/SIP lot helpers and
  centralized day/month graph bucket aggregation. Marked the unused summary graph
  routes deprecated in OpenAPI while keeping their URLs and runtime behavior.
- Derived backend category metadata from request-model enums and added
  `/meta/categories`; the renderer refreshes its existing option arrays from that
  endpoint at startup. Reused the existing device and transfer direction helpers.
- Extracted share add/update payload construction, Personal Finance labels and
  transfer receiver expansion, and Bank/Share/Personal Finance summary functions.
- Added shared delete confirmation state/dialog wiring and form amount/description
  reset helpers. Replaced duplicate Electron readiness loops with `pollUntil`.
- Verification after each item: `pytest backend/tests/` — 117 passes for items 1–6,
  then 118 passes for items 7–13; `npm run build --prefix frontendwebapp` passed at
  every checkpoint. Final desktop Node tests: 12 passed. Rendered UI verification
  was not performed.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Automatic workbook merge identity and conflict handling

- Added immutable row IDs, business-only SHA-1 hashes, and normalized client labels
  to Bank, Share Portfolio, Personal Expenses, and transfer rows. Existing rows
  receive deterministic IDs during backup-and-replace schema migration.
- Added shared ID-based merge rules for startup migration and Settings import:
  unchanged rows are skipped, newer conflicting edits win with the losing values
  archived, and newer tombstones prevent deleted rows from returning.
- Added `Deleted` and `Conflicts` sheets, tombstones for service delete paths,
  derived-value recalculation after merges, and merge counts in Settings results.
  The dashboard displays the import summary after navigation.
- Added `tmp_path` tests for client copies, conflict resolution, tombstones,
  timestamp-independent hashes, stable legacy IDs, and untouched input files.
- Verification: `pytest backend/tests/` — 117 passed; focused merge tests — 7 passed;
  `npm run build --prefix frontendwebapp` passed. Rendered UI behavior and packaged
  multi-client synchronization were not verified.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Consistent desktop roaming data path and notices

- Testing EXE and AppX builds now resolve to the same `Finledge Testing/FinLedge Data`
  folder beneath the Testing AppX package's LocalCache roaming root when installed.
  The EXE finds that package root; when unavailable, both use a common roaming fallback.
- Migration discovery includes prior Testing AppX package folders and the older
  `Finledge Testing AppX Test` location. Settings now reports resolved AppX filesystem
  paths that match the path opened by its folder buttons.
- Desktop notices again auto-dismiss after five seconds and include a close button.
  Desktop custom-range popovers stay within the visible window, and desktop hover
  text has sufficient contrast; these UI style changes are gated from mobile.
- Verification: `npm run desktop:test-data` — 13 passed; `npm test --prefix
  frontendwebapp` passed; `npm run build --prefix frontendwebapp` passed; JS syntax
  checks and `git diff --check` passed. The backend suite stalled in the sandbox
  before completion; no backend files changed. A browser screenshot could not run
  because the configured Chromium executable is missing. Actual packaged AppX/EXE
  path behavior remains unverified on an installed build.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Centralized desktop paths and public release configuration

- Added Windows environment-token expansion for `FINLEDGE_DATA_DIR`. `auto` uses
  the build's managed location, and Electron passes its resolved path to both
  Settings and the Python backend so they address the same folder.
- Aligned standalone desktop backend development data with the repository's
  `.finledge-dev-data` folder and production defaults with the shared Documents
  location. Documented that `%APPDATA%` may be AppX-redirected and recommended
  `%USERPROFILE%/Documents/...` for custom EXE/AppX sharing.
- Removed repeated release/update URL literals from desktop runtime and renderer
  code. Release URLs now derive from the desktop package repository metadata, with
  public `.env` overrides `VITE_FINLEDGE_RELEASES_URL` and
  `FINLEDGE_UPDATE_POLICY_URL`.
- Added tests for path token expansion, shared runtime resolution, release URL
  overrides, and update URL configuration.
- Verification: desktop Node tests — 19 passed; focused `test_path_utils.py` — 2
  passed; frontend smoke test and production build passed. The full backend suite
  stalled in the sandbox when Starlette's `TestClient` tried to create a Windows
  asyncio socket pair; the unsandboxed retry was interrupted before it ran.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Unified data and public repository configuration

- Kept Electron's resolved data directory authoritative for the desktop lifecycle:
  Settings reports/opens the runtime path, folder selection restarts the backend
  against the selected path, and Electron passes the absolute directory to Python.
  Workbook services, initialization, migration, imports/exports, and desktop backups
  derive from that root. Testing-package migration discovery remains isolated.
- Added shared `repositoryConfig.js` resolution for public GitHub owner/repository
  settings, releases links, and policy URL defaults. Vite emits the resolved public
  settings into a generated config file copied into packaged resources, so packaged
  Electron does not depend on an unbundled root `.env`. Version sync derives tagged
  and latest policy destinations from package metadata. Electron Builder also derives
  its GitHub publisher coordinates from the single `repository.url` field.
- Removed 17 repeated assignments from the ignored local `.env`; each duplicate had
  the same value, so the first occurrence was retained. Kept the local project-wide
  release and signing entries. Added blank GitHub/AppX build credential entries to
  `.env.example`; no secret values are included. The local-only `release` name has no
  matching project code reference, and `FINLEDGE_TEST_CERT_PASSWORD` remains an
  optional example entry unless the local certificate needs it.
- Fixed legacy workbook discovery to check each supplied folder and its `FinLedge Data`
  child. This picks up `%APPDATA%\\Finledge Testing EXE\\FinLedge Data` and covers
  nested legacy folders among production migration candidates.
- Settings imports now stay on the current page and show the import result there.
  Custom-range panels keep a 20px viewport margin and close on outside click or Escape.
- History tables now sort newest-first by transaction date, creation time, and last
  update time rather than reversing workbook row order. About and How To Use keep their
  headings fixed while their panel content scrolls independently.
- Added desktop tests for one-root service writes and initialization, Settings display,
  open and folder-selection IPC, invalid path tokens, release URL safety, package
  defaults/overrides, packaged config without `.env`, and the nested Testing EXE path.
- Verification: `npm run desktop:test-data` — 25 passed; focused
  `pytest backend/tests/test_path_utils.py` — 4 passed; focused migration tests —
  12 passed; frontend production build emitted the packaged config and
  final `npm run build --prefix frontendwebapp` and `npm test --prefix frontendwebapp`
  passed, including the new history ordering smoke check. Full
  `pytest backend/tests/` stalled at `test_bank.py` when Starlette's TestClient tried
  to create a Windows asyncio socket pair; faulthandler confirmed the wait inside
  socket accept, so the sandbox run was interrupted. Installed EXE/AppX execution
  remains unverified.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-environment.md`,
  `docs/desktop-tasks.md`.

### 2026-10-29 — Preflight packaged migration snapshot folders

- A real Testing AppX launch (revision 36) selected the expected Roaming workbook
  folder but exited during migration because the nested `backups/AppX/migration`
  folder was missing when Python attempted to create its timestamped snapshot.
- Electron now creates and checks that nested recovery folder before spawning the
  sidecar. Added a desktop regression assertion for the preflight path. Rebuilt both
  Testing packages as revision 37 for a packaged rerun.
- Production and Testing are not identical build profiles: production defaults and
  migration source discovery are checked in runtime tests with temporary directories;
  the packaged install remains Testing identity and paths. No production install or
  user workbook folder was opened or changed.
- Verification at entry time: `npm run desktop:test-data` — 30 passed; frontend
  production build passed; full backend suite and revision 37 packaged launch are
  pending.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Separate Testing folders from their Documents safety copy

- Testing EXE keeps its active workbooks under `%APPDATA%\\Finledge Testing EXE`;
  Testing AppX keeps its active workbooks under `%APPDATA%\\Finledge Testing AppX`.
  The old AppX package-private LocalCache location remains a migration source.
- Both clients refresh separate `EXE` and `AppX` copies under the shared
  `Documents\\FinLedge Testing\\FinLedge Data` folder. Their automatic snapshots
  are separated under `Documents\\FinLedge Testing\\backups`. Development uses
  its project data folder and a `Development` safety-copy subfolder under the same
  Documents Testing root. Production retains the distinct Documents `FinLedge` root.
- Settings and Open Folder report the active Roaming location without translating it
  into a LocalCache path.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-environment.md`,
  `docs/desktop-tasks.md`.

### 2026-10-29 — Keep Testing AppX workbooks in Roaming

- Removed the Testing AppX active-data override to the package's deep LocalCache
  folder. Testing EXE and AppX now both use `%APPDATA%\\Finledge Testing\\FinLedge Data`;
  the prior AppX LocalCache location remains a migration source.
- Settings and Open Folder now report/open the active Roaming path directly instead
  of rewriting it to a package-private LocalCache path. Production data paths remain
  separated by build as configured.
- Microsoft documents AppData write virtualization for virtualized apps; this package
  declares `runFullTrust`, so the app can use its Roaming path. An installed-package
  check is still needed to confirm the resulting physical path on the user's Windows.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-environment.md`,
  `docs/desktop-tasks.md`.

### 2026-10-29 — Keep Testing clients separate and use Documents for shared safety copies

- Testing EXE active data is `%APPDATA%\\Finledge Testing EXE\\FinLedge Data`;
  Testing AppX active data is `%APPDATA%\\Finledge Testing AppX\\FinLedge Data`.
  These are separate client folders and do not combine each other's ongoing changes.
- `Documents\\FinLedge Testing\\FinLedge Data\\EXE` and `...\\AppX` are the
  shared safety-copy location, with per-client backups under
  `Documents\\FinLedge Testing\\backups`. Development has its own safety copy
  beneath the same Documents Testing root.
- AppX migration still checks its old package-private LocalCache and prior Local
  AppData locations. Those paths are sources only; Settings and Open Folder use the
  active folder under Roaming.
- Verification: `npm run desktop:test-data` covers exact active/safety paths and
  confirms EXE migration does not scan AppX sources. An installed Testing AppX
  launch and its physical Windows paths were not verified.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-environment.md`,
  `docs/desktop-tasks.md`.

### 2026-10-29 — Diagnose AppX startup recovery-folder failure

- The startup log showed the Python sidecar exiting before the API started because
  it could not create `Documents\\FinLedge Testing\\FinLedge Data\\AppX`. Electron
  then retried the same data-preparation failure three times and displayed a generic
  service-connection message.
- Electron now creates and checks the build's safety-copy and backup folders before
  starting Python. If that preflight fails, startup names the Documents access issue
  and exits without attempting the same operation repeatedly. If Python still exits
  with the data-preparation status, Electron stops retrying after the optional
  legacy-folder fallback and reports a data-folder error rather than suggesting a
  connection to another app.
- A missing workbook now initializes header-only without being mislabeled as
  corrupted or restored from an old automatic snapshot. This preserves the rule that
  only a present-but-damaged workbook can recover from an automatic backup.
- Added isolated desktop tests for successful recovery-folder preparation and a
  Documents path that cannot be created. Existing real workbooks were not opened or
  changed during verification.
- Verification: `npm run desktop:test-data` — 27 passed; `pytest backend/tests/`
  — 126 passed; `npm run build --prefix frontendwebapp` passed. An isolated Electron
  development launch created all five empty workbooks in a fresh workspace folder,
  wrote the Documents safety copies there, reached `/health` on the first backend
  attempt, and logged `data ready`, `health ok`, and `first paint`. I clicked through
  Bank Services, its dashboard, Personal Expenses, Transfers, Share Portfolio,
  Financial Summary, and Settings. The installed AppX package was not rebuilt or
  launched because it is configured to use the user's existing workbooks; its
  physical Documents access remains unverified.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Ordered data-folder creation and workbook consolidation

- Startup now creates the applicable shared safety/backup folder before preparing
  the app's own `FinLedge Data` child. If that child is absent and recognized legacy
  workbooks are in its parent, it makes byte-verified copies of all found workbook
  files before allowing the destination child to be created. Migration keeps the
  original files in place and copies validated data into the child.
- Startup initializes missing workbook files through the owning services. A fresh
  install therefore gets all five workbooks with headers and no transaction rows;
  production safety copies are refreshed only after migration and initialization
  succeed. Existing populated workbooks are never replaced from an older safety copy.
- Startup emits the complete folder preparation report as one structured sidecar line;
  Electron parses it into `%TEMP%\\finledge-electron.log` under `[migration]`.
- Development now resolves desktop and Python to the same
  `.finledge-dev-data/FinLedge Data` folder and scans the previous parent for legacy
  workbook files. Testing EXE/AppX keep their existing shared Testing path. Production
  safety copies and snapshots remain under `Documents/FinLedge/FinLedge Data` with
  separate EXE/AppX subfolders.
- Verification: `npm run desktop:test-data` — 25 passed; focused migration/path tests
  — 17 passed, including byte-identical backups and development path resolution. The
  full backend suite reached `test_bank.py` after six backup tests, then hung in the
  known Windows TestClient socket setup and was interrupted. Packaged AppX redirection
  still requires an installed build.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-environment.md`,
  `docs/desktop-tasks.md`.

### 2026-10-29 — Restore logo while desktop connects to backend

- The native Electron startup splash already showed the logo. Restored it on the
  later React connecting screen as well, gated on the desktop bridge so the separate
  mobile/web renderer does not gain desktop branding behavior.
- Verification: frontend production build passed. Static source/build check only;
  the packaged Electron connecting screen was not rendered in this task.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Separate production roaming data with Documents safety copies

- Production EXE now defaults to `%APPDATA%\\Finledge EXE\\FinLedge Data`; production
  AppX uses `%APPDATA%\\Finledge AppX\\FinLedge Data`, which Windows redirects into
  that package's LocalCache roaming folder. Existing Testing paths are unchanged.
- EXE and AppX now use build-specific automatic snapshots and current workbook copies
  under `Documents\\FinLedge\\FinLedge Data`. Workbook writes refresh the matching
  safety copy atomically. On startup, a safety copy can restore only a missing or
  empty workbook; a populated active workbook stays authoritative, avoiding deleted
  rows being restored from an older copy.
- EXE migration scans its previous Roaming locations and the common Documents data
  folder. AppX scans its own package's redirected roaming locations and the common
  Documents folder. The old flat Documents workbook set seeds either build once as
  historical data; after that, the two builds no longer import each other's private
  AppData data or ongoing safety copies.
- Verification: JavaScript/Python syntax checks and `git diff --check` passed;
  automated tests were not run. No packaged EXE/AppX launch or uninstall/reinstall
  cycle was performed. Windows' AppX LocalCache redirection and access to a real
  user's Documents folder remain unverified.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-environment.md`,
  `docs/desktop-tasks.md`.

### 2026-10-29 — Shorten backup and migration snapshot paths

- Migration snapshots now use `YYYY-MM-DD HHMM` folders without the descriptive
  suffix, and preserve workbook names under `src/<index>` and `dest`. Automatic,
  import, and corrupted-workbook snapshots use compact `YYYY-MM-DD HHMMSSffffff`
  timestamps while keeping the original workbook filename.
- Focused snapshot and migration tests passed (24); desktop path tests passed (30),
  and the frontend production build passed. The full backend run collected 130 tests
  but stalled in the Windows test environment and was interrupted; the focused tests
  covering this change passed.
- Testing AppX revision 39 reached the Home/Financial Summary UI and `/health` returned
  200. Its migration logs showed active workbooks under the Testing AppX Roaming
  folder and legacy workbooks retained. Documents safety-copy refresh still logged
  `FileNotFoundError`, so recovery-copy creation was not verified. Testing EXE revision
  39 installed under a fresh QA program folder, but its launch was blocked while the
  AppX instance held the shared single-instance guard; Computer Use also detected
  active user input, so I stopped interacting with that window.
- No production install or production data folder was opened or changed.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Preserve entry writes and align Settings file targets

- When the shared automatic-backup location cannot accept a snapshot, the backend
  now saves the required pre-write snapshot beside the active data folder before
  allowing the workbook mutation. If both locations fail, it still aborts the write.
  Snapshot diagnostics include the configured root and failed path in the log.
- Settings displays and Open actions now use the same resolved per-workbook path map;
  the Electron log records those values for comparison with the backend migration
  destination. Tests verify all five workbook buttons open the exact displayed file.
- Verification: 25 focused backup/migration tests passed; 30 desktop tests passed;
  `git diff --check` passed. The currently installed Testing AppX (revision 39) predates
  these changes. A packaged rerun is still needed to verify the user's reported
  Settings/dashboard mismatch and the shared Documents backup permissions.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-29 — Use one shared workbook folder for EXE and AppX

- Testing EXE and AppX now resolve to the same `Documents/FinLedge Testing/FinLedge Data`
  folder. Production EXE and AppX resolve to the same `Documents/FinLedge/FinLedge Data`
  folder. Backups and safety copies stay beneath that active shared folder, so Settings,
  dashboards, imports, and writes all point at the same five workbooks.
- Both clients scan the former EXE Roaming workbook set and prior AppX package-redirected
  locations. Migration continues to fingerprint sources and merge rows by stable IDs;
  legacy sources are retained. If preparation fails, startup no longer switches the
  dashboard to a different legacy folder.
- Verification: desktop data-directory tests passed. Full backend tests, frontend build,
  and packaged AppX/EXE installation checks are pending for this change. The user will
  install the next AppX after removing their existing Testing AppX; no user data folders
  were opened or changed by this task.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-environment.md`,
  `docs/desktop-tasks.md`.

### 2026-10-30 — Keep EXE, AppX, Settings, and dashboards on the shared workbooks

- Testing EXE and AppX both pass `Documents/FinLedge Testing/FinLedge Data` to the
  backend; production EXE and AppX both pass `Documents/FinLedge/FinLedge Data`.
  Settings file locations are built from that same runtime path, and the dashboard
  reads through the backend using it. AppX migration source discovery includes the
  former Testing EXE `%APPDATA%/Finledge Testing EXE/FinLedge Data` path, so an AppX
  first launch can import those rows into the shared workbook set. Existing source
  fingerprint and row merge behavior prevents re-importing unchanged legacy data.
- The standalone Python fallback now uses the same Testing/production Documents
  locations as Electron, avoiding a second Roaming workbook root when the backend is
  launched without Electron's explicit `FINLEDGE_DATA_DIR`.
- Verification: desktop data-path tests — 22 passed; `pytest backend/tests/` — 132
  passed; frontend production build passed. The backend suite required an outside-
  sandbox run because Windows `TestClient` socketpair creation hangs in the sandbox.
  Packaged EXE/AppX installation, actual package redirection, and real-user Documents
  access were not verified. No real data folders were opened or changed.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-30 — Isolate migration sources and commit sync checkpoints safely

- AppX legacy discovery now selects only package roaming roots for the active build
  channel. Testing EXE/AppX filter production package roots even when a Testing legacy
  override is present; production filters Testing package roots. Development discovery
  behavior remains unchanged.
- Root-level source cleanup now independently validates the byte-identical backup,
  active workbook, and shared synchronization workbook before unlinking each source.
- Per-workbook sync checkpoints are written only after both directions report success
  and their resulting local/shared fingerprints still match. Busy, retry, and missing
  source cases remain eligible for a later retry.
- Verification: `pytest backend/tests/` — 155 passed; desktop path tests — 34 passed;
  frontend smoke test passed; frontend production build passed; `git diff --check`
  passed. No signed package was launched, and no production or Testing data folder was
  accessed.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-30 — Keep AppX backup Settings on the shared channel path

- AppX Settings now resolves the working workbook folder to the package's physical
  LocalCache path while keeping the shared backup path in the channel's Roaming sync
  directory. Open Backup Folder creates and opens the same `Backups/auto` directory
  used by the Python backup and restore service; no package-local shadow is created.
- Added desktop IPC coverage for AppX data/backup path parity and backend coverage for
  snapshot creation plus recovery from the configured shared backup root.
- Verification: backend suite `pytest backend/tests/` passed (156 tests); all four
  desktop Node test files passed (36 tests); frontend production build passed; and
  `git diff --check` passed. One initial Node invocation used a directory path and
  failed to resolve it; the corrected explicit-file invocation passed.
- Packaged Sandbox re-verification remains pending because the available package set
  predates this IPC fix. Existing isolated Sandbox data was not modified.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`.

### 2026-10-31 — Calendar filters, import review, precision, notices, and test clearing

- Desktop dashboard period bounds now use the selected calendar Week/Month/Year and inclusive Custom dates. Share summaries keep period cash flow separate from historical closing positions, and memo dependencies include the selected range.
- Excel import now goes directly from its Import action to one editable/reorderable review page with the Confirm action there. Merge is the safe default; Replace remains explicit. Success stays on Import with an added/updated count. Backend import timing logs cover input read, validation/remapping, live reads, merge, backup, stage write, staged validation, atomic commit/refresh, and total time.
- Bank currency parsing and cumulative totals use Decimal and persist to two currency decimals. Share Charge default values select on focus. Desktop notifications are held in the app shell across route unmounts.
- Added Development/Testing-only module clearing with a strict explicit backend mode guard, user confirmation, per-workbook snapshots, row tombstones, and a SIP-only option. It keeps workbook and worksheet structure.
- Verification: frontend build/smoke passed; focused regressions 14/14; backup/restore 10/10; shared-sync/data-directory 31/31. Weighted-average tests reproduce expected All Time values. Synthetic timings are recorded in `docs/TASKS.md`; no comparable pre-change baseline exists. TestClient API calls hang in Windows local socket-pair setup before app routing. Rendered UI and current EXE/AppX Sandbox install/launch were not verified.
- Docs touched: `docs/desktop-codebase.md`, `docs/desktop-tasks.md`, `docs/TASKS.md`.

### 2026-11-01 — Fix Bank Services dashboard summary type error

- Bank summary totals and category totals now consistently aggregate `Decimal` values, preventing `float + Decimal` failures for income, known expense categories, and legacy/custom categories. Values are converted to JSON-safe floats only after aggregation.
- Added explicit backend confirmation to the development/test-only module clearing endpoint; the frontend sends it only after its confirmation dialog.
- Module clearing creates a full pre-clear workbook snapshot and now skips automatic-backup pruning during both workbook preparation and row removal. It records deleted row IDs in the `Deleted` worksheet so shared sync can propagate removals across desktop clients.
- Verification: Bank summary and currency persistence tests passed (2); clear guard and workbook structure tests passed (2); `git diff --check` passed. Other summary services inspected convert inputs to float before summing; no same-type failure was found.
- The inspected Testing EXE workbook still has 60 Bank rows. The error is in a read-only dashboard summary; no workbook data was deleted by that calculation. Other runtime data roots were not inspected, and no workbook was modified or restored.

# Part 2 — Desktop Storage Migration: Excel to SQLite

Part 2 tracks the migration of FinLedge Desktop storage from the five Excel workbooks
to SQLite. Part 1 above is the MSIX/.exe coexistence track and is **not changed by this
part**; everything here is additive. Phase numbering restarts here — a "Phase N" under
Part 2 is not the same phase as the Part 1 heading with the same number.

Read before working in this part: `desktop-codebase.md`, `AGENTS.md`, `PLAN.md`,
`SAFETY.md`, `TASKS.md`, `schema.md`, `rules.md`, `device-transfer.md`.
`docs/schema.md` is the data-model authority, `docs/rules.md` the behaviour
authority, `docs/SAFETY.md` the safety authority, and `docs/device-transfer.md`
the transfer authority for everything below.

Current storage, verified during the Phase 0 audit:

| Workbook | Module | Worksheet |
|---|---|---|
| `bank_transactions.xlsx` | Bank Services | `Bank` |
| `share_transactions.xlsx` | Share Portfolio | `Share` |
| `personal_finance_bank_flow.xlsx` | Personal Finance — Bank Flow | `Bank Flow` |
| `personal_finance_cash_flow.xlsx` | Personal Finance — Cash Flow | `Cash Flow` |
| `personal_finance_transfer.xlsx` | Personal Finance — Transfers | `Transfer Flow` |

Historical Part 1 storage text: its shared-folder Excel behavior is superseded for SQLite by the approved rule that EXE and AppX share one physical database within each environment. Development, Testing, and Production remain isolated. The old workbook folder is only a migration source; it is backed up in place before import.

## Phase status summary

| Phase | Title | Status | Entry condition |
|---|---|---|---|
| 0 | Existing System Audit | **COMPLETED** | — |
| 1 | SQLite Architecture and Database Design | **IN PROGRESS — design finalization** | Phase 0 audit report reviewed; approved corrections in progress |
| 2 | SQLite Implementation | **NOT STARTED** | Phase 1 design finalized and user explicitly approves Phase 2 |
| 3 | Existing Data Migration and Verification | **PENDING** | Phase 2 implementation verified on test data |
| 4 | Final Testing, Optimization and Release Readiness | **PENDING** | Phase 3 migration verified on copies of real data |

Status values used in Part 2: NOT STARTED, IN PROGRESS, COMPLETED, BLOCKED.

Phase 2 is **not approved to start** by this document. It begins only after the user
explicitly approves the Phase 1 specification and says to start Phase 2.

## Roadmap maintenance rules

This file is the central tracking document for the migration.

- Tick a checkbox only when the work is actually done and evidence exists.
- Every completed task gets a short note: what changed and how it was verified.
- Record test commands, pass/fail counts, and manual checks under *Verification
  evidence*. A checkbox without evidence is a claim, not a completion.
- Record unresolved issues under *Known issues*. When one is fixed, mark it resolved and
  add the evidence; do not delete the original text.
- Update the status in both the phase block and the status summary table.
- The Phase 0 audit report is referenced, not duplicated. Summarise completed audit
  activities only.
- If a decision changes, append a dated entry under *Decision changes* at the end of
  Part 2 and keep the original decision visible. Never silently rewrite history.
- Do not mark a phase complete because its tasks are written down. Only implemented,
  tested, and verified work completes a phase.

## Cross-phase non-negotiables

These apply to every phase in Part 2 and restate the standing project rules:

- Never delete or overwrite an original Excel workbook or an existing backup.
- Snapshot before any write, using the existing `snapshot_before_write` helper and the
  backup retention rules established in Part 1.
- Migration is additive. Excel stays available as a fallback until SQLite is verified on
  copies of real data.
- No schema or column change ships without updating `docs/schema.md` in the same task
  (AGENTS.md §0).
- Financial values are never left in binary floating point without an explicit,
  documented rounding rule.
- Existing API response shapes stay stable unless a Phase 1 decision explicitly changes
  them and the frontend is updated in the same task.
- Ambiguous instructions default to the narrower, safer action (AGENTS.md §0.5).

---

## Phase 0 — Existing System Audit

**Status:** COMPLETED

**Objective:** Understand the existing FinLedge Desktop architecture, Excel storage
system, accounting rules, dependencies, and migration risks before designing the new
database.

### Tasks

- [x] Audit the existing Electron, React/Vite, and FastAPI architecture.
- [x] Identify the five existing Excel workbooks and their responsibilities.
- [x] Review the existing workbook schemas and columns.
- [x] Investigate Excel read/write operations and performance bottlenecks.
- [x] Identify repeated workbook loading and unnecessary data reads.
- [x] Review existing UUID, Content Hash, metadata, conflict, and deletion mechanisms.
- [x] Investigate existing backup, restore, shared-sync, and migration mechanisms.
- [x] Review existing Excel import/export functionality.
- [x] Identify existing financial calculations and accounting behaviour.
- [x] Investigate the Development, Testing EXE, Testing AppX, Production EXE, and
      Production AppX data environments.
- [x] Review existing API endpoints and frontend data calculations.
- [x] Identify existing test coverage and known test failures.
- [x] Document risks, inconsistencies, and migration considerations.
- [x] Record baseline test results for later comparison.

### Completed work

- Architecture, module boundaries, and data flows mapped: Electron main/preload,
  React/Vite renderer, FastAPI backend, per-module service layer, and the current absence
  of a shared data-access layer.
- Workbook inventory, worksheet names, header lists, row-identity columns, and the
  `Deleted` / `Conflict` support sheets documented.
- Excel dependency map produced: which module reads and writes which workbook, which
  views derive rows read-only from other modules, and where repeated loads occur.
- Identity, metadata, merge, and deletion mechanics traced end to end: Row ID generation,
  Content Hash calculation, legacy identity seeding, metadata backfill, deterministic
  merge winner ranking, tombstones, and conflict logging.
- Backup/restore, shared-sync, data-directory resolution, installation paths, and
  import/export flows reviewed.
- Timestamp implementation confirmed: microseconds for Bank, seconds for Share,
  Personal Finance, and Transfers.
- Baseline test results recorded (see *Verification evidence*).
- Risks, inconsistencies, and migration considerations documented in the Phase 0 audit
  report.

### Remaining work

- None inside Phase 0 itself.
- Follow-up work identified by the audit is tracked in Phases 1–4. Audit findings are
  inputs to those phases; they are not retroactive Phase 0 fixes.

### Known issues and findings (audit output — not fixed here)

These were identified by the audit and are carried forward. Phase 0 did **not** fix them
and must not be described as having fixed them.

1. Excel is the source of truth and is reloaded per request; repeated workbook loads and
   full-sheet reads are the main performance cost.
2. Timestamp precision is inconsistent: Bank writes microseconds, while Share, Personal
   Finance, and Transfers write seconds. Legacy rows may hold an empty value or a bare
   date.
3. `Content Hash` is not only identification metadata. Merge winner ranking and conflict
   detection depend on it, so it cannot simply be dropped.
4. `personal_finance_transfer.xlsx` has no delete endpoint and never writes a tombstone,
   so transfer deletions are not propagated across devices today.
5. One backend test fails on the current tree and reproduces in isolation:
   `backend/tests/test_metadata_backfill_service.py::test_simultaneous_user_append_and_background_backfill_keep_both_rows`
   (`ValueError: Amount must be a valid currency value.` raised at
   `backend/services/bank_service.py:43`, where the cell holds `'legacy'`).
6. Production EXE / Production AppX physical path sharing under MSIX virtualization is
   **NOT VERIFIED**.
7. `mobile/src` is absent from this checkout; mobile SQLite evidence was read from
   `mobile/dist/src/data/schema.js`.

### Verification evidence

Baseline recorded before any Part 2 change:

| Check | Command | Result |
|---|---|---|
| Backend suite | `pytest backend/tests/` | 170 passed, 1 failed (issue 5 above) |
| Desktop data tests | `npm run desktop:test-data` | 36/36 passed |
| Frontend smoke | `npm test` | passed against the existing `dist` |
| Frontend production build | `npm run build` | **not run** during Phase 0 |
| Working tree | `git status` | clean at audit start; no project files modified by Phase 0 |

No workbook was modified, no SQLite database was created, and no migration was run
during Phase 0.

### Dependencies

- None. Phase 0 is the entry point for Part 2.
- The Phase 0 audit report listed above is required input for Phase 1.

---

## Phase 1 — SQLite Architecture and Database Design

**Status:** IN PROGRESS — design finalization

**Objective:** Produce an implementation-ready database architecture and migration
design before changing application code.

**Phase 1 was design-only.** No application source changes, no schema execution, no
database creation, and no data migration. Deliverables are documents plus reviewed SQL
DDL text. That constraint was met: the only files changed in Phase 1 are documentation.

**Authority produced by this phase:**

| Document | Owns |
|---|---|
| `docs/schema.md` | Approved Desktop schema and future Mobile target, DDL, precision, Excel and Mobile mapping, environment paths, versioning |
| `docs/rules.md` | Identity, hashing, timestamps, ordering, financial formulas, import/export, merge/replace, conflicts, parity |
| `docs/SAFETY.md` (Part 2) | SQLite backup, snapshots, migration, recovery, restore precedence, environment isolation, transfer safety |
| `docs/device-transfer.md` | Transfer architecture, protocol, transports, pairing, staging, review integration, build-time flag |

If code and these documents disagree during Phase 2, the code is wrong until the
document is deliberately changed through the *Decision changes* log below.

### Confirmed design decisions

These decisions are settled. Phase 1 designs around them; it does not re-open them
without a dated entry under *Decision changes*.

#### Personal Finance — one table, two flows

- One SQLite table for Bank Flow and Cash Flow, e.g. `personal_finance_entries`.
- Distinguish the flows with a `flow_type` column (`bank` / `cash`).
- Keep the separate Bank Flow and Cash Flow screens and the separate Excel exports.
  Storage unification must not merge the UI or change export file boundaries.
- Manually entered Personal Finance rows move to SQLite. Rows currently derived read-only
  from Bank Services and Share Portfolio stay derived (see *Derived read-only data*).

#### Share Portfolio — two canonical event tables (approved 2026-11-06 — SUPERSEDED 2026-11-06)

> **Superseded 2026-11-06.** The user reviewed the SQL produced from this two-table design and reversed it the same day. The text below is kept unchanged so the decision history stays visible; the current approved design is *Share Portfolio — three canonical event tables* immediately after it.

The original three-table proposal is retained in the Decision changes history. The approved canonical source tables are investment_transactions (IPO application/allotment, secondary buy/sell, SIP installment/full redemption) and dividend_events (cash dividend/bonus). transaction_type/event_type is immutable and part of the content hash. Each SIP plan has a separately generated UUID plus SIP name; SIP events reference the plan UUID. No Mobile code or schema is changed by this Desktop migration.

#### Share Portfolio — three canonical event tables (approved 2026-11-06)

The two-table design is superseded. The approved canonical source tables are `share_transactions` (IPO application/allotment, secondary buy/sell), `sip_transactions` (SIP installment/full redemption), and `dividend_events` (cash dividend/bonus). `transaction_type`/`event_type` is immutable and part of the content hash. Each SIP plan has a separately generated UUID plus SIP name; SIP events reference the plan UUID. No Mobile code or schema is changed by this Desktop migration.

The split has three reasons: a combined table needed a long CHECK to keep two different row shapes apart and left about half of its columns NULL on every row; SIP is excluded from the share holdings and P/L replay, so SIP rows never need to be ordered against share rows; and combined name suggestions plus the combined history list are read-only UNION views (`docs/schema.md` §6.2) over the tables, with nothing duplicated in storage.

Ordering: `share_transactions` and `dividend_events` share one `sequence_no` counter, replayed by `(txn_date, sequence_no)`, because bonus and dividend events change share holdings. `sip_transactions` has its own `sequence_no` counter and replay key. No counter spans SIP and shares.

Master identity (added 2026-11-06): `shares` (`docs/schema.md` §4.3.3) holds one canonical name per share. `share_transactions` and `dividend_events` reference it by `share_id` with `ON DELETE RESTRICT ON UPDATE RESTRICT`; the displayed name comes from a join. SIP keeps its own `investment_name`. A `sip_plans` table (§4.3.4) is PROPOSED — AWAITING USER APPROVAL.

#### Holdings summaries — derived and rebuildable

share_holdings stores the derived current security position and performance values. sip_plan_summaries stores derived per-plan principal, units, pending count, redemption result, and plan status. Neither is a canonical transaction table. Both are rebuilt from canonical events, calculation-versioned, and updated atomically with changed source events.

Rules:

- The three canonical event tables are the only financial sources of truth.
- Summary values are never manually edited and must be reproducible by full replay.
- Missing, stale, corrupt, or calculation-version-incompatible summaries are rebuilt or marked invalid before use.
- Full rebuild and incremental maintenance must agree; verify this in Phase 2 tests.
#### Holdings maintenance — hybrid

- Incremental update for safe ordinary insert operations.
- Recalculate the affected share's complete summary for edits and deletions.
- If an edit changes the share name, recalculate both the old and the new share.
- Rebuild affected summaries after imports and other complex operations.
- Provide a full holdings rebuild entry point for diagnostics and recovery.
- Do all transaction plus summary writes inside one SQLite transaction.
- Do **not** put financial accounting rules inside SQL triggers without a written
  justification. Correctness lives in tested Python code.

#### Unified Share Portfolio history

- Present IPO, secondary, SIP, cash dividend, and bonus rows as one chronological
  history in the application.
- Preserve original record identity and source table on every row.
- Preserve chronological order and a stable same-date tie-breaker, so the history does
  not reshuffle between reads.
- Editing and deleting happen against the original table.
- Do **not** create a second writable unified table. The unified view is read-only.

#### Transfers

- Keep Transfers in its own table (`transfers`), separate from
  `personal_finance_entries`, because transfers carry two sides and different validation.
- Whether transfers gain tombstone/deletion support is an open decision (see *Open
  decisions*). It is recorded as a known gap, not as settled behaviour.
  **Resolved in Phase 1:** tombstone and delete support are added in Phase 2
  (see *Open decisions — resolutions* #5).

#### Identity

- UUID primary keys for all transaction tables.
- Preserve existing Excel Row IDs during migration wherever an ID already exists.
- Never mint a new ID for a row that already has one.
- Keep Row ID and content-hash pairs verifiable, so the existing data-directory
  integrity checks retain their meaning.

#### Derived read-only data

Personal Finance Bank Flow currently shows read-only `bank-services-sync` and
`share-sync` rows derived from other workbooks. These stay derived and are not copied
into `personal_finance_entries`. Phase 1 must define the SQLite query that produces them
with the same semantics, including the same read-only restriction in the UI.

### Transaction metadata (confirmed)

Every canonical transaction/event table — `bank_transactions`,
`personal_finance_entries`, `share_transactions`, `sip_transactions`,
`dividend_events`, and
`transfers` — carries the same three metadata fields:

| Column | Direction | Semantics |
|---|---|---|
| `created_timestamp` | date-time | Set once when the row is created. Never overwritten by an ordinary edit. Preserved verbatim through import and migration. |
| `last_updated_timestamp` | date-time | Set on creation; replaced only when the row's business data actually changes. |
| `updated_device` | text | Device label of the last writer, using the existing normalised value set. |

Rules Phase 1 must encode and Phase 2 must implement:

- **Create:** set `created_timestamp` and `last_updated_timestamp` to the same value and
  set `updated_device` to the current device.
- **Edit:** keep `created_timestamp` byte-for-byte; replace `last_updated_timestamp` and
  `updated_device`.
- **No-op edit:** a request that changes nothing must not bump `last_updated_timestamp`
  or `updated_device`. This mirrors the existing "skipped unchanged" merge result.
- **Delete:** record the deletion using the existing tombstone semantics; do not mutate
  the deleted row's `created_timestamp`.
- **Import merge:** preserve each source row's original metadata. Do not restamp incoming
  rows as newly created or newly modified on the receiving device.
- **Migration:** copy `created_timestamp` and `last_updated_timestamp` exactly.
  **Migration alone must not make records appear newly modified.** If an original
  timestamp is missing, apply the existing backfill rule (Date column, then `legacy`
  device) instead of `now()`.
- **Device normalisation:** reuse `normalize_device_label()`. `desktop` normalises to
  `legacy`; the labels observed in code and stored data are `desktop-exe`,
  `desktop-appx`, `desktop-dev`, `desktop-test`, `mobile`, and `legacy`. Phase 1 confirms
  the complete set and keeps the mapping in one shared place.
- **One behaviour everywhere:** no table may use seconds while another uses
  microseconds, and no read path may bump timestamps. Behaviour must be identical across
  all canonical transaction tables and enforced by one shared helper, not six copies
  (AGENTS.md §10).

`share_holdings` is derived, so it gets summary-maintenance metadata rather than
transaction metadata:

- `summary_updated_timestamp` — when this share's summary was last recalculated.
- `summary_updated_device` — **open decision.** Recommendation: keep it, because it makes
  stale-summary diagnosis possible without joining back to transactions.
  **Resolved in Phase 1:** kept (see *Open decisions — resolutions* #4).

### Timestamp representation — resolved in Phase 1

**Resolved:** ISO-8601 UTC text with microseconds and a trailing `Z`. The evidence below
is the reason the decision existed; it is retained for context.

Current evidence, verified in the code:

| Module | Helper | Precision |
|---|---|---|
| Bank | `current_timestamp_us()` at `backend/services/excel_utils.py:281` | microseconds |
| Share | `current_timestamp()` at `backend/services/excel_utils.py:276` | seconds |
| Personal Finance (both flows) | `current_timestamp()` | seconds |
| Transfers | `current_timestamp()` | seconds |

All are ISO-8601 strings. Legacy rows may be empty or hold a bare date.
`populate_missing_audit_metadata()` fills a missing `created_timestamp` from the Date
column, copies the created value into a missing `last_updated_timestamp`, and sets a
missing `updated_device` to `legacy`.

Phase 1 must choose one representation before any DDL is frozen — recommendation: UTC
ISO-8601 text with microseconds, or INTEGER epoch microseconds — plus explicit coercion
rules for empty values, date-only values, and timezone-naive values. Rationale for
microseconds over seconds: the existing Bank helper comment states that microseconds keep
two rapid edits distinguishable, and merge ranking compares timestamps as strings.

**Resolved:** UTC ISO-8601 text with microseconds. Integer epoch microseconds was
rejected because it loses readability in diagnostics and Excel/JSON round-trips while
offering no benefit at this data scale.

### Verified dependencies on the existing metadata fields

These fields are not decorative. The behaviour below depends on them today and must keep
working after migration.

| Dependency | Location | What breaks if dropped or re-typed |
|---|---|---|
| Merge winner ranking `(last_updated_timestamp, updated_device, content_hash)` | `backend/services/workbook_merge.py:369-372` | Divergent rows would resolve non-deterministically instead of newest timestamp, then device, then hash |
| Tombstone wins only when `deleted_timestamp` is newer than the winner's timestamp | `backend/services/workbook_merge.py:389-395` | A deleted row could resurrect on the next sync |
| Legacy identity seed includes the normalised `Created Timestamp` | `backend/services/workbook_merge.py:202-209` | Re-importing a workbook would mint new Row IDs and duplicate rows |
| Missing-metadata backfill fills all three fields | `backend/services/workbook_merge.py:219-242` | Older workbooks would fail validation and lose audit attribution |
| Conflict record stores the losing device | `backend/services/workbook_merge.py:376-382` | Conflict history would lose attribution |
| Integrity checks require Row ID, Content Hash, and all three metadata columns | `backend/services/data_directory_service.py:41,746`; `backend/services/data_migration_service.py:411` | Data-folder moves and migrations would fail pre-flight validation |
| Sync journal stores `device` | `backend/services/shared_sync_service.py:246-257` | Journal/state parity checks would lose meaning |
| Per-module stamping on create and edit | `bank_service.py:57,200`; `share_service.py:96,399,465`; `personal_finance_service.py:174,402`; `personal_finance_transfers.py:92,330` | Existing API responses would change shape |

Phase 1 must therefore specify the SQLite equivalents of all of these rules:
deterministic conflict ranking, tombstone comparison, identity seeding, metadata
backfill, and sync-journal attribution.

### Content Hash — confirmed constraint

- `content_hash` is **not required as a normal SQLite transaction field merely for
  record identification.** UUIDs plus preserved Row IDs are sufficient identity.
- Existing synchronization and conflict-resolution behaviour **depends on it today** (see
  the dependency table above). That behaviour must not be removed or broken.
- Phase 1 must evaluate the options and choose one:
  1. keep a nullable `content_hash` column, maintained on write for Excel-export
     compatibility and merge parity;
  2. compute the hash on demand at the sync/export boundary from the current row, with no
     stored column, so it always matches the row;
  3. replace hash-based tie-breaking with a deterministic rule that provably resolves the
     same cases, backed by tests showing no regression.
- Whichever option is chosen must preserve: compatibility with Excel files that already
  contain `Content Hash`, deterministic merge outcomes, and the existing data-integrity
  checks.

**Resolved:** option 1 — a required, stored `content_hash` in canonical
`sha256:<64 hex>` form, recomputed on every write and export, with legacy SHA-1 accepted
and upgraded on import. Option 2 was rejected because export and merge need a stable,
verifiable stored value; option 3 was rejected because it changes tested behaviour
without evidence of equivalent outcomes.

### Open decisions Phase 1 had to resolve — resolutions

The original open-decision list is preserved below with the Phase 1 resolution added.
Each resolution is recorded again, with reasoning, under *Decision changes*.

| # | Decision | Options | Resolution |
|---|---|---|---|
| 1 | Timestamp representation | ISO-8601 text (microseconds) vs INTEGER epoch microseconds | **ISO-8601 UTC text with microseconds** (`YYYY-MM-DDTHH:MM:SS.ffffffZ`). Stored as fixed-width `TEXT`; lexical order equals chronological order, it round-trips through Excel and JSON unchanged, and it is readable in diagnostics. Legacy values are coerced, never shifted (schema §9.4, rules §3.3). |
| 2 | `content_hash` handling | stored nullable vs computed on demand vs replaced | **Stored, required, canonical `sha256:<64 hex>`.** Recomputed on every write and on export; a provided hash is verified on import. Existing SHA-1 is recognised and upgraded (rules §2). Identity remains UUID. |
| 3 | Numeric storage | scaled INTEGER (scale 10,000) vs REAL with Python `Decimal` | **Scaled INTEGER ×10⁴** for money, prices and charges; `INTEGER` whole shares; ppm ×10⁶ reserved for rates. Exact Decimal arithmetic in the service layer; `REAL` is banned for financial storage (schema §7). |
| 4 | `share_holdings` device tracking | `summary_updated_device` plus timestamp vs timestamp only | **Keep both** `summary_updated_timestamp` and `summary_updated_device`. It makes stale-summary diagnosis possible without joining transactions and matches transaction metadata. |
| 5 | `transfers` tombstone support | add vs explicitly accept no cross-device delete | **Add** tombstone and delete support in Phase 2. The previous absence is recorded as a defect, not accepted behaviour. |
| 6 | Derived Personal Finance sync rows | live SQL view vs query-time aggregation | **Query-time service aggregation**, not a SQL view, because the rules depend on linked-module exclusion, share-only categories, and transfer labels that must be identical on both platforms. The rows are read-only and never stored (schema §6.3, rules §6.3). |
| 7 | Migrating `Conflict` / `Deleted` history | migrate the audit trail vs start clean | **Migrate** into `record_conflicts` and `deleted_records`. Audit history is user data and is never discarded. |

Additional decisions resolved during Phase 1 (not in the original list):

| # | Decision | Resolution |
|---|---|---|
| 8 | One schema or two | **One approved target logical schema** for Desktop and future Mobile adoption. This migration changes Desktop only; Mobile's current implementation remains in place until a separate approved migration (schema §1, §10). |
| 9 | Ordering column | **`sequence_no INTEGER NOT NULL`** per transaction table, preserving workbook/insertion order and same-date ordering. Assigned `1..N` in workbook order during migration; never renumbered by delete. |
| 10 | Environment databases | One database per environment: Development; Testing shared by EXE/AppX; Production shared by EXE/AppX. Shared per-user folder is still proposed (schema §11, SAFETY §12). |
| 11 | Unknown categories | **Stage for review as `unsupported`/`invalid`; never coerce or silently discard** (rules §10.4). |
| 12 | Migration path for legacy IDs | **`legacy_identity_map` table** replaces `row-identity-map.json`, preserving deterministic UUIDs across repeated legacy imports (schema §4.13, rules §1.2). |
| 13 | Holdings cache | **`share_holdings` is derived**, fully rebuildable, and never written without a transaction change. Incremental + full-rebuild parity is a test contract (rules §9, §18). |
| 14 | Transfer feature exposure | **Build-time flag `FINLEDGE_ENABLE_DEVICE_TRANSFER`**, default `0`, forced `0` in production, with the code excluded — not merely hidden (device-transfer §12). |
| 15 | Share identity | **`shares` master table** plus `share_id` foreign keys on `share_transactions` and `dividend_events` (approved 2026-11-06, reversing the earlier no-dimension-table decision). `content_hash` and transfer payload use the canonical name, never the local `share_id` (schema §4.3.3, rules §7.11). |
| 16 | IPO quantity state | **`NULL` and `0` are the same state** (not allotted / result not entered); blank/`0` is normalized to `NULL`, the CHECK rejects `0`, and only `quantity > 0` creates a holding (schema §4.3.1, rules §7.2). |
| 17 | SIP redemption amount | **Total net amount received**, `> 0`; `charge_scaled` is recorded separately and not subtracted again. P/L = net received − total invested (installment amount + charge) (rules §7.7). |
| 18 | Dividend/bonus validation | **Replay the share timeline on every write path**; cash and bonus require holding `> 0`, reject with `no_holding_at_event_date`, and imports/transfers stage failures for review (rules §7.12). |

### Phase 1 deliverables — prior progress; design finalization reopened

Schema and data model:

- [x] Final table list with every column, type, nullability, default, and unit —
      `docs/schema.md` §4.
- [x] Complete SQL DDL for all tables (reviewed text only, not executed) —
      `docs/schema.md` §4.
- [x] Primary keys, foreign keys, uniqueness constraints, and check constraints.
- [x] Indexes justified by concrete query patterns (list, date range, per-share summary,
      unified history ordering).
- [x] Metadata columns and their enforcement strategy on all transaction tables.
- [x] `share_holdings` summary columns and rebuild semantics.
- [x] Validated domains for categories, flow types, and device labels.
- [x] Legacy-value coercion rules (empty timestamps, date-only timestamps, blank device,
      unknown category).

Behaviour and accounting:

- [x] Documented accounting formulas matching current code, with worked examples: Bank
      cumulative totals, Share weighted-average cost and remaining cost, SIP handling,
      dividend and bonus effect on holdings, and transfer two-sided effects —
      `docs/rules.md` §5–§9.
- [x] Per-field rounding and precision rules, not one global rule — `docs/schema.md` §7.
- [x] A definition of "material change" for `last_updated_timestamp`, so no-op edits do
      not bump it — `docs/rules.md` §3.2.

Architecture:

- [x] Repository/data-access layer shape, split along current service boundaries.
- [x] API contract mapping: every existing endpoint to a SQLite-backed implementation,
      with unchanged request/response shapes wherever possible (mapping work item carried
      into Phase 2).
- [x] Transaction boundaries and concurrency model (WAL, busy timeout, single writer,
      retry policy) preserving the guarantees of the current Excel file locks —
      `docs/SAFETY.md` §14.
- [x] Migration strategy with idempotency rules — `docs/schema.md` §9,
      `docs/rules.md` §17, `docs/SAFETY.md` §9.
- [x] Backup/recovery design integrated with the existing snapshot and auto-backup
      retention rules — `docs/SAFETY.md` §7–§11.
- [x] Environment isolation: Development, Testing EXE, Testing AppX, Production EXE, and
      Production AppX each resolve their own database path through one shared resolver —
      `docs/schema.md` §11.
- [x] Excel import/export compatibility design, including `Content Hash` and metadata
      round-tripping — `docs/schema.md` §8.
- [x] Testing strategy: unit, repository, migration, parity, concurrency, performance —
      `docs/device-transfer.md` §16 and the Phase 2–4 tasks below.
- [x] Performance targets measured against the Phase 0 baseline (targets set; measurement
      is a Phase 2–4 task).
- [x] Risk register and unresolved-decision list — `docs/device-transfer.md` §17,
      `docs/rules.md` §20–§21.

Additional deliverables added during Phase 1:

- [x] Canonical device-transfer architecture — `docs/device-transfer.md`.
- [x] Build-time transfer exclusion design — `docs/device-transfer.md` §12.
- [x] Mobile schema comparison and migration plan — `docs/schema.md` §10.
- [x] Cross-document consistency pass: all four authority documents describe the same
      architecture and cross-reference each other.

Exit criteria:

- [ ] Remaining proposed design decisions reviewed and approved by the user.
- [ ] All pending decisions have written resolution and user approval.
- [x] No code, database, or workbook created or modified.

### Completed work

- `docs/schema.md` rewritten as the unified canonical schema: 14 tables (7 financial,
  5 support/transfer, `legacy_identity_map`, `schema_migrations`), complete DDL,
  authoritative-vs-derived classification, canonical queries, precision rules, Excel
  mapping, legacy migration, Mobile migration, environment isolation, versioning.
- `docs/rules.md` extended with identity lifecycle, SHA-256/SHA-1 hash rules, timestamp
  and ordering rules, device labels, verified bank/PF/share/SIP/dividend/transfer
  formulas with worked examples, holdings invariants, import/export, merge/replace,
  duplicate and conflict rules, cross-platform parity, known discrepancies and
  unresolved behaviour.
- `docs/SAFETY.md` extended with Part 2: SQLite-safe backup mechanisms, snapshot
  triggers, migration rehearsal/execution/rollback, corruption recovery, restore
  precedence and the empty-database rule, environment isolation, import/Replace safety,
  atomicity/concurrency, transfer staging/security/cleanup, recovery tests and incident
  response.
- `docs/device-transfer.md` created: component boundaries, both directional workflows,
  resume and Replace, QR/pairing/security, framed versioned protocol, batching,
  checksums, acks, errors, timeouts, transport abstraction, category dependencies,
  conflict handling, progressive transfer, review integration, build-time flag design
  and verification, Phase 2 checklist, Mobile plan, tests and risks.
- This document updated with the Phase 1 completion record, resolved decisions and the
  Phase 2–4 roadmap.

### Remaining work

- None inside Phase 1.
- Phase 2 is **NOT STARTED** and requires explicit approval before any task
  begins.
- The unresolved questions in `docs/rules.md` §21 and `docs/device-transfer.md` §17 stay
  open and are carried into Phase 2 as recorded decisions, not guesses.

### Known issues

- Carried from Phase 0 and deliberately **not fixed** in Phase 1: timestamp precision
  inconsistency, Content Hash dependency, missing transfer tombstones, and one failing
  backend test (`test_simultaneous_user_append_and_background_backfill_keep_both_rows`).
- Verified contradictions are catalogued in `docs/rules.md` §20 and must be resolved in
  Phase 2 by code changes, not by reinterpreting the documents.
- Mobile still uses FIFO and the pre-canonical schema; transfer must reject it as
  `SCHEMA_UNSUPPORTED` until it adopts the canonical model.
- Production EXE / Production AppX physical path sharing remains **NOT VERIFIED**.

### Verification evidence

| Check | Command / method | Result |
|---|---|---|
| Documents exist and are non-empty | `docs/schema.md`, `docs/rules.md`, `docs/SAFETY.md`, `docs/device-transfer.md` | Present |
| Cross-references resolve | grep for `docs/schema.md`, `docs/rules.md`, `docs/SAFETY.md`, `docs/device-transfer.md`, `docs/desktop-tasks.md` across the four authority docs | All four link to each other |
| Architecture consistency | Manual pass: table names, column names, device labels, metadata quality values, timestamp format, hash format, environment paths, transfer flag name | Consistent across all four documents |
| Financial rules match verified code | Manual comparison against `share_lot_calculations.py`, `share_service.py`, `share_summary.py`, `personal_finance_summary.py`, `personal_finance_transfers.py`, `bank_service.py`, `workbook_merge.py` | Matches, with contradictions recorded rather than smoothed over |
| No app code changed | `git status --porcelain` filtered to `backend/`, `desktop/`, `frontendwebapp/`, `mobile/` | No changes |
| No database or workbook created | Filesystem check for `*.db`, `*.db-wal`, `*.db-shm` outside existing data folders; `git status` for `*.xlsx` | None created |
| Whitespace/conflict hygiene | `git diff --check` | Clean (recorded in the Phase 1 delivery report) |
| Baseline tests (unchanged, for comparison) | `pytest backend/tests/`; `npm run desktop:test-data` | 170 passed / 1 pre-existing failure; 36/36 desktop data tests |

Phase 1 created no SQLite database, executed no DDL, ran no migration, and modified no
workbook.

### Dependencies

- Phase 0 audit report (consumed).
- User approval of the design before Phase 2 starts — **given for the design; explicit
  Phase 2 start approval still required**.

---

## Phase 2 — SQLite Implementation

**Status:** NOT STARTED

**Entry condition:** Phase 1 specification approved **and** the user explicitly says to
start Phase 2. Do not begin any task below before that instruction.

**Objective:** Implement the approved Phase 1 architecture inside the existing
application without breaking current behaviour, behind the existing Excel path until
parity is proven.

The task list below is the implementation contract. It is derived from `docs/schema.md`,
`docs/rules.md`, `docs/SAFETY.md` and `docs/device-transfer.md`; a task is complete only
when implemented, tested, and its evidence recorded.

### 2.1 Foundation and infrastructure

- [ ] Add the single database module (`backend/db/connection.py`): path resolution,
      `sqlite3.connect`, `row_factory`, WAL, `foreign_keys=ON`,
      `synchronous=FULL`, `busy_timeout=5000`, bounded `SQLITE_BUSY` retry.
- [ ] Add `backend/db/schema.py` and `backend/db/migrations/0001_initial.sql` exactly
      matching `docs/schema.md` §4; apply in one transaction per migration.
- [ ] Implement `PRAGMA user_version` read/write plus `schema_migrations` audit rows.
- [ ] Startup self-check reads `PRAGMA foreign_keys` and refuses writes if it is not `ON`;
      the pragma is set once in the shared connection factory before any transaction.
- [ ] Migration verification runs `PRAGMA foreign_key_check` and requires zero rows
      before the migration is marked complete.
- [ ] Open a newer-than-supported database read-only with a clear error; never downgrade.
- [ ] Add repository modules per domain: `bank_repository.py`,
      `personal_finance_repository.py`, `share_repository.py`,
      `dividend_repository.py`, `transfer_repository.py`, `holdings_repository.py`,
      `support_repository.py` (tombstones, conflicts, identity map, migrations).
- [ ] Repositories accept an existing connection so services can compose one
      transaction; repositories never open their own long-lived connection.
- [ ] Add one shared row-mapping module for scaled-integer ↔ `Decimal` conversion; no
      ad-hoc `float()` on the financial path.
- [ ] Add one shared metadata/stamping helper and one shared content-hash helper; delete
      per-module copies after grep proves no remaining call sites.
- [ ] Startup integrity check (`PRAGMA quick_check`) plus the recovery path from
      `docs/SAFETY.md` §10; no auto-repair of the only copy.
- [ ] Verify environment isolation: each of the three environments resolves its own
      database and backup root; EXE and AppX inside one environment resolve the same
      database, and a testing build cannot open a production path.

### 2.2 Canonical writes and metadata

- [ ] Implement create/edit/delete for all six canonical transaction tables with UUID identity,
      `sequence_no`, and the metadata rules in `docs/rules.md` §1 and §3.
- [ ] Enforce create-once `created_timestamp`; only a material change bumps
      `last_updated_timestamp` and `updated_device`.
- [ ] Write `content_hash` as `sha256:…` on every authoritative write; verify
      provided hashes on import; accept and upgrade legacy SHA-1.
- [ ] Implement `legacy_identity_map` and migrate `row-identity-map.json` data into it
      without re-minting UUIDs.
- [ ] Implement tombstones in `deleted_records` for all six tables, including the new
      transfer delete endpoint and its tombstone.
- [ ] Implement `record_conflicts` writing on the existing automatic merge path.
- [ ] Tests: UUID stability across edit; no-op edit bumps nothing; delete writes exactly
      one tombstone; hash changes only on business change; legacy SHA-1 import upgrades
      to SHA-256.

### 2.3 Domain storage and calculations

Bank:

- [ ] Move Bank Services reads/writes to `bank_transactions` with signed
      `amount_scaled`, category-derived sign, and derived cumulative amount via the
      window query in `docs/schema.md` §6.1.
- [ ] Preserve the exact summary formulas in `docs/rules.md` §5.3.
- [ ] Handle legacy `Income` category as income with a warning; do not add an enum value
      silently.
- [ ] Parity test: current workbook values vs SQLite values, to the cent, including
      edits and deletes that shift cumulative amounts.

Personal finance:

- [ ] Move manual Bank Flow and Cash Flow rows to `personal_finance_entries` with
      `flow_type`, signed amount, and `source='manual'`.
- [ ] Keep derived `bank-services-sync` and `share-sync` rows query-time only, read-only,
      and excluded from manual totals exactly as in `docs/rules.md` §6.3.
- [ ] Preserve the separate screens and separate Excel exports.
- [ ] Parity test: totals, per-category breakdowns, transfer effects, linked-module
      exclusion.

Shares:

- [ ] Implement the `shares` master table: one canonical normalized name per share,
      unique, created on first use, with `share_transactions.share_id` and
      `dividend_events.share_id` foreign keys (`ON DELETE RESTRICT ON UPDATE RESTRICT`).
      One `normalize_share_name()` function is shared by UI input, API input, Excel
      import and transfer import (trim, collapse whitespace, upper-case, reject empty).
- [ ] Implement IPO/buy/sell in `share_transactions` with the weighted-average rules in
      `docs/rules.md` §7.2–§7.3.
- [ ] IPO default charge `5.00`; secondary buy/sell charge `0`; the charge rule lives in
      one shared function.
- [ ] IPO status is derived, never stored: `quantity` NULL and `0` both mean not allotted /
      result not entered; `> 0` = allotted. Blank/`0` is normalized to NULL on create, edit,
      import and transfer; the DB CHECK rejects `0`. The allotment update targets the row by
      `row_id`, never by name. Only `quantity > 0` creates a holding.
- [ ] Implement `sip_transactions`: installment adds principal; redemption stores the total
      net amount received (`amount_scaled > 0`) with the charge recorded separately, closes
      the plan, and sets derived outstanding to zero. P/L = net amount received − total
      invested in the plan (installment `amount` + installment `charge`).
- [ ] Redemption rows store `units = NULL` as not applicable and never appear in pending
      suggestions; `CHECK (transaction_type <> 'sip_redemption' OR units IS NULL)`.
- [ ] Implement `dividend_events`: cash dividend and bonus shares with the exact
      quantity/cost effects in `docs/rules.md` §7.4–§7.5, plus the Rule A/B/C holding replay
      in `docs/rules.md` §7.12 on every write path.
- [ ] Implement overselling rejection against running quantity in replay order.
- [ ] Implement cumulative profit across share and dividend activity in
      `(txn_date, sequence_no)` order; SIP redemption P/L stays separate in
      `sip_plan_summaries`.
- [ ] Implement `share_holdings` incremental update and full rebuild; both paths must
      agree on randomized fixtures.
- [ ] Implement the read-only unified share history view (`docs/schema.md` §6.2) with stable ordering and
      source identity; edits/deletes address the original table.
- [ ] Remove or explicitly deprecate the dead FIFO helpers after grep proves no call sites.
- [ ] Parity test: every share summary value against the current implementation,
      including bonus, cash dividend, SIP redemption and same-date ordering.

Dividend/bonus validation test cases (Phase 2 — list only, do not implement here):

- [ ] Dividend for an unknown share is rejected with a clear service error, not a raw FK error.
- [ ] Dividend with no holding is rejected with `no_holding_at_event_date`.
- [ ] Dividend dated before the first buy on the same date, when its `sequence_no` comes first, is rejected.
- [ ] Bonus after a full sale (holding 0) is rejected.
- [ ] Deleting a buy that a later bonus depends on is rejected and names the first invalid record.
- [ ] Editing a date so a sell precedes its buy is rejected.
- [ ] Frontend bypass / direct API call cannot create the invalid row.
- [ ] Import containing such a record stages it as invalid rather than committing it.
- [ ] A connection opened with foreign keys off is detected by the startup self-check.

Transfers:

- [ ] Move transfers to `transfers` with derived origin/destination flows.
- [ ] Preserve the current validation rule against origin `total_income` (including
      prior transfer effects and excluding linked/share-only rows), excluding the
      transfer being edited.
- [ ] Add delete + tombstone (new behaviour, recorded in *Decision changes*).
- [ ] Parity test: two-sided effects, combined view, validation messages.

### 2.4 Import, export and merge

- [ ] Implement workbook import into SQLite for all five source files, preserving UUIDs,
      both timestamps, device labels and `sequence_no` workbook order.
- [ ] Implement `metadata_quality` exactly as `docs/schema.md` §9.4; never use import
      time while a date exists; report every `imported_missing` row.
- [ ] Stop the unconditional restamp of reviewed rows; bump only on material change.
- [ ] Stage unknown categories as `unsupported`/`invalid`; never coerce or drop.
- [ ] Implement Smart Merge: add, already-present, conflict, possible duplicate, with
      review confirmation and idempotent retry.
- [ ] Implement Replace for all selected categories in one transaction with a verified
      pre-Replace snapshot, tombstones for replaced rows, summary rebuild, and restore on failure.
- [ ] Implement export with authoritative fields + recomputed derived columns, canonical
      SHA-256 hashes, and `sequence_no` order.
- [ ] Round-trip test: seed → export all five datasets → import into a fresh database →
      per-field equality, no authoritative value changed.
- [ ] Legacy workbook test matrix: no Row ID, no Content Hash, both missing, malformed
      UUID, duplicate UUID, unknown category, blank metadata.

### 2.5 Backups, recovery and concurrency

- [ ] Implement verified snapshots using `Connection.backup()` (or `VACUUM INTO`), never
      a live file copy.
- [ ] Wire the snapshot triggers in `docs/SAFETY.md` §8 (migration, import, Replace,
      transfer commit, restore, manual rebuild).
- [ ] Implement daily automatic snapshot on first launch, deduplicated per day.
- [ ] Implement quota/retention mirroring the existing policy; never prune migration,
      pre-restore or pre-Replace backups.
- [ ] Implement restore to a temp file, atomic swap, reopen, `quick_check`, version check,
      holdings rebuild, and quarantine of the replaced database.
- [ ] Implement the empty-database rule: never silently replace recoverable data.
- [ ] Concurrency tests: concurrent readers with one writer, busy timeout, rollback on
      failure, no partial financial effects.

### 2.6 Device transfer (desktop)

Full design is `docs/device-transfer.md`. Phase 2 implements it only if the flag is
enabled for the build under test.

- [ ] Add `FINLEDGE_ENABLE_DEVICE_TRANSFER` to `.env.example` and the environment doc.
- [ ] Implement the build-time flag in Vite, Electron main/preload, packaging and the
      PyInstaller sidecar, with production fail-closed and the
      `docs/device-transfer.md` §12.6 verification matrix.
- [ ] Create `backend/transfer/` with the boundaries in §2.2 of the transfer document.
- [ ] `TransferManager` as the only public entry point; no route reaches the engine
      directly.
- [ ] `SessionManager`: pairing, single-use token, 120-second expiry, pause, resume,
      expiry, cancel, cleanup.
- [ ] QR generation (Desktop always displays), TLS certificate fingerprint pinning,
      HKDF session key, per-frame HMAC, replay defence.
- [ ] `ProtocolCodec`: framing, canonical JSON, protocol/schema/capability negotiation,
      typed errors.
- [ ] `TransferEngine`: selection, batching (500 records / 1 MiB), zlib, checksums,
      cumulative acks, retry, resume, manifest.
- [ ] `StagingService` + `CommitService` with `transfer_staged_records`,
      `transfer_batches`, `transfer_sessions`, progressive review and per-category
      atomic commit.
- [ ] Reuse `ImportReview.jsx` with `source="device-transfer"`; add
      `GET /device-transfer/sessions/{id}/staged`,
      `PATCH /device-transfer/staged/{id}`,
      `POST /device-transfer/sessions/{id}/commit`.
- [ ] Smart Merge and Replace over transfer, including pre-Replace backup and restore.
- [ ] LAN transport adapter plus a mock adapter proving transport independence.
- [ ] Tests: protocol round-trip, auth/replay, batching, staging classification,
      interrupted transfer, checksum tamper, session expiry, preview/commit idempotency.

### 2.7 Frontend integration

- [ ] Replace frontend-recomputed summaries with API-provided authoritative values
      (`frontendwebapp/src/utils/summaries.js` is the known duplicate).
- [ ] Keep screens, navigation and dashboards unchanged; storage changes, UI does not.
- [ ] Show the unified share history read-only with stable ordering.
- [ ] Wire transfer review behind the build flag only.
- [ ] Verify every user-facing conditional message follows AGENTS.md §14 (real values,
      conditional presence, auto-dismiss).
- [ ] Frontend build with the flag off must contain no transfer route, component or API
      module (verify per `docs/device-transfer.md` §12.6).

### 2.8 Performance

Targets are measured, not guessed. Record actual numbers against the Phase 0 baseline:

- [ ] Dashboard/list reads for a 10-year dataset must not load full history per request
      where a derived/aggregate query is specified.
- [ ] Bank cumulative and share summary queries use the documented indexes.
- [ ] Import of 10,000 rows completes within a documented, measured budget with one
      transaction per batch, not per row.
- [ ] Holdings rebuild of 10,000 share rows completes within a measured budget.
- [ ] Memory stays bounded during import/export and transfer (streaming, not full
      in-memory history).
- [ ] Record the before/after table in *Verification evidence*.

### 2.9 Phase 2 exit criteria

- [ ] Every existing endpoint is SQLite-backed with unchanged request/response shapes,
      or a documented, frontend-updated change recorded in *Decision changes*.
- [ ] Full parity on all financial values to the cent, or a documented and approved
      difference.
- [ ] Import/export round-trip passes for all five datasets and legacy variants.
- [ ] Backup/restore and corruption-recovery tests pass.
- [ ] Concurrency and interruption tests pass.
- [ ] Transfer works end-to-end on LAN when enabled and is entirely absent when disabled.
- [ ] No test touches real user data; all fixtures are synthetic and in per-test temp
      directories.

### Completed work

- None. Phase 2 has not started.

### Remaining work

- Every item in §2.1–§2.9.

### Known issues

- Carried from Phase 0/1: the one failing backend test, Mobile FIFO divergence, and
  Production EXE / AppX path-sharing verification.
- New Phase 2 issues are appended here with a date; nothing is silently removed.

### Verification evidence

- None yet. Each task records its command and result here when it completes.

### Dependencies

- Phase 1 specification approved.
- Explicit user approval to start Phase 2.
- Copies of real workbooks available for parity testing (never the live originals).

---

## Phase 3 — Existing Data Migration and Verification

**Status:** PENDING

**Entry condition:** Phase 2 implementation verified on test data.

**Objective:** Safely migrate existing Excel data into SQLite and verify the migrated
application against the Excel baseline, using copies of real data only.

**Phase 3 does not delete or rewrite the source workbooks.** Excel remains available as a
fallback until the migrated application is verified and the user accepts the cutover.

### 3.1 Rehearsal

- [ ] Copy every real data directory to an isolated rehearsal location; never operate on
      the live originals.
- [ ] Record a pre-migration fingerprint: per-workbook row counts, per-category totals,
      and a sample of UUIDs/timestamps.
- [ ] Run the migration on the copy.
- [ ] Run the migration a second time to prove idempotency (no duplicates, no changed
      timestamps, no new UUIDs).
- [ ] Compare source and destination counts and totals per category; investigate every
      difference before continuing.
- [ ] Compare a sample of rows field-by-field, including `row_id`, both timestamps,
      `updated_device`, `content_hash` and `sequence_no`.
- [ ] Record the rehearsal command, duration, and result in *Verification evidence*.

### 3.2 Migration execution

- [ ] Acquire the single-instance / data-directory lock.
- [ ] Verify free space and write access.
- [ ] Create and verify a pre-migration snapshot (`docs/SAFETY.md` §9.2).
- [ ] Migrate all five workbook datasets:
      `bank_transactions.xlsx`, `share_transactions.xlsx`,
      `personal_finance_bank_flow.xlsx`, `personal_finance_cash_flow.xlsx`, and
      `personal_finance_transfer.xlsx`.
- [ ] Preserve Row IDs (UUIDs) and both original timestamps for every migrated row.
- [ ] Verify migration does not bump `last_updated_timestamp` or change `updated_device`.
- [ ] Populate `legacy_identity_map` from any existing `row-identity-map.json`.
- [ ] Migrate `Deleted` and `Conflicts` sheet history into `deleted_records` and
      `record_conflicts`.
- [ ] Reconstruct and verify `share_holdings` from the migrated transactions.
- [ ] Write the migration marker only after integrity and parity checks pass.

### 3.3 Verification

- [ ] Verify financial calculations against the Excel baseline: bank cumulative, totals,
      weighted-average cost, remaining cost, SIP amounts, dividends, bonuses, and
      transfers.
- [ ] Verify every share, SIP and dividend row appears in the unified history with the
      correct source and order.
- [ ] Verify Excel import and export still work, including Content Hash round-tripping
      and legacy SHA-1 inputs.
- [ ] Test migration interruption and recovery: process killed mid-migration, partial
      database, resumed run, quarantined temporary database.
- [ ] Test a deliberately corrupted database: startup quarantines it and offers the
      newest verified backup; the empty-database rule holds.
- [ ] Verify all three application environments resolve and use the correct database and
      backup roots, that EXE and AppX share one file inside an environment, and that no
      environment can cross-open another environment's data.
- [ ] Compare performance against the Phase 0 baseline.
- [ ] Record each check and its result in *Verification evidence*.

### 3.4 Cutover

- [ ] Obtain explicit user approval before switching the default storage to SQLite.
- [ ] Keep the Excel import/export path available after cutover.
- [ ] Keep the pre-migration snapshot and the original workbooks indefinitely.
- [ ] Do not delete any workbook, backup, or old database as part of cutover.

### Completed work

- None. Phase 3 has not started.

### Remaining work

- Every item above.

### Known issues

- Production EXE / Production AppX physical path sharing remains **NOT VERIFIED** until
  this phase proves it.
- Mobile is not migrated in Phase 3; it adopts the canonical schema later.
- Any parity difference discovered here is a Phase 2 defect, not a Phase 3 workaround.

### Verification evidence

- None yet.

### Dependencies

- Phase 2 implementation verified on test data.
- Copies of real data available for migration rehearsal.
- Explicit user approval to run the migration and later to cut over.

---

## Phase 4 — Final Testing, Optimization and Release Readiness

**Status:** PENDING

**Entry condition:** Phase 3 migration verified on copies of real data.

**Objective:** Ensure the SQLite-based application is stable, accurate, and ready for
normal use and distribution across every environment.

### 4.1 Regression and parity

- [ ] Full backend regression suite green, including the previously failing
      `test_simultaneous_user_append_and_background_backfill_keep_both_rows` (fixed in
      Phase 2, verified here).
- [ ] Frontend integration and smoke tests.
- [ ] Golden-fixture parity for every formula in `docs/rules.md` §5–§9.
- [ ] Excel import/export round-trip and legacy-workbook matrix green.
- [ ] Holdings incremental-vs-rebuild parity on randomized fixtures.
- [ ] Unified share history ordering stability across repeated reads.

### 4.2 Environments and packaging

- [ ] Desktop EXE testing.
- [ ] AppX testing.
- [ ] Testing and Production isolation verification: no cross-open, cross-migrate,
      cross-backup.
- [ ] Production EXE / Production AppX path verification (closes the Phase 0 unknown).
- [ ] Packaging, installer, and sidecar verification for both channels.
- [ ] Production build with transfer disabled: no route, IPC, preload API, asar entry,
      or PyInstaller module (the full §12.6 checklist in `docs/device-transfer.md`).
- [ ] Release-version and update-policy checks per the Part 1 release rules.

### 4.3 Reliability and performance

- [ ] Large-dataset performance tests: 10k+ rows per table, 10 years of history.
- [ ] Dashboard loading performance against the Phase 0 baseline.
- [ ] CRUD and concurrent-operation tests.
- [ ] Backup, restore, migration rollback, corruption quarantine, and the empty-database
      rule, end to end.
- [ ] Interrupted-transfer and session-expiry tests on real LAN hardware.
- [ ] Disk-full and permission-denied behaviour: fail safely, never corrupt.

### 4.4 Documentation and release

- [ ] Update `docs/schema.md`, `docs/rules.md`, `docs/SAFETY.md`,
      `docs/device-transfer.md` if implementation changed any decision (via
      *Decision changes*, never silent rewrites).
- [ ] Update `docs/AGENTS.md` / `docs/CODEBASE.md` with the new modules, file map and
      data-access layer.
- [ ] Update this file: Phase 4 status, evidence, and any carried known issues.
- [ ] Confirm no unresolved `pending` conflict rows or unevaluated `unsupported` records
      remain from migration.
- [ ] Mobile follow-up is explicitly scheduled, not claimed as delivered here.

### Completed work

- None. Phase 4 has not started.

### Remaining work

- Every item above.

### Known issues

- None recorded yet. Known issues are carried forward from Phases 1–3 as they appear.

### Verification evidence

- None yet.

### Dependencies

- Phase 3 migration verified on copies of real data.
- All critical tests passing, and every known migration risk addressed or explicitly
  accepted in writing. Do not mark the migration complete otherwise.

---

## Decision changes

Append-only log. Each entry keeps the original decision visible and states what changed
and why. Entries below were made during Phase 1 unless stated otherwise.

### 2026-11-04 — Historical status: Phase 1 completed; Phase 2 marked next but not started

**Original status:** Phase 1 `NEXT — NOT STARTED`; Phase 2 `PENDING`.
**Historical changed status:** Phase 1 `COMPLETED`; Phase 2 `NEXT — NOT STARTED`. Superseded 2026-11-06.
**Historical reason:** The earlier log recorded completed deliverables. Later user-approved requirements reopened design finalization; no implementation has begun.

### 2026-11-04 — Timestamp representation

**Original decision:** open — ISO-8601 text (microseconds) vs INTEGER epoch microseconds.
**Resolved:** ISO-8601 UTC text, fixed width, microseconds, trailing `Z`
(`YYYY-MM-DDTHH:MM:SS.ffffffZ`).
**Why:** lexical order equals chronological order, it survives Excel/JSON round-trips,
it is readable in diagnostics, and it preserves the existing merge comparison. Legacy
values are coerced with `metadata_quality`, never shifted.

### 2026-11-04 — `content_hash` handling

**Original decision:** open — stored nullable vs computed on demand vs replaced.
**Resolved:** stored, required, canonical `sha256:<64 hex>`; recomputed on write and
export, verified on import; legacy SHA-1 recognised and upgraded.
**Why:** merge ranking and integrity checks already depend on it, and an explicit
algorithm prefix removes the ambiguity between SHA-1 and SHA-256. UUID remains identity.

### 2026-11-04 — Numeric storage

**Original decision:** open — scaled INTEGER (10⁴) vs REAL with Python `Decimal`.
**Resolved:** scaled `INTEGER` for money and prices (×10⁴), whole-share `INTEGER` for
quantities, ppm ×10⁶ reserved for rates; `Decimal` for arithmetic; `REAL` banned for
financial storage.
**Why:** exactness, indexability, sum-safety, and portability to JavaScript within the
safe-integer range. Four decimal places match existing share prices and charges.

### 2026-11-04 — `share_holdings` device tracking

**Original decision:** open — `summary_updated_device` plus timestamp vs timestamp only.
**Resolved:** keep both.
**Why:** stale-summary diagnosis without joining transactions; consistent with
transaction metadata.

### 2026-11-04 — Transfers tombstone support

**Original decision:** open — add vs accept no cross-device delete.
**Resolved:** add tombstone and a Delete endpoint in Phase 2.
**Why:** the absence is a data-loss gap in a multi-device feature, not a design choice.

### 2026-11-04 — Derived Personal Finance sync rows

**Original decision:** open — live SQL view vs query-time aggregation.
**Resolved:** query-time service aggregation; never stored; read-only.
**Why:** the rules depend on linked-module exclusion, share-only categories and transfer
labels that must stay identical on both platforms; a SQL view would duplicate business
rules in SQL.

### 2026-11-04 — Migrating `Conflict` / `Deleted` history

**Original decision:** open — migrate the audit trail vs start clean.
**Resolved:** migrate into `record_conflicts` and `deleted_records`.
**Why:** audit history is user data; starting clean would silently discard it.

### 2026-11-04 — One canonical schema for Desktop and Mobile

**Original decision:** implicit separate platform schemas; Mobile already had its own
SQLite schema.
**Changed to:** one canonical logical schema; physical paths and platform integration may
differ; Mobile's current schema is superseded and refactored later.
**Why:** cross-platform financial consistency and safe device transfer require the same
tables, meanings, identity and precision. Mobile's FIFO and split PF tables are recorded
as discrepancies, not accepted alternatives.

### 2026-11-04 — Ordering column added

**Original decision:** physical workbook order implied; same-date ties relied on row
index.
**Changed to:** explicit `sequence_no INTEGER NOT NULL` per transaction table.
**Why:** preserves workbook and same-date ordering across migration, edits, imports and
transfers without depending on storage order. It is ordering, not identity.

### 2026-11-04 — Historical environment database isolation (superseded 2026-11-06)

**Original decision:** Excel workbooks could be shared across EXE and AppX channels
through a shared folder.
**Historical change:** five separate databases (Development, Testing EXE, Testing AppX,
Production EXE, Production AppX), each with its own WAL files and backup root. Superseded by the 2026-11-06 decision below.
**Historical reason:** the former design treated a shared live SQLite file as a risk and used explicit export/import or device transfer between channels. The approved same-environment shared database supersedes that rule.

### 2026-11-04 — Unknown categories

**Original behaviour:** not explicitly defined; risk of coercion or silent drops.
**Resolved:** stage for review as `unsupported`/`invalid` with a human-readable reason;
never coerce and never silently discard.
**Why:** unsupported financial data must remain visible and recoverable.

### 2026-11-04 — Legacy identity persistence

**Original implementation:** `row-identity-map.json` beside the workbooks.
**Changed to:** `legacy_identity_map` table in the database, same deterministic identity
key and UUID derivation.
**Why:** one transactional store with the data it protects; repeated legacy imports keep
stable UUIDs even if row order changes.

### 2026-11-04 — Device-transfer feature exposure

**Original idea:** hide the transfer UI when the feature is unavailable.
**Changed to:** build-time `FINLEDGE_ENABLE_DEVICE_TRANSFER`, default `0`, forced `0` in
production, with the frontend, Electron and Python code excluded from the build.
**Why:** a hidden button is not a security boundary; routes, IPC and packages would
otherwise remain reachable.

### 2026-11-04 — Mobile FIFO retained temporarily

**Original behaviour:** Mobile uses FIFO lot matching and a hardcoded IPO charge.
**Changed to:** Desktop weighted-average is canonical; Mobile FIFO is documented as a
discrepancy to be replaced when Mobile adopts the canonical schema.
**Why:** silently changing Mobile financial semantics now would alter historical results;
the replacement is scheduled and tested instead. Transfer rejects pre-canonical Mobile
with `SCHEMA_UNSUPPORTED`.

### 2026-11-06 — Share tables reversed to three canonical event tables (supersedes the two-table decision of the same date)

**Original decision (approved earlier on 2026-11-06):** two canonical Share event tables —
`investment_transactions` (IPO/buy/sell/SIP) plus `dividend_events`.

**Changed to:** three canonical Share event tables —
`share_transactions` (IPO application/allotment, secondary buy, secondary sell),
`sip_transactions` (SIP installment, SIP full redemption), and
`dividend_events` (cash dividend, bonus shares).

**Why:** a combined table needed a long CHECK to keep two different row shapes apart, and
about half of its columns were NULL for every row. SIP is excluded from the share
holdings and P/L replay, so SIP rows never need to be ordered against share rows. Combined
name suggestions and the combined history list are read-only UNION views over the three
tables; nothing is duplicated in storage.

**Also changed in this entry (superseded 2026-11-06 — see `IPO 0` and `NULL` unified below):** `ipo_status` is removed. IPO status is computed from
`quantity` — `NULL` = pending, `0` = not allotted, `> 0` = allotted. Legacy
`Allotted = 0` rows migrate as `quantity = 0` (not allotted) unless the user reviews
them, and the migration report lists every such row. `transaction_type`/`event_type`
stays immutable and part of the content hash.

**Still proposed at the time — awaiting user approval:** an `applied_quantity` column
so an IPO keeps the original applied kitta after allotment (rejected later on
2026-11-06 — see the next entry); gross vs net SIP redemption amount;
share/dividend replay ordering; and the shared-folder location.

### 2026-11-06 — IPO quantity normalization; `applied_quantity` rejected

> **Superseded 2026-11-06 — see `IPO 0` and `NULL` unified below.** The text in this entry
> is kept for the decision history; the current rule is that `NULL` and `0` are the same
> state and `0` is never stored.

**Original proposal:** add `applied_quantity` to preserve the original applied kitta, and
treat `quantity` as the allotted amount.

**Changed to:** `applied_quantity` is not added. Only the allotment result is stored.
`quantity` is `NULL` while the result is not entered, `0` when not allotted, and `> 0`
when allotted. The entry form's default/untouched `Allotted` value `0` is normalized to
`NULL` on IPO create/import; the IPO allotment update stores an explicit `0` or `> 0`.
Buy/sell rows require `quantity > 0`.

**Why:** the form cannot distinguish "not entered" from an explicit `0`, and the original
kitta is not needed for holdings or P/L. Normalizing the form default keeps the two IPO
states distinct without a second column.

**Still proposed at the time:** gross vs net SIP redemption amount; share/dividend replay ordering;
and the shared-folder location. The SIP amount was decided later on 2026-11-06 (see below).

### 2026-11-06 — `shares` master table and real foreign keys (reverses "no dimension table")

**Original decision (reversed):** there is deliberately no `shares` dimension table. A
share was identified only by its normalised name; foreign keys were limited to the
transfer support tables.

**Changed to:** `shares` (`share_id`, canonical `name`, `created_timestamp`) is a master
identity table. `share_transactions` and `dividend_events` replace `investment_name TEXT`
with `share_id TEXT NOT NULL REFERENCES shares(share_id) ON DELETE RESTRICT ON UPDATE
RESTRICT`; indexes become `(share_id, txn_date, sequence_no)`; the display name comes from
a join. `share_holdings` is keyed by `share_id`.

**Why:** a name repeated as free text has no parent row, so no foreign key can guarantee
that a dividend or bonus belongs to a real share. The FK is the only database-level
guarantee. The old text is kept visible in `docs/schema.md` §4.

**Normalization and cross-device identity:** one function (trim, collapse whitespace,
upper-case, reject empty) is applied on UI input, API input, Excel import and transfer
import. `content_hash` and the transfer payload carry the canonical share **name**, never
the local `share_id`; import resolves or creates the row by name. Every distinct normalized
legacy `Share Name` becomes one `shares` row, and the migration report lists names merged by
normalization rather than merging silently. Mobile is unchanged and has no `shares` table;
its transfer payloads carry names and Desktop resolves them.

**PROPOSED — AWAITING USER APPROVAL:** a share rename rule, and deterministic
`share_id` = UUIDv5 of the canonical name (limitation: no rename).

### 2026-11-06 — IPO `0` and `NULL` unified (supersedes the IPO normalization entry above)

**Original decision (above):** `NULL` meant "result not entered" and `0` meant "not
allotted", stored as two distinct states; the allotment update stored an explicit `0`.

**Changed to:** `NULL` and `0` mean the same thing — not allotted / result not entered.
Blank or `0` is normalized to `NULL` on every write path; the database CHECK is
`quantity IS NULL OR quantity > 0`. IPO UI status is `NULL` → "Not allotted / pending",
otherwise "Allotted". The allotment update targets the row by UUID `row_id`, never by name.

**Why:** the frontend sends `0` for an untouched field, so the two states cannot be told
apart reliably; no separate `applied_quantity` column is added.

**Legacy migration:** an Excel IPO row with `Allotted = 0` or blank migrates to `NULL`.
The earlier "legacy `Allotted = 0` is ambiguous" open item is removed.

### 2026-11-06 — SIP redemption amount is net (decided)

**Original proposal:** whether the entered redemption amount is gross or net was open,
with a recommendation to enter net proceeds and store charges separately.

**Changed to:** `sip_redemption.amount_scaled` is the **total net amount received**,
`> 0`. `charge_scaled` is recorded separately with default `0` and is not subtracted again.
A full redemption closes the plan and the derived outstanding/remaining investment becomes
zero. P/L = net amount received − total invested in the plan, where total invested is the
sum of each installment's `amount_scaled + charge_scaled`. No gross-vs-net PROPOSED text
remains.

### 2026-11-06 — Dividend/bonus holding validation (Rules A/B/C)

**Original behaviour:** a dividend or bonus could be stored without checking the share's
holding at that date.

**Changed to:** one validation function on every write path. The share must exist and the
holding at the event position must be `> 0`; cash and bonus both require this; bonus
quantity must be `> 0`. Rejection uses HTTP 422 `no_holding_at_event_date` naming the share
and date. Any edit or delete replays the whole share timeline in one `BEGIN IMMEDIATE`
transaction and names the first invalid record. Imports and transfers apply the same rule
in replay order; failures go to review and are never skipped or auto-corrected. See
`docs/rules.md` §7.12.

**PROPOSED — AWAITING USER APPROVAL:** database triggers as a backstop. The downside is a
second copy of the replay logic in SQL; service validation is recommended as primary.

**PROPOSED — AWAITING USER APPROVAL:** `sip_plans` (`docs/schema.md` §4.3.4) to make
`sip_transactions.sip_plan_id` a real foreign key, with one open plan per canonical SIP
name. If rejected, `sip_plan_id` stays a plain UUID.

---

## Origin of this part

This part was appended to `docs/desktop-tasks.md` as a new, separately marked section.
It preserves the entire preceding document unchanged, introduces no application source
changes, creates no database, performs no migration, and modifies no workbook.

### Phase 1 completion addendum (2026-11-04)

Phase 1 had been marked completed in the earlier record; it is reopened for design finalization. It created
`docs/device-transfer.md` and updated `docs/schema.md`, `docs/rules.md`,
`docs/SAFETY.md` and this file. It created no database, executed no DDL, ran no
migration, and modified no workbook, no application source file and no user data.
Phase 2 remains NOT STARTED and requires explicit approval.

### 2026-11-06 — Phase 1 reopened for design finalization

**Original status:** Phase 1 COMPLETED; Phase 2 NEXT — NOT STARTED.
**Changed to:** Phase 1 IN PROGRESS — design finalization; Phase 2 NOT STARTED.
**Approved:** shared EXE/AppX database within each environment; user-initiated bidirectional transfer with QR or short-code pairing and staged review; two canonical Share event tables (superseded later on 2026-11-06 — see the entry below); per-installment SIP units; full-only redemption; separately generated plan UUID with SIP name; two rebuildable derived summaries.
**Still proposed at the time:** exact shared folder, Share replay/import ordering, gross/net SIP redemption amount, pending-unit redemption handling, IPO charge/application details, opening balance, conflict policy, and Excel numeric conversion. Resolved later on 2026-11-06: gross/net SIP redemption amount (net decided), IPO `0`/`NULL` equivalence, dividend/bonus holding validation, and the `shares` master table; see the entries above. Still open: exact shared folder, same-day ordering for imported/transferred rows, pending-unit redemption handling, IPO charge/application details, opening balance, conflict policy, and Excel numeric conversion.
**Why:** The user approved additional architecture requirements on 2026-11-06. Phase 2 remains unstarted until design finalization and explicit start approval.
