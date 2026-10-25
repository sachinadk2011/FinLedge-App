# Desktop Codebase Map

Last reviewed: 2026-10-25

This is the desktop-track file map. Keep it separate from `CODEBASE.md`, which is
shared with the mobile track. The frontend and several root scripts are consumed by
more than one platform; their entries are documented here from the desktop build's
point of view. Avoid mobile-only paths and behavior in this file.

## Top-level desktop shape

```text
tracker financial/
├── backend/                 Python API and Excel-backed desktop data services
├── desktop/                 Electron shell, preload bridge, and sidecar packaging
├── frontendwebapp/          React UI loaded by the desktop shell
├── scripts/                 Root development, build, migration, and release tools
├── .github/workflows/       Desktop release automation
├── docs/                    Desktop-only planning and architecture notes
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
│   ├── personal_finance.py
│   ├── settings.py
│   ├── share.py
│   └── summary.py
├── services/
│   ├── __init__.py
│   ├── bank_service.py
│   ├── data_directory_service.py
│   ├── data_migration_service.py
│   ├── excel_utils.py
│   ├── path_utils.py
│   ├── personal_finance_service.py
│   ├── personal_finance_summary.py
│   ├── personal_finance_transfers.py
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
    ├── test_personal_finance.py
    ├── test_settings.py
    └── test_share.py
```

| Path | Responsibility |
|---|---|
| `main.py` | Creates the FastAPI application, runs startup migration, and registers routes. |
| `engine_main.py` | Prepares and reports data-folder migration before starting the desktop API server. |
| `__init__.py` | Python package marker for backend imports. |
| `models.py` | Request validation models and enums shared across API modules. |
| `routes/__init__.py`, `services/__init__.py` | Python package markers for route and service imports. |
| `routes/bank.py` | Bank Services HTTP endpoints. |
| `routes/share.py` | Share Portfolio HTTP endpoints. |
| `routes/personal_finance.py` | Personal Expenses and transfer HTTP endpoints. |
| `routes/summary.py` | Financial Summary HTTP endpoints. |
| `routes/settings.py` | Workbook import/export HTTP endpoints. |
| `services/settings_data/__init__.py` | Package marker for focused Settings data helpers. |
| `services/bank_service.py` | Bank Services workbook I/O, record operations, and totals. |
| `services/share_service.py` | Share Portfolio workbook I/O and transaction recalculation, preserving the existing route-facing API. |
| `services/share_summary.py` | Pure aggregate calculations for Share Portfolio records, shared by the Share and Financial Summary routes. |
| `services/personal_finance_service.py` | Personal Expenses Bank/Cash workbook operations, live sync shaping, route-facing transfer compatibility functions, and copy-only repair of rows saved under the former generic sheet name. |
| `services/personal_finance_summary.py` | Pure Personal Expenses summary calculations and module/category filtering rules. |
| `services/personal_finance_transfers.py` | Transfer workbook CRUD and shaping of Bank/Cash transfer rows; the existing service file keeps its route-facing compatibility functions. |
| `services/share_lot_calculations.py` | FIFO share-lot construction, cost basis, and lot consumption calculations. |
| `services/summary_graph_service.py` | Builds Financial Summary chart data from module services. |
| `services/settings_service.py` | Stable compatibility facade for Settings workbook operations used by API routes. |
| `services/settings_data/config.py` | Canonical workbook paths, headers, and exact sheet mappings for Bank Services, Share Portfolio, Personal Expenses Bank/Cash Flow, and transfers. |
| `services/settings_data/normalization.py` | Legacy header/category aliases and import normalization rules, including transfer direction aliases. |
| `services/settings_data/workbook_import.py` | Module-specific workbook validation, row mapping, backup-before-import, and import operations; rejects recognizable cross-module workbooks. |
| `services/settings_data/workbook_export.py` | Single workbook exports and bundled ZIP export, including transfer data. |
| `services/excel_utils.py` | Reusable Excel helpers, safe loading/recovery, readable timestamp formatting, and pre-write snapshots; recovery and retention work with legacy and current backup filenames. |
| `services/path_utils.py` | Resolves the backend data directory from the Electron override or platform default. |
| `services/data_migration_service.py` | Performs non-destructive workbook data migrations. |
| `services/data_directory_service.py` | Validates, backs up, merges, and recovers legacy workbooks into `FinLedge Data`; removes a legacy workbook only after its backup and destination are verified, then records a migration report. |
| `services/workbook_initialization.py` | Creates missing Bank, Share, Personal Expenses, and transfer workbooks through their owning services during data-folder preparation. |
| `tests/__init__.py` | Python package marker for backend tests. |
| `tests/conftest.py` | Points backend tests at an isolated temporary data directory. |
| `tests/test_auto_backups.py` | Isolated tests for automatic snapshots, retention, recovery, and concurrent writes. |
| `tests/test_phase2_personal_finance.py` | Regression checks for Personal Expenses module boundaries and totals. |
| `tests/test_bank.py` | Bank Services route and service behavior tests. |
| `tests/test_concurrency.py` | Concurrent backend reads/writes and corrupted workbook recovery tests. |
| `tests/test_data_directory_service.py` | Temporary-directory tests for safe workbook copying, idempotence, and non-empty destinations. |
| `tests/test_personal_finance.py` | Personal Expenses and transfer behavior tests. |
| `tests/test_settings.py` | Settings import/export behavior tests. |
| `tests/test_share.py` | Share Portfolio route and service behavior tests. |

