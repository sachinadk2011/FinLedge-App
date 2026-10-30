# Desktop Codebase Map

Last reviewed: 2026-10-30

This is the desktop-track file map. Keep it separate from `CODEBASE.md`, which is
shared with the mobile track. The frontend and several root scripts are consumed by
more than one platform; their entries are documented here from the desktop build's
point of view. Avoid mobile-only paths and behavior in this file.

## Top-level desktop shape

```text
tracker financial/
├── backend/                 Python API and Excel-backed desktop data services
├── desktop/                 Electron shell, preload bridge, and sidecar packaging
├── frontendwebapp/          React UI loaded by the desktop shell; includes npm smoke tests
├── scripts/                 Root development, build, migration, and release tools
├── .github/workflows/       Desktop release automation
├── docs/                    Desktop-only planning and architecture notes
├── .env.example             Public runtime settings template; local `.env` stays ignored
├── docs/desktop-environment.md  Desktop environment variable reference
├── package.json             Root command entry points
├── requirements.txt         Python sidecar/API dependencies
├── desktop-update-policy.json  Desktop updater policy
└── update-policy.json       Compatibility policy used by older desktop builds
```

## Backend: `backend/`

```text
backend/
├── __init__.py
├── main.py
├── engine_main.py
├── models.py
├── routes/
│   ├── __init__.py
│   ├── bank.py
│   ├── meta.py
│   ├── personal_finance.py
│   ├── settings.py
│   ├── share.py
│   └── summary.py
├── services/
│   ├── __init__.py
│   ├── bank_service.py
│   ├── data_directory_service.py
│   ├── data_migration_service.py
│   ├── metadata_backfill_service.py
│   ├── shared_sync_service.py
│   ├── excel_utils.py
│   ├── path_utils.py
│   ├── workbook_merge.py
│   ├── workbook_headers.py
│   ├── personal_finance_service.py
│   ├── personal_finance_summary.py
│   ├── personal_finance_transfers.py
│   ├── transfer_directions.py
│   ├── transfer_direction_rules.json
│   ├── workbook_initialization.py
│   ├── settings_service.py
│   ├── settings_data/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── normalization.py
│   │   ├── workbook_export.py
│   │   └── workbook_import.py
│   ├── share_lot_calculations.py
│   ├── share_service.py
│   ├── share_summary.py
│   └── summary_graph_service.py
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_auto_backups.py
    ├── test_phase2_personal_finance.py
    ├── test_bank.py
    ├── test_concurrency.py
    ├── test_data_directory_service.py
    ├── test_metadata_backfill_service.py
    ├── test_shared_sync_service.py
    ├── test_transfer_import.py
    ├── test_workbook_merge.py
    ├── test_personal_finance.py
    ├── test_settings.py
    └── test_share.py
```

