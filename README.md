# Finledge - Financial Tracker

Finledge is a personal financial tracker built with:

- `React + Vite` for the frontend
- `FastAPI` for the backend
- `Excel files` for storage
- `Electron` for the desktop app

It helps track:

- Bank income and expenses
- Share transactions such as IPO, buy, sell, and dividend
- Combined financial summary with charts

## Features

- Bank module with add, edit, delete, and dashboard view
- Optional bank transaction description
- Share module with add, edit, delete, and dashboard view
- IPO allotment update flow
- Overall summary with charts
- Excel-based local storage
- Desktop app support with Electron
- Separate development and production data handling

## Project Structure

```text
tracker financial/
├─ backend/             FastAPI backend
├─ desktop/             Electron desktop app
├─ frontendwebapp/      React + Vite frontend
├─ .env                 Local environment mode
├─ package.json         Root scripts
├─ requirements.txt     Python dependencies
└─ README.md
```

## Requirements

- Python 3.13+ recommended
- Node.js 20+ recommended
- npm
- Windows PowerShell for the current scripts

## Installation

### 1. Clone the project

```powershell
git clone <your-repo-url>
cd "tracker financial"
```

### 2. Create and activate the virtual environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3. Install Python dependencies

```powershell
pip install -r requirements.txt
```

### 4. Install Node dependencies

At the project root:

```powershell
npm install
```

Inside the Electron folder:

```powershell
cd desktop
npm install
cd ..
```

## Environment

This project uses a single local `.env` file.

Current supported value:

```env
FINLEDGE_MODE=development
```

Modes:

- `development`
- `production`

For normal local work, keep:

```env
FINLEDGE_MODE=development
```

Desktop scripts already force the correct mode automatically:

- `npm run desktop-dev` -> development
- `npm run desktop-build` -> production

## Running the Project

### Web development mode

Runs backend and frontend together:

```powershell
npm run dev
```

Default URLs:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://127.0.0.1:8000](http://127.0.0.1:8000)

### Desktop development mode

Runs Electron with development data:

```powershell
npm run desktop-dev
```

Desktop dev uses:

- frontend port `5174`
- backend port `8001`

### Desktop production build

Builds the frontend and packages the Electron app:

```powershell
npm run desktop-build
```

## Data Storage

### Development

Development data is stored inside the project:

```text
.finledge-dev-data/
```

### Production

Production desktop data is stored in the user roaming folder:

```text
C:\Users\<username>\AppData\Roaming\Finledge\
```

Example files:

- `bank_transactions.xlsx`
- `share_transactions.xlsx`

## Important Notes

- Do not commit personal Excel data files to GitHub.
- The `.env` file is local and is ignored by git.
- Development and production data are intentionally separate.
- If you are testing desktop dev, close any already-open installed production app first.

## Versioning the Desktop App

To change the packaged desktop app version, update:

- [desktop/package.json](desktop/package.json)

Example:

```json
"version": "1.0.1"
```

Then rebuild:

```powershell
npm run desktop-build
```

## Main Scripts

From the root `package.json`:

- `npm run dev` -> run backend + frontend
- `npm run dev:backend` -> run FastAPI backend
- `npm run dev:backend:reload` -> run backend with reload
- `npm run dev:frontend` -> run Vite frontend
- `npm run desktop-dev` -> run Electron in development mode
- `npm run desktop-build` -> package Electron app for production

## Tech Stack

- React
- Vite
- FastAPI
- OpenPyXL
- Pandas
- Matplotlib / Seaborn
- Electron

![GitHub All Releases](https://img.shields.io/github/downloads/sachinadk2011/FinLedge-App/total)