Backend layering rule: routes call services; services own workbook paths and I/O.
When a service grows across concerns, split internal helpers into focused service
modules while preserving a clear route-facing service API.

The root `.gitignore` ignores test directories, including `backend/tests/` and
`desktop/tests/`, to preserve the repository's existing policy of keeping tests local.

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
│   ├── dataDirectory.js
│   ├── dataDirectoryRuntime.js
│   ├── dataFolderMigration.js
│   ├── appxPaths.js
│   ├── iconAssets.js
│   ├── logger.js
│   ├── desktopShortcutManager.js
│   ├── rendererPromptManager.js
│   ├── runtimeConfig.js
│   ├── updatePolicyService.js
│   └── windowManager.js
├── ipc/
│   ├── dataHandlers.js
│   └── updateHandlers.js
├── tests/
│   ├── dataDirectory.test.cjs
│   └── runtimeConfig.test.cjs
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
| `main.js` | Electron composition root: creates runtime services, registers IPC groups, and coordinates app startup and shutdown. |
| `preload.js` | Exposes the limited `financialTracker` bridge to the renderer. |
| `package.json` / `package-lock.json` | Electron dependencies and desktop packaging configuration. |
| `appx-package-config.json` | AppX identity placeholders, required capability, and four-part version setting. |
| `dist/` | Standard Git-ignored Electron Builder output. Production and combined local test builds use this same folder; test packages are marked and named separately. |
| `artifacts/` and `dist-*/` | Legacy Git-ignored output retained from earlier packaging attempts; new builds do not use these folders. |
| `assets/` | Desktop application icons and generated AppX tile assets. |
| `assets/appx/` | Store/tile logos plus 42 target-size AppX icons: default, dark-theme unplated, and light-theme unplated images for sizes 16 through 256px. Generated during desktop builds. |
| `services/dataDirectory.js` | Resolves development and isolated test data to app-specific Electron user-data folders and production data to Documents, with explicit overrides, write checks, saved folder preference, build labels, and cross-build lock. |
| `services/dataDirectoryRuntime.js` | Resolves the shared `FinLedge Data` child folder for default installs, supplies a sibling backup path, starts backend migration, and owns fallback handling and data-directory locks. |
| `services/dataFolderMigration.js` | Copies default-root workbooks (including legacy bank/share filenames) and existing backups into the dedicated `FinLedge Data` child folder after making a timestamped source backup; never removes source files. |
| `services/appxPaths.js` | Resolves AppX package family/AUMID identity and translates app-container user-data paths to physical LocalCache paths when Windows Explorer opens files or reads shortcut icons. |
| `services/runtimeConfig.js` | Loads environment settings and the packaged build-channel marker, then resolves desktop hosts, ports, mode, update policy, and Python executable. |
| `services/childProcessManager.js` | Starts and stops the Python sidecar and Vite development server, waits for local HTTP readiness, and selects the renderer URL. |
| `services/windowManager.js` | Creates the Electron window and build-labeled startup splash and handles renderer navigation. |
| `services/iconAssets.js` | Creates the branded fallback PNG when the desktop icon asset is unavailable. |
| `services/logger.js` | Writes desktop process logs to the operating-system temporary directory and console. |
| `services/desktopShortcutManager.js` | Offers a per-AppX-version optional desktop shortcut, checks for an existing link before asking, remembers a decline until the next package version, and refreshes shortcuts with an Explorer-accessible icon path. |
| `services/rendererPromptManager.js` | Sends first-run shortcut prompts to the React window and resolves the user's response over IPC. |
| `services/updatePolicyService.js` | Fetches update policy for EXE releases, optional EXE-to-Store prompts, and production Store AppX update notices; tracks update status and development simulations. |
| `ipc/dataHandlers.js` | Registers IPC actions for data folder selection, data file locations, opening data, and saving exports. |
| `ipc/updateHandlers.js` | Registers IPC actions for refresh, version and update status, and release links. |
| `tests/dataDirectory.test.cjs` | Isolated tests for data-folder defaults, write failures, and lock behavior. |
| `tests/runtimeConfig.test.cjs` | Isolated tests for packaged build-channel markers, runtime mode, and legacy AppX marker compatibility. |
| `utils/updateMetadata.js` | Pure helpers for release notes, version comparison, and release URLs. |
| `scripts/build-sidecar.ps1` | Packages the Python backend sidecar using statically discovered backend imports without recursively bundling the ignored test suite. |
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
├── hooks/
│   ├── useDashboardPeriod.js
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
    └── format.js