| Path | Responsibility |
|---|---|
| `main.py` | Creates the FastAPI application, runs startup migration, and registers routes. |
| `engine_main.py` | Prepares the client-specific working directory, merges initial shared workbooks, runs legacy schema migration, initializes missing files, refreshes the safety copy, and reports startup before accepting API requests. Root workbook cleanup is deferred until verified backfill and shared sync finish. Retains `--prepare-data` for tests and watches its Electron owner. |
| `__init__.py` | Python package marker for backend imports. |
| `models.py` | Request validation models and enums shared across API modules. |
| `routes/__init__.py`, `services/__init__.py` | Python package markers for route and service imports. |
| `routes/bank.py` | Bank Services HTTP endpoints. |
| `routes/meta.py` | Category metadata endpoint backed directly by request-model enums for renderer choices. |
| `routes/share.py` | Share Portfolio HTTP endpoints. |
| `routes/personal_finance.py` | Personal Expenses and transfer HTTP endpoints. |
| `routes/summary.py` | Financial Summary HTTP endpoints. |
| `routes/settings.py` | Workbook import/export HTTP endpoints. |
| `services/settings_data/__init__.py` | Package marker for focused Settings data helpers. |
| `services/bank_service.py` | Bank Services workbook I/O, record operations, and totals. |
| `services/share_service.py` | Share Portfolio workbook I/O and transaction recalculation, preserving the existing route-facing API. |
| `services/share_summary.py` | Pure aggregate calculations for Share Portfolio records, shared by the Share and Financial Summary routes. |
| `services/personal_finance_service.py` | Personal Expenses Bank/Cash workbook operations, append-before-delete flow moves with pre-write snapshots, live sync shaping, route-facing transfer compatibility functions, and copy-only repair of rows saved under the former generic sheet name. |
| `services/personal_finance_summary.py` | Pure Personal Expenses summary calculations and module/category filtering rules. |
| `services/personal_finance_transfers.py` | Transfer workbook CRUD, serialized income checks, chronological import balance replay, migration from the former generic sheet into `Transfer Flow`, and shaping of Bank/Cash transfer rows. |
| `services/transfer_directions.py` / `services/transfer_direction_rules.json` | Shared direction aliases, origin/destination flows, and labels consumed by Python and the renderer. |
| `services/share_lot_calculations.py` | Shared FIFO lot construction/consumption and SIP investment accumulation for Share Portfolio recalculation. |
| `services/summary_graph_service.py` | Aggregates day/month buckets through one classifier-based helper and builds Financial Summary PNGs; graph routes are deprecated while the renderer does not use them. |
| `services/settings_service.py` | Stable compatibility facade for Settings workbook operations used by API routes. |
| `services/settings_data/config.py` | Canonical workbook paths, headers, and exact sheet mappings for Bank Services, Share Portfolio, Personal Expenses Bank/Cash Flow, and transfers. |
| `services/settings_data/normalization.py` | Legacy header/category aliases and import normalization rules, including transfer direction aliases. |
| `services/settings_data/workbook_import.py` | Module-specific validation and row mapping, followed by backup, staged merge/replace, tombstone/conflict preservation, and derived-value recalculation; transfer imports validate chronological balances. |
| `services/workbook_merge.py` | Shared stable row identity and business hashes, tombstones, conflict archives, deterministic client merge rules, derived-value recomputation, and a persistent identity map for legacy rows. New service writes receive UUIDs before save. |
| `services/workbook_headers.py` | Shared alias-aware, case-insensitive Excel header normalization, lookup, and row mapping used by imports and migrations. |
| `services/settings_data/workbook_export.py` | Single workbook exports and bundled ZIP export, including transfer data. |
| `services/excel_utils.py` | Shared workbook initialization, row-to-dict iteration, mutation locking, compact `YYYY-MM-DD HHMMSSffffff` backup timestamps for automatic, import, and corrupted snapshots, local recovery-snapshot fallback when the configured shared backup root fails, save/close handling, atomic safety-copy refresh within the shared data folder, and safe loading/recovery. |
| `services/path_utils.py` | Resolves `FINLEDGE_DATA_DIR` including `auto` and environment-variable paths; development defaults to `.finledge-dev-data/FinLedge Data`, while Electron supplies the Windows active path, and startup can resolve without creating the child folder before backups finish. |
| `services/data_migration_service.py` | Performs backup, staging, validation, and atomic replacement for schema upgrades. Its background metadata worker preserves valid IDs/audit values, retries locked/changed files, and records a versioned migration marker. |
| `services/metadata_backfill_service.py` | Runs per-workbook metadata upgrades in a daemon after API startup, records resumable progress in the shared sync directory, coordinates with service locks, syncs verified upgrades, and resumes guarded legacy-root cleanup. |
| `services/shared_sync_service.py` | Periodically merges each EXE/AppX working workbook with the channel's shared sync workbook under a cross-process lock; uses optimistic fingerprints, atomic staged replacement, compact recovery snapshots, deterministic journal event IDs, and a change fingerprint to skip no-op scans. Stale-lock owner checks use `OpenProcess` on Windows and signal probing on POSIX. |
| `services/data_directory_service.py` | Validates and backs up legacy workbooks from supplied roots and their `FinLedge Data` children, including partial workbook sets and legacy filenames such as `bank.xlsx`/`share.xlsx`; uses short `YYYY-MM-DD HHMM` migration folders and `src/<index>/<original filename>` / `dest/<original filename>` children. Before removing selected root-level files it independently opens and verifies backups, checks destination structure, rows, Row IDs and hashes, and persists an atomic restartable cleanup manifest. Other source files are retained. |
| `services/workbook_initialization.py` | Creates missing Bank, Share, Personal Expenses, and transfer workbooks through their owning services during data-folder preparation. |
| `tests/__init__.py` | Python package marker for backend tests. |
| `tests/conftest.py` | Uses pytest's session temp factory for isolated workbook data and redirects Python scratch files into the same pytest-managed temporary root. |
| `tests/test_auto_backups.py` | Isolated tests for automatic snapshots, retention, recovery, and concurrent writes. |
| `tests/test_phase2_personal_finance.py` | Regression checks for Personal Expenses module boundaries and totals. |
| `tests/test_bank.py` | Bank Services route and service behavior tests. |
| `tests/test_concurrency.py` | Concurrent backend reads/writes and corrupted workbook recovery tests. |
| `tests/test_data_directory_service.py` | Temporary-directory tests for empty destination recovery, old-header merges, backup/copy/validation failures, interrupted migration and cleanup recovery, legacy source cleanup, and no re-import. |
| `tests/test_path_utils.py` | Confirms auto-mode and environment-token paths resolve only inside temporary test folders. |
| `tests/test_transfer_import.py` | `tmp_path`-isolated transfer import/export, legacy-sheet migration, overdraft, update, flow-move safety, and concurrency regressions. |
| `tests/test_workbook_merge.py` | `tmp_path`-isolated row identity, duplicate legacy IDs across client orderings, hash, tombstone, conflict, two-client merge, and source-preservation coverage. |
| `tests/test_metadata_backfill_service.py` | `tmp_path` tests for legacy/partial metadata, stable duplicate IDs across EXE/AppX, valid metadata preservation, locked files, failed backups/commits, and concurrent user edits. |
| `tests/test_shared_sync_service.py` | `tmp_path` tests for separate client workbooks converging through the shared folder, latest-edit conflict handling, concurrent sync, and idempotent journal entries. |
| `tests/test_personal_finance.py` | Personal Expenses and transfer behavior tests. |
| `tests/test_settings.py` | Settings import/export behavior tests. |
| `tests/test_share.py` | Share Portfolio route and service behavior tests. |

