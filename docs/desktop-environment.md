# Desktop Environment Variables

The root `.env.example` lists app settings plus the build credentials needed for
GitHub publishing and optional signed AppX test builds. It describes what value
format to use. Copy it to the ignored root `.env` when running from source, then fill
only settings needed for your task. Blank means use the default, so normal app use
needs no values. Never put real credentials in `.env.example`. Packaged EXE/AppX
builds do not read the repository `.env`; public Vite settings are embedded into the
frontend at build time, while runtime overrides must be supplied by the launching
environment. Electron sets internal
`FINLEDGE_PROJECT_ROOT`, `FINLEDGE_BACKUP_DIR`, `FINLEDGE_SAFETY_COPY_DIR`, and
`FINLEDGE_DATA_DIR_IS_MANAGED` for its backend process; developers
should not add those to `.env`.

Empty values mean “use the default” unless a row says otherwise. Do not put tokens,
passwords, signing material, or private URLs in frontend `VITE_*` settings.

| Variable | What it controls and default | Read by | When it takes effect |
|---|---|---|---|
| `FINLEDGE_MODE` | Runtime mode (`development`, `testing`, or `production`). Electron infers it from the build; standalone Python defaults to development. | `desktop/services/runtimeConfig.js`, `scripts/finledge.mjs`, `backend/services/path_utils.py` | Restart the app/backend. Normally leave blank. |
| `FINLEDGE_DATA_DIR` | Active workbook root. Empty or `auto` selects the managed build default. Development uses `.finledge-dev-data/FinLedge Data`; Testing EXE and AppX both use `Documents/FinLedge Testing/FinLedge Data`; production EXE and AppX both use `Documents/FinLedge/FinLedge Data`. Thus both clients open and edit the same five workbooks. Existing `%APPDATA%/Finledge`, `%APPDATA%/Finledge Testing EXE`, and prior AppX LocalCache folders are migration sources; they remain in place after copying/merging. | `desktop/services/dataDirectoryRuntime.js`, `backend/services/path_utils.py` | Restart FinLedge to switch the whole app. |
| `FINLEDGE_BACKUP_DIR` | Internal path for automatic pre-write snapshots under the active shared workbook folder's `backups` child. EXE and AppX use the same backup root. | `desktop/services/dataDirectoryRuntime.js`, `backend/services/excel_utils.py` | Set by Electron; do not add to `.env`. |
| `FINLEDGE_SAFETY_COPY_DIR` | Internal path for recoverable workbook copies under the active shared workbook folder's `backups/safety-copy` child. A copy can restore an absent or empty active workbook. | `desktop/services/dataDirectoryRuntime.js`, `backend/services/excel_utils.py`, `backend/engine_main.py` | Set by Electron; do not add to `.env`. |
| `FINLEDGE_GITHUB_OWNER` | Public GitHub owner override. Empty derives from `desktop/package.json` repository metadata. Current default owner: `sachinadk2011`. | `desktop/services/repositoryConfig.js`, `frontendwebapp/vite.config.js` | Restart source Electron; rebuild frontend/desktop packages for installed apps. |
| `FINLEDGE_GITHUB_REPO` | Public GitHub repository override. Empty derives from package metadata. Current default repository: `FinLedge-App`. | `desktop/services/repositoryConfig.js`, `frontendwebapp/vite.config.js` | Restart source Electron; rebuild frontend/desktop packages for installed apps. |
| `FINLEDGE_UPDATE_POLICY_URL` | HTTPS JSON endpoint for update policy. Empty derives from the owner/repository as `https://raw.githubusercontent.com/<owner>/<repo>/main/desktop-update-policy.json`. | `desktop/services/repositoryConfig.js`, `desktop/services/updatePolicyService.js`, `frontendwebapp/vite.config.js` | Restart source Electron; rebuild packages for installed-app behavior. |
| `VITE_FINLEDGE_RELEASES_URL` | Public GitHub releases page base. Empty derives as `https://github.com/<owner>/<repo>/releases`. | `frontendwebapp/vite.config.js`, `desktop/services/repositoryConfig.js` | Rebuild frontend and desktop package for installed apps. |
| `FINLEDGE_BACKEND_HOST` | Backend loopback bind address; default `127.0.0.1`. | `scripts/finledge.mjs`, `desktop/services/runtimeConfig.js`, `backend/engine_main.py` | Restart backend and frontend. Keep loopback for normal desktop use. |
| `FINLEDGE_BACKEND_PORT` | Standalone backend port; standalone default is `8000`. Electron chooses a channel-specific available port and passes it to Python. | `scripts/finledge.mjs`, `backend/engine_main.py` | Restart backend. |
| `FINLEDGE_BACKEND_LOG_LEVEL` | Python backend log verbosity; default is the normal info level. | `backend/engine_main.py` | Restart backend. |
| `FINLEDGE_FRONTEND_HOST` | Vite development server bind address; default `127.0.0.1`. | `frontendwebapp/vite.config.js`, `scripts/finledge.mjs` | Restart Vite. |
| `FINLEDGE_FRONTEND_PORT` | Vite frontend port; defaults depend on the run mode/build channel. | `frontendwebapp/vite.config.js`, `desktop/services/runtimeConfig.js` | Restart Vite/Electron. |
| `FINLEDGE_DESKTOP_DEV_BACKEND_PORT` | Desktop development backend preferred port; default `8401`. | `desktop/services/runtimeConfig.js`, `scripts/finledge.mjs` | Restart Electron. |
| `FINLEDGE_DESKTOP_DEV_FRONTEND_PORT` | Desktop development frontend port; default `8451`. | `scripts/finledge.mjs` | Restart Electron/Vite. |
| `FINLEDGE_DESKTOP_EXE_BACKEND_PORT` | Production EXE backend preferred port; default `8001`. | `desktop/services/runtimeConfig.js` | Set in the launching process environment and restart the EXE. Root `.env` is not packaged. |
| `FINLEDGE_TEST_EXE_BACKEND_PORT` | Testing EXE backend preferred port; default `8201`. | `desktop/services/runtimeConfig.js`, `scripts/finledge.mjs` | Restart the testing EXE. |
| `FINLEDGE_TEST_APPX_BACKEND_PORT` | Testing AppX backend preferred port; default `8301`. | `desktop/services/runtimeConfig.js` | Set in the launching process environment and restart the testing package. |
| `FINLEDGE_STORE_BACKEND_PORT` | Microsoft Store backend preferred port; default `8101`. | `desktop/services/runtimeConfig.js` | Set in the launching process environment and restart the Store package. |
| `VITE_API_BASE_URL` | API base URL for a frontend running outside Electron. Empty leaves Electron IPC discovery in control. | `frontendwebapp/src/api/client.js`, `scripts/finledge.mjs` | Restart frontend; rebuild if used in a static frontend build. |
| `FINLEDGE_PYTHON_PATH` | Optional Python executable for source-mode Electron/dev scripts. Empty checks `<project>\venv\Scripts\python.exe`, then the platform venv path, then Python on `PATH`. Packaged desktop uses the bundled sidecar and does not need this. | `desktop/services/runtimeConfig.js`, `scripts/finledge.mjs` | Restart dev tooling. Set only if automatic interpreter selection is wrong. |
| `FINLEDGE_SIMULATE_UPDATE` | Development-only update notice simulation; empty disables it. | `desktop/services/runtimeConfig.js` | Restart development Electron. |

