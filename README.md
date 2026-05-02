# FinLedge

> Personal finance clarity in a desktop app you can actually own.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![GitHub All Releases](https://img.shields.io/github/downloads/sachinadk2011/FinLedge-App/total)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/sachinadk2011/FinLedge-App)

FinLedge is a polished desktop financial tracker that combines a React-based UI, an Electron shell, and a Python FastAPI engine to help you manage bank activity, share transactions, and overall financial position from one place.

FinLedge began as an original personal product idea focused on solving a real day-to-day problem: keeping banking activity, income, expenses, market investments, and financial summaries together in one practical desktop workflow. It has since been expanded into a more general-purpose desktop finance platform for broader public use.

---

## Why FinLedge?

FinLedge is built for people who want:

- a lightweight desktop app instead of a browser-only finance tool
- clear bank and share tracking in one workflow
- local-first Excel storage under the user profile
- a release-ready desktop app with updater support

---

## Highlights

| Area | What it does |
| --- | --- |
| Bank Module | Track income, service cost, investment cost, operation cost, and optional descriptions |
| Share Module | Track IPO, buy, sell, dividend, edit entries, and update IPO allotments |
| Summary Dashboard | View combined financial position with charts and comparative insights |
| Desktop Experience | Electron-powered Windows app with sidecar Python backend |
| Local Data Ownership | Stores user files in the OS user-data area instead of hardcoded machine paths |
| Release Workflow | Ready for installer builds, GitHub releases, and desktop auto-updates |

---

### 📸 App Screenshots

| Home Page | Bank Dashboard | Share Dashboard | Summary |
| :---: | :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/47863854-9e77-4381-a112-b50dc6471800" width="250" /> | <img src="https://github.com/user-attachments/assets/b8e8895d-7831-4d08-bdef-ac95e10a39d5" width="250" /><br><br><img src="https://github.com/user-attachments/assets/f1c6b807-a6d5-427b-9372-cdec9d8ebbc9" width="250" /> | <img src="https://github.com/user-attachments/assets/f8b9822e-25c4-48cf-bdf1-876401d85d32" width="250" /><br><br><img src="https://github.com/user-attachments/assets/7fc4a4f3-f3b2-4b00-ac25-f0f5974bd9c5" width="250" /> | <img src="https://github.com/user-attachments/assets/ab81eff6-424a-4f34-aec1-ccef3e18d5ba" width="250" /> |
---

## Tech Stack

FinLedge uses a modern multi-runtime stack:

| Layer | Technology |
| --- | --- |
| Frontend UI | React + Vite |
| Desktop Shell | Electron |
| Backend Engine | Python + FastAPI + Uvicorn |
| Storage | Excel (`.xlsx`) via OpenPyXL |
| Charts | Recharts (frontend) and Matplotlib (backend) |
| Packaging | Electron Builder + PyInstaller |

Note:
FinLedge follows a desktop-first architecture using React for UI and Python FastAPI for backend services, optimized for local desktop workflows rather than a traditional browser-first MERN stack.

---

## Key Features

- Interactive home page with module navigation
- Bank entry form with optional description support
- Share tracking for IPO, buy, sell, and dividend flows
- IPO allotment update workflow with validation
- Edit and delete support across modules
- Scrollable tables for historical data
- Interactive summary charts
- Production desktop packaging with a frozen Python sidecar
- GitHub-based auto-update support

---

## Product Ownership

FinLedge is an original self-directed product created and shaped by Sachin Adhikari. The concept, feature direction, user flow, product structure, and iterative roadmap were defined as part of a real product-building process rather than copied from a tutorial or classroom assignment.

## Development Note

This project was developed through a modern AI-assisted workflow. Product thinking, architecture decisions, feature design, and iteration direction were driven by the project owner, while portions of implementation were accelerated through AI-supported development and refinement. That assistance is part of the development process and is presented transparently.

---

## Security & Integrity

FinLedge is prepared for a safer public release:

- Configuration is centralized through a root `.env` file
- `.env` is ignored from Git so personal values are not committed
- User files are stored in system-managed dynamic paths
- No fixed laptop-specific storage paths are required


## End-User Installation Guide

### Windows Setup

1. Download the latest `Finledge-Setup-<version>.exe` from the GitHub Releases page.
2. Run the installer.
3. Launch **FinLedge** from the Start Menu or Desktop shortcut.
4. Your data will be stored automatically in your user data folder.


### If Windows shows a blue warning screen

Because FinLedge is distributed without commercial code signing during releases, Windows SmartScreen can sometimes show a blue protection screen such as **"Windows protected your PC"**.

If that happens:

1. Confirm the installer came from the official GitHub Releases page.
2. Click **More info**.
3. Click **Run anyway** only if the release source and checksum match.

This warning is related to Windows reputation/signing, not necessarily a problem with the installer itself.

### User Data Location

On Windows, FinLedge stores user-specific files in:

```text
%APPDATA%\Finledge\
```

Typical files:

- `bank_transactions.xlsx`
- `share_transactions.xlsx`

---

## Developer Setup

### 1. Clone the repository

```powershell
git clone https://github.com/sachinadk2011/FinLedge-App.git
cd "tracker financial"
```

### 2. Create your environment file

Copy the example:

```powershell
Copy-Item .env.example .env
```

Then adjust the values you need in `.env`.

### 3. Create and activate Python virtual environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 4. Install backend dependencies

```powershell
pip install -r requirements.txt
```

### 5. Install frontend and desktop dependencies

```powershell
npm install
npm install --prefix frontendwebapp
npm install --prefix desktop
```

### 6. Run local web development

```powershell
npm run dev
```

### 7. Run desktop development

```powershell
npm run desktop-dev
```

To preview the in-app update notification during desktop development, set `FINLEDGE_SIMULATE_UPDATE=1` in `.env` and run `npm run desktop-dev`. This simulated updater is dev-only; production builds only show update notifications when a real GitHub release update is available.

---

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `FINLEDGE_MODE` | Sets runtime mode such as `development` or `production` |
| `FINLEDGE_BACKEND_HOST` | Backend host for local development and desktop shell wiring |
| `FINLEDGE_BACKEND_PORT` | Default backend port for standard local development |
| `FINLEDGE_BACKEND_LOG_LEVEL` | Uvicorn/FastAPI backend logging level |
| `FINLEDGE_FRONTEND_HOST` | Vite frontend host |
| `FINLEDGE_FRONTEND_PORT` | Vite frontend port |
| `FINLEDGE_DESKTOP_DEV_BACKEND_PORT` | Desktop development backend port |
| `FINLEDGE_DESKTOP_DEV_FRONTEND_PORT` | Desktop development frontend port |
| `FINLEDGE_DESKTOP_PROD_BACKEND_PORT` | Backend port used during production packaging flow |
| `FINLEDGE_SIMULATE_UPDATE` | Set to `1` only in Electron dev mode to preview the update notification UI |
| `VITE_API_BASE_URL` | Frontend API base URL for browser/Vite usage |
| `FINLEDGE_GITHUB_OWNER` | GitHub owner used for release documentation/reference |
| `FINLEDGE_GITHUB_REPO` | GitHub repository used for releases |
| `GH_TOKEN` | GitHub token used when publishing builds from CI or local shell |
| `FINLEDGE_PYTHON_PATH` | Optional override if the Python executable is not inside the default project `venv` |

---

## Release Commands

| Task | Command |
| --- | --- |
| Web dev | `npm run dev` |
| Backend only | `npm run dev:backend` |
| Backend with reload | `npm run dev:backend:reload` |
| Frontend only | `npm run dev:frontend` |
| Desktop dev | `npm run desktop-dev` |
| Desktop production build | `npm run desktop-build` |
| Desktop build + publish | `npm run desktop-build:publish` |

---

## Versioning

Use the version sync helper when releasing a new version:

```powershell
node .\scripts\sync-version.mjs x.y.z
```

Or run the same helper through npm:

```powershell
npm run version:sync -- x.y.z
```

It updates the root, desktop, and frontend package versions, plus their lockfile metadata. If you already changed the root `package.json` version manually, run this without an argument:

```powershell
node ./scripts/sync-version.mjs
```

Recommended GitHub release tag:

```text
vx.y.z
```

---

## Project Structure

```text
tracker financial/
├─ backend/
├─ desktop/
├─ frontendwebapp/
├─ scripts/
├─ .env.example
├─ package.json
├─ requirements.txt
└─ README.md
```

---




## Author

**Sachin Adhikari**

## License

This project is released under the MIT License.

See [LICENSE](LICENSE) for the full text.