Backend layering rule: routes call services; services own workbook paths and I/O.
When a service grows across concerns, split internal helpers into focused service
modules while preserving a clear route-facing service API.

The root `.gitignore` ignores test directories, including `backend/tests/` and
`desktop/tests/`, while explicitly exposing the focused regression files used by the
desktop track. `frontendwebapp/.gitignore` leaves `scripts/smoke-test.js` visible to
Git so the frontend `npm test` command is available from a checkout.

## Electron shell: `desktop/`

```text
desktop/
├── main.js
├── preload.js
├── package.json
├── package-lock.json
├── appx-package-config.json
├── dist/                      Standard ignored Electron Builder output for release and test packages
├── artifacts/                 Legacy ignored output retained from earlier packaging attempts
├── assets/
│   ├── appx/                 Generated Store tile logos (build resources)
│   ├── finledge_icon.ico
│   └── finledge_icon.png
├── services/
│   ├── childProcessManager.js
│   ├── testUpdatePolicy.js
│   ├── test-update-policy.example.json
│   ├── dataDirectory.js
│   ├── dataDirectoryRuntime.js
│   ├── dataFolderMigration.js
│   ├── appxPaths.js
│   ├── iconAssets.js
│   ├── logger.js
│   ├── desktopShortcutManager.js
│   ├── rendererPromptManager.js
│   ├── runtimeConfig.js
│   ├── repositoryConfig.js
│   ├── updatePolicyService.js
│   └── windowManager.js
├── ipc/
│   ├── dataHandlers.js
│   └── updateHandlers.js
├── tests/
│   ├── dataDirectory.test.cjs
│   ├── preload.test.cjs
│   ├── runtimeConfig.test.cjs
│   └── repositoryConfig.test.cjs
├── utils/
│   └── updateMetadata.js
└── scripts/
    ├── build-sidecar.ps1
    ├── generate-sidecar-version.py
    ├── generate-appx-assets.ps1
    └── mark-build-channel.js
```