## Build and release credentials

These names are listed so developers know which credentials the release/signing
workflow accepts. Keep actual values only in the ignored local `.env` or the process/CI
secret store. They are not required to run FinLedge.

| Variable | Purpose and use | Needed when |
|---|---|---|
| `GH_TOKEN` | GitHub token used by Electron Builder to upload release artifacts. | Publishing a GitHub release. |
| `CSC_KEY_PASSWORD` | Electron Builder code-signing password for a configured certificate. | Signing with that certificate configuration. |
| `FINLEDGE_TEST_CERT_PATH` | Path to the `.pfx` certificate for a local signed AppX test build. | Building a signed AppX test package. |
| `FINLEDGE_TEST_CERT_PASSWORD` | Optional password for that test certificate; the build script maps it to Windows signing configuration. | Only when the `.pfx` requires a password. |

## Repository links

The canonical public repository is the `repository.url` entry in
`desktop/package.json`. Electron Builder derives GitHub publishing coordinates from
that same metadata. With the current package metadata, the releases page is
`https://github.com/sachinadk2011/FinLedge-App/releases`, the latest-release page is
`https://github.com/sachinadk2011/FinLedge-App/releases/latest`, and a tagged release
uses `https://github.com/sachinadk2011/FinLedge-App/releases/tag/<tag>`.

For a fork, set `FINLEDGE_GITHUB_OWNER` and `FINLEDGE_GITHUB_REPO` in the source/build
environment. The optional URL variables above can override the derived public links.
These are public coordinates, not secrets. The actual local root `.env` is ignored by
Git and was preserved without reading or changing its contents.
