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
  a per-launch token before opening the dashboard. This works with the PyInstaller one-file
  wrapper, whose Python worker PID can differ from the executable launcher PID. A single-instance
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