| Path | Responsibility |
|---|---|
| `main.js` | Electron composition root: creates runtime services, opens the frontend while the sidecar prepares data, coordinates startup phases, and manages app startup and shutdown. |
| `preload.js` | Exposes the limited `financialTracker` bridge, resolves/caches the backend port through IPC, accepts port changes after a failed launch attempt, and reports the renderer's first paint. |
| `package.json` / `package-lock.json` | Electron dependencies and desktop packaging configuration. |
| `appx-package-config.json` | AppX identity placeholders, required capability, and four-part version setting. |
| `dist/` | Standard Git-ignored Electron Builder output. Production and combined local test builds use this same folder; test packages are marked and named separately. |
| `artifacts/` and `dist-*/` | Legacy Git-ignored output retained from earlier packaging attempts; new builds do not use these folders. |
| `assets/` | Desktop application icons and generated AppX tile assets. |
| `assets/appx/` | Store/tile logos plus 42 target-size AppX icons: default, dark-theme unplated, and light-theme unplated images for sizes 16 through 256px. Generated during desktop builds. |
| `services/dataDirectory.js` | Resolves `FINLEDGE_DATA_DIR=auto` or portable environment-variable overrides, defaults development to `.finledge-dev-data/FinLedge Data` and packaged EXE/testing roots to Roaming, and provides saved-folder preferences, build labels, and data-directory locks. |
| `services/dataDirectoryRuntime.js` | Resolves separate active workbook folders for each client: EXE under `%APPDATA%/Finledge[/Finledge Testing EXE]/FinLedge Data`, AppX under its package user-data root, and development under `.finledge-dev-data`. EXE/AppX share a channel sync/recovery directory under `%APPDATA%/Finledge[/Finledge Testing EXE]/FinLedge Data Shared`; legacy EXE/AppX/old Documents paths are migration-only. Settings and dashboard requests use the active client path, and preparation errors do not switch workbooks. |
| `services/dataFolderMigration.js` | Copies default-root workbooks (including legacy bank/share filenames) and existing backups into the dedicated `FinLedge Data` child folder after making a timestamped source backup; never removes source files. |
| `services/appxPaths.js` | Resolves AppX package family/AUMID identity and discovers old production or Testing package-roaming folders for migration; active workbooks use the same `%APPDATA%` path returned to Settings. |
| `services/runtimeConfig.js` | Loads source-mode environment settings and packaged markers/config, resolves updater settings, and selects available local ports for each build channel. |
| `services/repositoryConfig.js` | Resolves public GitHub owner/repository values from environment overrides, Vite-generated packaged config, or desktop package metadata; builds latest, tagged-release, and update-policy URLs. |
| `services/childProcessManager.js` | Starts the single Python sidecar and app-owned Vite server, polls backend health every 100ms with a 300ms request timeout, parses migration reports and data-ready output into the desktop log, verifies the backend with a per-launch secret token, and stops child process trees at shutdown. |
| `services/testUpdatePolicy.js` | Creates the local update-notice policy directory for test builds only, preferring the Git-ignored workspace folder and falling back to app-specific user data. |
| `services/test-update-policy.example.json` | Tracked starter update-notice policy copied to a test build's ignored local policy file when absent. |
| `services/windowManager.js` | Creates the Electron window and build-labeled startup splash and handles renderer navigation. |
| `services/iconAssets.js` | Creates the branded fallback PNG when the desktop icon asset is unavailable. |
| `services/logger.js` | Writes desktop process logs to the operating-system temporary directory and console. |
| `services/desktopShortcutManager.js` | Offers a per-AppX-version optional desktop shortcut, checks for an existing link before asking, remembers a decline until the next package version, and refreshes shortcuts with an Explorer-accessible icon path. |
| `services/rendererPromptManager.js` | Sends first-run shortcut prompts to the React window and resolves the user's response over IPC. |
| `services/updatePolicyService.js` | Fetches update policy for EXE releases, optional EXE-to-Store prompts, and production Store AppX update notices; tracks update status and development simulations. |
| `ipc/dataHandlers.js` | Registers IPC actions for data folder selection, data file locations (including the transfer workbook), opening data, and saving exports; AppX working-data display/open targets resolve to their package physical path, while backup display/open targets retain the shared channel backup path passed to Python. |
| `ipc/updateHandlers.js` | Registers IPC actions for refresh, version and update status, and release links. |
| `tests/dataDirectory.test.cjs` | Isolated tests for auto/custom data-folder resolution, separate EXE/AppX active paths plus one Roaming sync folder, old EXE/AppX migration sources, shared recovery paths, Settings IPC display/open parity, safe update links, write failures, and client locks. |
| `tests/preload.test.cjs` | Confirms preload gets the selected backend port through IPC once and caches it. |
| `tests/runtimeConfig.test.cjs` | Isolated tests for packaged build-channel markers, runtime mode, legacy AppX marker compatibility, and environment-configured updater URLs. |
| `tests/repositoryConfig.test.cjs` | Tests repository defaults/overrides, latest and tagged release URL construction, and packaged configuration without a root `.env`. |
| `utils/updateMetadata.js` | Pure helpers for release notes, version comparison, and release URLs. |
| `scripts/build-sidecar.ps1` | Packages the Python backend as an onedir sidecar, excludes unused Matplotlib/NumPy/PIL/Tkinter modules, includes shared transfer direction rules, and avoids recursively bundling the ignored test suite. |
| `scripts/generate-sidecar-version.py` | Generates Python sidecar Windows version resources from the root FinLedge version and publisher metadata. |
| `scripts/generate-appx-assets.ps1` | Generates Store tile logos, target-size unplated AppX icon variants, and transparent 16/32/48/256px EXE icon frames from canonical `assets/finledge_icon.png`. |
| `scripts/mark-build-channel.js` | Writes the packaged build-channel marker for Testing packages and Store-targeted production AppX packages. |

