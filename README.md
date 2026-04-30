# FinLedge

> Personal finance clarity in a desktop app you can actually own.

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

## Screenshots

Add release screenshots here before publishing:

| Home | Bank Dashboard | Share Dashboard | Summary |
| --- | --- | --- | --- |
| `![Home Screenshot](docs/screenshots/home.png)` | `![Bank Screenshot](docs/screenshots/bank.png)` | `![Share Screenshot](docs/screenshots/share.png)` | `![Summary Screenshot](docs/screenshots/summary.png)` |

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
This project is not a classic MongoDB/Express MERN backend. It uses the React ecosystem on the frontend and a Python engine on the backend for a desktop-first architecture.

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

### SHA-256 Checksum Verification

For public releases, publish a SHA-256 checksum alongside the installer so users can verify download integrity.

Example PowerShell command:

```powershell
Get-FileHash .\Finledge-Setup-1.0.0.exe -Algorithm SHA256
```

Include that checksum in your GitHub Release notes.

---

## End-User Installation Guide

### Windows Setup

1. Download the latest `Finledge-Setup-<version>.exe` from the GitHub Releases page.
2. Optionally verify the SHA-256 checksum.
3. Run the installer.
4. Launch **FinLedge** from the Start Menu or Desktop shortcut.
5. Your data will be stored automatically in your user data folder.

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

Update these files when releasing a new version:

| File | Field |
| --- | --- |
| `package.json` | `"version"` |
| `desktop/package.json` | `"version"` |
| `frontendwebapp/package.json` | `"version"` |

Recommended GitHub release tag:

```text
v1.0.0
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


![GitHub All Releases](https://img.shields.io/github/downloads/sachinadk2011/FinLedge-App/total)

## Author

**Sachin Adhikari**

## License

This project is released under the MIT License.

See [LICENSE](LICENSE) for the full text.
