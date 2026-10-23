# Desktop Codebase Map

Last reviewed: 2026-10-23

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
│   ├── data_migration_service.py
│   ├── excel_utils.py
│   ├── path_utils.py
│   ├── personal_finance_service.py
│   ├── personal_finance_summary.py
│   ├── settings_service.py
│   ├── share_lot_calculations.py
│   ├── share_service.py
│   └── summary_graph_service.py
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_auto_backups.py
    ├── test_phase2_personal_finance.py
    ├── test_bank.py
    ├── test_concurrency.py
    ├── test_personal_finance.py
    ├── test_settings.py
    └── test_share.py
```

| Path | Responsibility |
|---|---|
| `main.py` | Creates the FastAPI application, runs startup migration, and registers routes. |
| `engine_main.py` | Starts the API server process used by the desktop runtime. |
| `__init__.py` | Python package marker for backend imports. |
| `models.py` | Request validation models and enums shared across API modules. |
| `routes/__init__.py`, `services/__init__.py` | Python package markers for route and service imports. |
| `routes/bank.py` | Bank Services HTTP endpoints. |
| `routes/share.py` | Share Portfolio HTTP endpoints. |
| `routes/personal_finance.py` | Personal Expenses and transfer HTTP endpoints. |
| `routes/summary.py` | Financial Summary HTTP endpoints. |
| `routes/settings.py` | Workbook import/export HTTP endpoints. |
| `services/bank_service.py` | Bank Services workbook I/O, record operations, and totals. |
| `services/share_service.py` | Share Portfolio workbook I/O and transaction calculations. |
| `services/personal_finance_service.py` | Personal Expenses Bank/Cash Flow and transfer workbook operations and live sync shaping. |
| `services/personal_finance_summary.py` | Pure Personal Expenses summary calculations and module/category filtering rules. |
| `services/share_lot_calculations.py` | FIFO share-lot construction, cost basis, and lot consumption calculations. |
| `services/summary_graph_service.py` | Builds Financial Summary chart data from module services. |
| `services/settings_service.py` | Validates and stages workbook import/export operations. |
| `services/excel_utils.py` | Reusable Excel helpers, safe loading/recovery, timestamps, and pre-write snapshots. |
| `services/path_utils.py` | Resolves the backend data directory and legacy locations. |
| `services/data_migration_service.py` | Performs non-destructive workbook data migrations. |
| `tests/__init__.py` | Python package marker for backend tests. |
| `tests/conftest.py` | Points backend tests at an isolated temporary data directory. |
| `tests/test_auto_backups.py` | Isolated tests for automatic snapshots, retention, recovery, and concurrent writes. |
| `tests/test_phase2_personal_finance.py` | Regression checks for Personal Expenses module boundaries and totals. |
| `tests/test_bank.py` | Bank Services route and service behavior tests. |
| `tests/test_concurrency.py` | Concurrent backend reads/writes and corrupted workbook recovery tests. |
| `tests/test_personal_finance.py` | Personal Expenses and transfer behavior tests. |
| `tests/test_settings.py` | Settings import/export behavior tests. |
| `tests/test_share.py` | Share Portfolio route and service behavior tests. |

Backend layering rule: routes call services; services own workbook paths and I/O.
When a service grows across concerns, split internal helpers into focused service
modules while preserving a clear route-facing service API.

The root `.gitignore` keeps the general `tests/` ignore rule, with explicit exceptions
for `backend/tests/` and its files so the backend suite remains visible to Git.

## Electron shell: `desktop/`

```text
desktop/
├── main.js
├── preload.js
├── package.json
├── package-lock.json
├── assets/
│   ├── finledge_icon.ico
│   └── finledge_icon.png
├── utils/
│   └── updateMetadata.js
└── scripts/
    └── build-sidecar.ps1
```

| Path | Responsibility |
|---|---|
| `main.js` | Electron main process, window lifecycle, updater, data-location IPC, and backend process control. |
| `preload.js` | Exposes the limited `financialTracker` bridge to the renderer. |
| `package.json` / `package-lock.json` | Electron dependencies and desktop packaging configuration. |
| `assets/` | Desktop application icons. |
| `utils/updateMetadata.js` | Pure helpers for release notes, version comparison, and release URLs. |
| `scripts/build-sidecar.ps1` | Packages the Python backend sidecar for desktop releases. |

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
| `components/ResultPanel.jsx` | Reusable result/status panel. |
| `components/OnboardingTour.jsx` | Onboarding tour UI (currently disabled in app routing). |
| `components/UpdateNotice.jsx` | Desktop update notification UI. |
| `constants/options.js` | Shared categories and dropdown choices. |
| `hooks/useDismissibleMessage.js` | Reusable timed message dismissal behavior. |
| `hooks/useDashboardPeriod.js` | Shared dashboard period state and record filtering. |
| `hooks/useDismissibleMessage.js` | Shared notice timeout lifecycle used by `StatusNotice`. |
| `pages/Home.jsx` | Home module launcher. |
| `pages/BankPage.jsx`, `BankDashboard.jsx` | Bank Services entry and dashboard screens. |
| `pages/SharePage.jsx`, `ShareDashboard.jsx` | Share Portfolio entry and dashboard screens. |
| `pages/PersonalFinanceHome.jsx` | Personal Expenses module launcher. |
| `pages/PersonalFinancePage.jsx`, `PersonalFinanceDashboard.jsx` | Personal Expenses entry and dashboard screens. |
| `pages/PersonalFinanceTransferPage.jsx` | Bank/Cash transfer entry and history screen. |
| `pages/Summary.jsx` | Financial Summary analytics screen. |
| `pages/Settings.jsx` | Data locations, backup, import/export, and app settings. |
| `utils/date.js`, `utils/format.js` | Shared date and display formatting helpers. |
| `utils/dashboardPeriod.js` | Dashboard range boundaries, period filtering, and daily/monthly chart buckets. |

## Root scripts and release files

| Path | Responsibility |
|---|---|
| `scripts/finledge.mjs` | Root command runner for backend, frontend, and desktop build flows. |
| `scripts/migrate_v1_2_0.py` | CLI for the legacy workbook migration. |
| `scripts/refresh-latest-yml.mjs` | Refreshes desktop updater metadata. |
| `scripts/start-release.mjs` | Prepares a release using the repository's release workflow. |
| `scripts/sync-version.mjs` | Synchronizes version values across desktop package files. |
| `scripts/verify-version.mjs` | Checks version consistency. |
| `.github/workflows/desktop-release.yml` | Builds and publishes desktop release artifacts. |
| `package.json` / `package-lock.json` | Root scripts and tooling dependencies; some commands are shared with other tracks. |
| `desktop-update-policy.json` | Current desktop update channel policy. |
| `update-policy.json` | Backward-compatible update policy for older desktop clients. |

## Desktop documentation

| Path | Responsibility |
|---|---|
| `docs/desktop-tasks.md` | Desktop phase checklist and dated progress log. |
| `docs/desktop-codebase.md` | This desktop-specific architecture and file map. |
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