## Renderer: `frontendwebapp/src/`

This React application is loaded by desktop and is also consumed by the separate
mobile runtime. Treat it as shared runtime code: keep desktop-specific integration in
the Electron bridge and avoid adding desktop assumptions to shared page components.

```text
frontendwebapp/src/
├── App.jsx
├── main.jsx
├── styles.css
├── api/
│   ├── bankApi.js
│   ├── client.js
│   ├── personalFinanceApi.js
│   ├── settingsApi.js
│   └── shareApi.js
├── components/
│   ├── BankForm.jsx
│   ├── BarChart.jsx
│   ├── ConfirmDialog.jsx
│   ├── DeleteConfirmationDialog.jsx
│   ├── ShortcutPrompt.jsx
│   ├── DashboardPeriodFilter.jsx
│   ├── InteractiveTimelineChart.jsx
│   ├── OnboardingTour.jsx
│   ├── PersonalFinanceForm.jsx
│   ├── ResultPanel.jsx
│   ├── ShareForm.jsx
│   ├── StatGrid.jsx
│   ├── StatusNotice.jsx
│   ├── TransactionFilters.jsx
│   ├── TransactionsTable.jsx
│   └── UpdateNotice.jsx
├── constants/options.js
├── constants/transferDirections.js
├── hooks/
│   ├── useDashboardPeriod.js
│   ├── useDeleteConfirmation.js
│   └── useDismissibleMessage.js
├── pages/
│   ├── BankDashboard.jsx
│   ├── BankPage.jsx
│   ├── Home.jsx
│   ├── PersonalFinanceDashboard.jsx
│   ├── PersonalFinanceHome.jsx
│   ├── PersonalFinancePage.jsx
│   ├── PersonalFinanceTransferPage.jsx
│   ├── Settings.jsx
│   ├── settings/
│   │   ├── AboutSettingsSection.jsx
│   │   ├── BackupSettingsSection.jsx
│   │   ├── GeneralSettingsSection.jsx
│   │   ├── HowToUseSettingsSection.jsx
│   │   ├── ImportExportSettingsSection.jsx
│   │   ├── InvestmentSettingsSection.jsx
│   │   ├── PrivacySettingsSection.jsx
│   │   ├── SettingsPanels.jsx
│   │   ├── VersionSettingsSection.jsx
│   │   └── settingsConstants.js
│   ├── ShareDashboard.jsx
│   ├── SharePage.jsx
│   └── Summary.jsx
└── utils/
    ├── dashboardPeriod.js
    ├── date.js
    ├── format.js
    ├── forms.js
    ├── history.js
    ├── personalFinance.js
    └── summaries.js
```