```

| Path/group | Responsibility |
|---|---|
| `App.jsx` | Route definitions, top-level navigation, and shared layout. |
| `main.jsx` | React application bootstrap. |
| `styles.css` | Shared renderer styles. |
| `api/client.js` | HTTP wrapper and desktop/web API base URL selection. |
| `api/bankApi.js` | Bank Services API calls. |
| `api/shareApi.js` | Share Portfolio API calls. |
| `api/personalFinanceApi.js` | Personal Expenses and transfer API calls. |
| `api/settingsApi.js` | Workbook import/export API calls. |
| `components/BankForm.jsx`, `ShareForm.jsx`, `PersonalFinanceForm.jsx` | Reusable module entry forms. |
| `components/BarChart.jsx`, `InteractiveTimelineChart.jsx` | Shared chart displays. |
| `components/StatusNotice.jsx` | Reusable timed, dismissible overlay for errors and status messages without changing page layout. |
| `components/DashboardPeriodFilter.jsx` | Reusable week/month/year/custom dashboard range selector with custom date inputs. |
| `components/TransactionFilters.jsx` | Reusable transaction search and category selector. |
| `components/StatGrid.jsx`, `TransactionsTable.jsx` | Shared summary metrics and transaction history. |
| `components/ConfirmDialog.jsx` | Reusable destructive-action confirmation dialog. |
| `components/ShortcutPrompt.jsx` | Desktop-bridge-only in-app shortcut prompt; it renders nothing in the mobile runtime. |
| `components/ResultPanel.jsx` | Reusable result/status panel. |
| `components/OnboardingTour.jsx` | Onboarding tour UI (currently disabled in app routing). |
| `components/UpdateNotice.jsx` | Desktop update notification UI, including the Store-managed AppX update handoff and optional EXE-to-Store prompt. |
| `constants/options.js` | Shared categories and dropdown choices. |
| `hooks/useDismissibleMessage.js` | Reusable timed message dismissal behavior. |
| `hooks/useDashboardPeriod.js` | Shared dashboard period state and record filtering; consumes the one-time post-import request to show all dates on the matching module dashboard. |
| `hooks/useDismissibleMessage.js` | Shared notice timeout lifecycle used by `StatusNotice`. |
| `pages/Home.jsx` | Home module launcher. |
| `pages/BankPage.jsx`, `BankDashboard.jsx` | Bank Services entry and dashboard screens. |
| `pages/SharePage.jsx`, `ShareDashboard.jsx` | Share Portfolio entry and dashboard screens. |
| `pages/PersonalFinanceHome.jsx` | Personal Expenses module launcher. |
| `pages/PersonalFinancePage.jsx`, `PersonalFinanceDashboard.jsx` | Personal Expenses entry and dashboard screens. |
| `pages/PersonalFinanceTransferPage.jsx` | Bank/Cash transfer entry and history screen. |
| `pages/Summary.jsx` | Financial Summary analytics screen. |
| `pages/Settings.jsx` | Settings navigation and state orchestration; after imports, records the matching dashboard to reveal all imported dates and reports the saved workbook path. |
| `pages/settings/` | Focused Settings sections for general data paths, import/export, backup, about/help, and version panels; keeps each view independently maintainable. |
| `pages/settings/settingsConstants.js` | Settings navigation labels and reusable file-location row definitions. |
| `pages/settings/GeneralSettingsSection.jsx` | Shows data paths, build type, folder selection errors, and first-run setup status. |
| `pages/settings/ImportExportSettingsSection.jsx` | Workbook selection, validation feedback, merge/replace choice, and export actions. |
| `pages/settings/BackupSettingsSection.jsx` | Automatic backup folder location and open-folder action. |
| `pages/settings/AboutSettingsSection.jsx` | Product/module information and current version details. |
| `pages/settings/HowToUseSettingsSection.jsx` | Usage guidance and import/export help. |
| `pages/settings/VersionSettingsSection.jsx` | Current version display and update check action for EXE and production Store AppX builds. |
| `pages/settings/InvestmentSettingsSection.jsx`, `PrivacySettingsSection.jsx` | Placeholder panels for Settings sections not yet available. |
| `pages/settings/SettingsPanels.jsx` | Shared placeholder and disabled Settings panel components. |
| `utils/date.js`, `utils/format.js` | Shared date and display formatting helpers. |
| `utils/dashboardPeriod.js` | Dashboard range boundaries, period filtering, and daily/monthly chart buckets. |

## Root scripts and release files

| Path | Responsibility |
|---|---|
| `scripts/finledge.mjs` | Root command runner for backend, frontend, and desktop build flows. |
| Root npm aliases `desktop-build`, `desktop-build:test` | Build production packages or both separately identified local test packages in one run. |
| `scripts/migrate_v1_2_0.py` | CLI for the legacy workbook migration. |
| `scripts/refresh-latest-yml.mjs` | Refreshes desktop updater metadata. |
| `scripts/start-release.mjs` | Prepares a release using the repository's release workflow. |
| `scripts/sync-version.mjs` | Synchronizes version values across desktop package files. |
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