| Path/group | Responsibility |
|---|---|
| `App.jsx` | Route definitions, top-level navigation, shared layout, desktop-logo connecting state while backend health is pending, startup first-paint reporting, and one-time backend category option refresh. Dashboard, Summary, and Settings routes load lazily. |
| `main.jsx` | React application bootstrap. |
| `styles.css` | Shared renderer styles. |
| `api/client.js` | HTTP wrapper and asynchronous desktop/web API base URL selection; request payload logging is development-only. |
| `api/bankApi.js` | Bank Services API calls. |
| `api/shareApi.js` | Share Portfolio API calls with shared add/update payload validation and shaping; payload logging is development-only. |
| `api/personalFinanceApi.js` | Personal Expenses and transfer API calls. |
| `api/settingsApi.js` | Workbook import/export API calls. |
| `components/BankForm.jsx`, `ShareForm.jsx`, `PersonalFinanceForm.jsx` | Reusable module entry forms. |
| `components/BarChart.jsx`, `InteractiveTimelineChart.jsx` | Shared chart displays. |
| `components/StatusNotice.jsx` | Reusable timed, dismissible overlay for errors and status messages; desktop notices auto-dismiss and always provide a close button. |
| `components/DashboardPeriodFilter.jsx` | Reusable week/month/year/custom dashboard range selector with a viewport margin and custom popover dismissal on outside click or Escape. |
| `components/TransactionFilters.jsx` | Reusable transaction search and category selector. |
| `components/StatGrid.jsx`, `TransactionsTable.jsx` | Shared summary metrics and transaction history. |
| `components/ConfirmDialog.jsx` | Reusable destructive-action confirmation dialog. |
| `components/DeleteConfirmationDialog.jsx` | Shared record-delete dialog wiring for selected row, busy state, cancel, and confirmation. |
| `components/ShortcutPrompt.jsx` | Desktop-bridge-only in-app shortcut prompt; it renders nothing in the mobile runtime. |
| `components/ResultPanel.jsx` | Reusable result/status panel. |
| `components/OnboardingTour.jsx` | Onboarding tour UI (currently disabled in app routing). |
| `components/UpdateNotice.jsx` | Desktop update notification UI, including the Store-managed AppX update handoff and optional EXE-to-Store prompt; development preview reads its public release link from Vite environment config. |
| `constants/options.js` | Shared dropdown choices, refreshed from the backend category metadata endpoint; transfer direction options come from common direction rules. |
| `constants/transferDirections.js` | Renderer helpers for normalizing transfer directions and reading their origin/destination flows from the shared JSON rules. |
| `hooks/useDashboardPeriod.js` | Shared dashboard period state and record filtering. |
| `hooks/useDeleteConfirmation.js` | Shared pending row, in-flight delete id, and serialized delete action state for dashboard and entry pages. |
| `hooks/useDismissibleMessage.js` | Shared notice timeout lifecycle used by `StatusNotice`. |
| `pages/Home.jsx` | Home module launcher. |
| `pages/BankPage.jsx`, `BankDashboard.jsx` | Bank Services entry and dashboard screens. |
| `pages/SharePage.jsx`, `ShareDashboard.jsx` | Share Portfolio entry and dashboard screens. |
| `pages/PersonalFinanceHome.jsx` | Personal Expenses module launcher. |
| `pages/PersonalFinancePage.jsx`, `PersonalFinanceDashboard.jsx` | Personal Expenses entry and dashboard screens; transfer receiver rows use the canonical direction helpers. |
| `pages/PersonalFinanceTransferPage.jsx` | Bank/Cash transfer entry and history screen using canonical direction options. |
| `pages/Summary.jsx` | Financial Summary analytics screen. |
| `pages/Settings.jsx` | Settings navigation and state orchestration; imports stay on the current Settings section and show the import result there. Conditional error messages omit raw filesystem paths. |
| `pages/settings/` | Focused Settings sections for general data paths, import/export, backup, about/help, and version panels; keeps each view independently maintainable. |
| `pages/settings/settingsConstants.js` | Settings navigation labels and reusable file-location row definitions. |
| `pages/settings/GeneralSettingsSection.jsx` | Shows data paths, build type, folder selection errors, and first-run setup status. |
| `pages/settings/ImportExportSettingsSection.jsx` | Workbook selection, validation feedback, merge/replace choice, and export actions. |
| `pages/settings/BackupSettingsSection.jsx` | Automatic backup folder location and open-folder action. |
| `pages/settings/AboutSettingsSection.jsx` | Product/module information and current version details, with content scrolling inside the panel. |
| `pages/settings/HowToUseSettingsSection.jsx` | Usage guidance and import/export help, with content scrolling inside the panel. |
| `pages/settings/VersionSettingsSection.jsx` | Current version display and update check action for EXE and production Store AppX builds. |
| `pages/settings/InvestmentSettingsSection.jsx`, `PrivacySettingsSection.jsx` | Placeholder panels for Settings sections not yet available. |
| `pages/settings/SettingsPanels.jsx` | Shared placeholder and disabled Settings panel components. |
| `utils/date.js`, `utils/format.js` | Shared date and display formatting helpers; day/month grouping keys use local date parts to avoid UTC date shifts. |
| `utils/history.js` | Orders history newest-first by transaction date, creation timestamp, and last update timestamp. |
| `utils/dashboardPeriod.js` | Dashboard range boundaries, period filtering, and daily/monthly chart buckets. |
| `utils/personalFinance.js` | Personal Finance source/direction labels and transfer receiver row expansion shared by entry and dashboard screens. |
| `utils/forms.js` | Shared form reset helper for clearing amount and description while preserving other values. |
| `utils/summaries.js` | Shared Bank, Share, and Personal Finance record summary calculations used by Summary and module dashboards. |

## Root scripts and release files

| Path | Responsibility |
|---|---|
| `scripts/finledge.mjs` | Root command runner for backend, frontend, and desktop build flows; combined Testing packages stage under the system temporary directory before copying final artifacts to `desktop/dist/`. |
| Root npm aliases `desktop-build`, `desktop-build:test` | Build production packages or both separately identified local test packages in one run. |
| `frontendwebapp/scripts/smoke-test.js` | Frontend `npm test` checks built artifacts and local day/month grouping across timezone offsets. |
| `scripts/migrate_v1_2_0.py` | CLI for the legacy workbook migration. |
| `scripts/refresh-latest-yml.mjs` | Refreshes desktop updater metadata. |
| `scripts/start-release.mjs` | Prepares a release using the repository's release workflow. |
| `scripts/sync-version.mjs` | Synchronizes version values and derives version-specific update-policy links from desktop repository metadata. |
| `frontendwebapp/vite.config.js` | Reads root build settings, uses the shared repository resolver, embeds public release settings, and emits packaged public config. |
| `scripts/verify-version.mjs` | Checks version consistency. |
| `.github/workflows/desktop-release.yml` | Builds and publishes desktop release artifacts. |
| `package.json` / `package-lock.json` | Root scripts and tooling dependencies; some commands are shared with other tracks. |
| `desktop-update-policy.json` | Desktop updater policy. `appxLatestVersion` and `appxFallbackUrl` govern Store AppX notices; `storeProductId` can target the Store listing; `exeStoreMigration.enabled` stays false until an optional EXE-to-Store switch is announced. |
| `update-policy.json` | Backward-compatible update policy for older desktop clients. |

## Desktop documentation

| Path | Responsibility |
|---|---|
| `docs/desktop-tasks.md` | Desktop phase checklist and dated progress log. |
| `docs/desktop-codebase.md` | This desktop-specific architecture and file map. |
| `docs/desktop-appx-testing.md` | Certificate setup, test identities, the combined AppX/NSIS test build, and install instructions. |
| `docs/desktop-appx-audit.md` | Desktop-only AppX findings, root cause, changes, validation, and Windows limitations. |
| `docs/desktop-backend-audit-phase0.md` | Desktop backend organization audit and Phase 1 implementation record. |

`AGENTS.md`, `CODEBASE.md`, `PLAN.md`, and `TASKS.md` are shared with the mobile
track in this checkout. Read them as needed, but keep desktop-only architecture and
progress notes in the desktop-specific files above.

## Maintenance rule

Whenever desktop work adds, deletes, renames, or moves a file or folder, update this
map in the same change. Add a short responsibility description for each new file or
group. For files shared across tracks, describe only the desktop boundary and avoid
rewriting shared architecture documents. Keep the tree synchronized with the actual
repository; do not record build outputs, caches, or local data folders.

## Runtime configuration and data location

- The root `.env.example` is the public desktop configuration template. Copy it to
  an ignored root `.env` for source/development runs; never put credentials or
  signing secrets in `.env.example` or frontend `VITE_*` variables.
- The variable-by-variable reader, default, and restart guide is in
  `docs/desktop-environment.md`; `.env.example` documents app settings and build
  credentials with blank placeholders, so no secrets are committed.
- `FINLEDGE_DATA_DIR=auto` selects each client's active workbook folder. Development
  shares `.finledge-dev-data/FinLedge Data` between Electron and Python. Testing EXE
  uses `%APPDATA%/Finledge Testing EXE/FinLedge Data`; Testing AppX uses its package
  user-data folder; production EXE uses `%APPDATA%/Finledge/FinLedge Data`; production
  AppX uses its package user-data folder. Dashboard, History, reports, imports, and
  Settings all use the active path for that client. EXE and AppX synchronize through
  `%APPDATA%/Finledge Testing EXE/FinLedge Data Shared` in Testing or
  `%APPDATA%/Finledge/FinLedge Data Shared` in production. Backups, identity mapping,
  sync journal, and recovery data live inside that channel folder.
- Startup validates and backs up recognized older workbook files before migration,
  initializes missing workbooks header-only, then merges through the shared sync
  directory. Metadata backfill and synchronization run in daemon workers after the
  API starts. Only selected legacy root-level workbooks are eligible for cleanup, and
  only after their exact backup opens and validates, the migrated rows/IDs/hashes are
  confirmed in the active and shared workbooks, and a persistent cleanup manifest is
  committed. Each source's backup, active workbook, and shared synchronization workbook
  are independently verified before removal. Sync checkpoints advance only after both
  directions succeed and the final local/shared fingerprints still match. The manifest
  resumes cleanup after interruption; unrelated files remain.
- An explicit Windows path can use `%USERPROFILE%`, `%APPDATA%`, or `%LOCALAPPDATA%`;
  Electron and Python expand these tokens. Former Documents and package-redirected
  AppX roots remain migration candidates. Active files are not redirected to Documents.
  AppX package discovery follows the actual build channel: production scans production
  package roots, Testing scans Testing roots, and explicit legacy candidates are filtered
  against the opposite channel's package roots. Development discovery remains unchanged.
  Each app holds a lock for its own active directory; a separate cross-process lock
  serializes merges through the channel sync directory so either client can keep
  running while the other synchronizes edits.
- `FINLEDGE_GITHUB_OWNER` and `FINLEDGE_GITHUB_REPO` can override the public GitHub
  repository. Empty values derive from `desktop/package.json`. `VITE_FINLEDGE_RELEASES_URL`
  and `FINLEDGE_UPDATE_POLICY_URL` can override the derived public links. Vite emits
  the resolved public values to `frontendwebapp/dist/finledge-public-config.json`,
  which electron-builder includes in packaged resources. Installed apps therefore do
  not depend on a root `.env`.
- Electron resolves the active data folder once from `FINLEDGE_DATA_DIR`, a saved
  Settings choice, or the build default. It initializes and locks that client folder,
  reports it to Settings through IPC, opens that same folder, and passes the absolute
  path to Python as `FINLEDGE_DATA_DIR`. Python services derive all five workbook paths
  and Settings import/export from that value. Startup migration and initialization run
  before requests are accepted; metadata backfill and sync run afterward. Choosing
  another folder restarts the backend with the new active path.
- `desktop/ipc/dataHandlers.js` reports and opens the same active workbook paths that
  Electron passes to Python. `desktop/services/clientInstanceLock.js` prevents duplicate
  instances per client. The shared sync lock serializes only synchronization writes;
  the clients keep their own working workbook files.
- AppX Settings resolves its active workbook directory to the package's actual
  `LocalCache\Roaming` path. Its backup display and Open Backup Folder target keep the
  channel's shared Roaming `FinLedge Data Shared\Backups\auto` path unchanged, matching
  `FINLEDGE_BACKUP_DIR` used for backup creation and restoration by Python.
- Before starting Python, Electron creates and checks the migration-snapshot child of
  the selected backup folder as well as the backup and safety-copy roots. Migration
  therefore fails during the visible storage preflight if that nested recovery path is
  unavailable, rather than exiting later while preparing a workbook.
- Standalone Python launched outside Electron uses the same fallback per mode:
  development uses the repository `.finledge-dev-data/FinLedge Data`, Testing uses
  `%APPDATA%/Finledge Testing EXE/FinLedge Data`, and production uses
  `%APPDATA%/Finledge/FinLedge Data`. Electron passes each client's resolved working
  path and shared sync path explicitly.
  `FINLEDGE_PROJECT_ROOT`, `FINLEDGE_BACKUP_DIR`, and
  `FINLEDGE_SAFETY_COPY_DIR`, `FINLEDGE_SHARED_SYNC_DIR`, and
  `FINLEDGE_DATA_DIR_IS_MANAGED` are internal Electron-to-backend values. Electron
  directs snapshots, identity mapping, journal, and recovery copies to the channel's
  Roaming sync directory and marks managed defaults for safe migration. Do not set
  separate paths for desktop.
- Intentional public repository references: `desktop/package.json`'s `repository.url`
  is the canonical packaged default and electron-builder derives GitHub publisher
  coordinates from it. `desktop-update-policy.json` and
  `update-policy.json` retain full release URLs because they are published payloads
  consumed by current and older clients and must preserve latest versus version-tagged
  destinations; `scripts/sync-version.mjs` now derives version-specific links from
  package metadata. `README.md` and `CODE_SIGNING.md` keep direct links for cloning and
  setup instructions. These are public links, not credentials. Ignored local test
  policy files are user-local configuration and are left untouched.
