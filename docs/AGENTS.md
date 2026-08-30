# AGENTS.md — Rules for AI coding agents on FinLedge

Read this before every task. This is a checklist, not documentation.

---

## 0. Which files to read before starting a task — a routing table:


Any task → always read AGENTS.md (this file) and PLAN.md first.
Desktop task → also read CODEBASE.md (Backend + Desktop Frontend sections), TASKS.md.
Mobile task → also read CODEBASE.md (Mobile Repo Structure section), TASKS-mobile.md, schema.md, design.md, and finledge-mobile-design-v3.html directly if the task touches UI.
Keep Notes import task → also read keepNotesImport.md.
Release/versioning/CI task → also read techSpec.md and the relevant update-policy-*.json.
Any schema or column change (e.g. new Updated Device field) → also read schema.md, update it in the same task, and check rules.md for whether the change applies to desktop, mobile, or both.
State explicitly: this table exists because desktop and mobile are diverging tracks — reading only the old sections below is not enough once a task is mobile- or release-specific.


## 1. Naming Conventions (observed, do not change)

| Layer | Convention | Examples |
|-------|-----------|----------|
| Frontend files | PascalCase `.jsx` for components, camelCase `.js` for api/utils | `BankForm.jsx`, `bankApi.js`, `date.js` |
| Frontend functions | camelCase | `getBankData()`, `addBankEntry()`, `buildBankPayload()` |
| CSS classes | kebab-case | `page-header`, `stat-grid`, `error-pre`, `success` |
| Backend files | snake_case `.py` | `bank_service.py`, `share.py`, `path_utils.py` |
| Backend functions | snake_case | `append_bank_record()`, `read_bank_records()` |
| Pydantic models | PascalCase | `BankAddRequest`, `ShareCategory` |
| Enums | snake_case values | `operation_cost`, `investment_cost`, `service_cost` |
| API routes | lowercase prefix | `/bank/add`, `/share/data`, `/personal-finance/data`, `/summary/graphs/monthly` |
| Excel columns | Title Case | `Date`, `Category`, `Amount`, `Cumulative Amount`, `Created Timestamp`, `Last Updated Timestamp` |

## 2. File Map — Module → Files

```
Bank Services:
  backend/routes/bank.py          — FastAPI router (CRUD endpoints)
  backend/services/bank_service.py — Excel I/O + business logic
  backend/models.py               — BankCategory enum, BankAddRequest
  frontendwebapp/src/pages/BankPage.jsx        — Entry form page
  frontendwebapp/src/pages/BankDashboard.jsx   — Dashboard page
  frontendwebapp/src/components/BankForm.jsx   — Reusable form component
  frontendwebapp/src/api/bankApi.js            — Frontend API calls
  frontendwebapp/src/constants/options.js      — BANK_CATEGORIES array

Share Portfolio:
  backend/routes/share.py
  backend/services/share_service.py
  backend/models.py               — ShareCategory, ShareAddRequest (union type)
  frontendwebapp/src/pages/SharePage.jsx
  frontendwebapp/src/pages/ShareDashboard.jsx
  frontendwebapp/src/components/ShareForm.jsx
  frontendwebapp/src/api/shareApi.js

Personal Expenses:
  backend/routes/personal_finance.py
  backend/services/personal_finance_service.py — Excel I/O for separate Bank Flow and Cash Flow files
  backend/models.py               — PersonalFinance* enums and PersonalFinanceAddRequest
  frontendwebapp/src/pages/PersonalFinanceHome.jsx
  frontendwebapp/src/pages/PersonalFinancePage.jsx
  frontendwebapp/src/pages/PersonalFinanceDashboard.jsx
  frontendwebapp/src/components/PersonalFinanceForm.jsx
  frontendwebapp/src/api/personalFinanceApi.js
  frontendwebapp/src/constants/options.js      — Personal Finance flow/category arrays

Financial Summary:
  backend/routes/summary.py
  backend/services/summary_graph_service.py
  frontendwebapp/src/pages/Summary.jsx

Settings:
  frontendwebapp/src/pages/Settings.jsx

App Shell:
  frontendwebapp/src/App.jsx      — Routes + Layout (top nav lives here)
  frontendwebapp/src/styles.css   — All custom CSS

Shared Components:
  frontendwebapp/src/components/StatGrid.jsx
  frontendwebapp/src/components/TransactionsTable.jsx
  frontendwebapp/src/components/BarChart.jsx
  frontendwebapp/src/components/InteractiveTimelineChart.jsx
  frontendwebapp/src/components/ConfirmDialog.jsx
```

## 3. Data Layer Rules (non-negotiable)

Every module with its own Excel file MUST follow this exact pattern:

```python
# In backend/services/<module>_service.py
from openpyxl import Workbook, load_workbook
from .path_utils import get_data_dir

DATA_DIR = get_data_dir()
FILE_PATH = DATA_DIR / "<module>_transactions.xlsx"
SHEET_NAME = "<Module>"
HEADERS = ["Date", "Category", "Amount", ...]  # exact columns

def _ensure_workbook_exists() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not FILE_PATH.exists():
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = SHEET_NAME
        sheet.append(HEADERS)
        workbook.save(FILE_PATH)
        return
    # ... load, fix headers, save (copy pattern from bank_service.py)
```

- Call `_ensure_workbook_exists()` at the TOP of every read/write function.
- Use `load_workbook()` for reads, `sheet.append()` for writes, `workbook.save()` after every mutation.
- Every new record must store backend-generated `Created Timestamp` and `Last Updated Timestamp` values. Updates preserve Created Timestamp and replace Last Updated Timestamp.
- No shared data-access layer exists — each service manages its own file directly.
- Never import or directly read another module's Excel file from a route handler. Use the service layer.
- Personal Expenses uses separate files for manual Bank Flow and Cash Flow data. Combined views aggregate those outputs; Bank Flow additionally derives read-only live activity from the Bank Services and Share Portfolio source workbooks.
- Do not copy Share Portfolio or Bank Services rows into a Personal Expenses workbook. The backend aggregation creates read-only `share-sync` and `bank-services-sync` view rows, so edits and deletes in their source modules are reflected immediately without duplicate storage.

**New modules** must create:
1. `backend/services/personal_finance_service.py` — own file paths, sheet names, headers, `_ensure_workbook_exists()`
2. `backend/routes/personal_finance.py` — own router, prefixed `/personal-finance`
3. `backend/models.py` — add request models for the new module
4. `backend/main.py` — register the new router via `app.include_router()`
5. `frontendwebapp/src/api/personalFinanceApi.js` — own API layer
6. `frontendwebapp/src/pages/PersonalFinance*.jsx` — page components

## 4. Route Error Handling Pattern

Every route MUST use this try/except structure (copy from `bank.py`):

```python
@router.post("/add")
def add_record(payload: SomeRequest):
    try:
        record = service_function(...)
        return {"message": "Record added successfully", "data": record}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
```

- `ValueError` = user/biz error → 400
- `Exception` = unexpected → 500
- Return `{"message": "...", "data": ...}` on success

## 5. Frontend Component Pattern

Every page follows this structure:

```jsx
function ModulePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ ... });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auto-dismiss messages after 5s
  useEffect(() => { ... }, [success, error]);

  async function handleSubmit(event) {
    event.preventDefault();
    // try/catch, call API, set success/error
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Module Name</p>
          <h1>Page title</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" onClick={() => navigate(-1)}>Back</button>
          <Link className="ghost" to="/">Home</Link>
          <Link className="ghost" to="/module-dashboard">View dashboard</Link>
        </div>
      </header>
      <ModuleForm ... />
      {success ? <p className="success">{success}</p> : null}
      {error ? <pre className="error-pre">{error}</pre> : null}
    </main>
  );
}
```

## 6. Hard Rules from PLAN.md (apply to ALL tasks)

1. **Never move top-level app navigation.** The nav in `App.jsx` Layout must stay top-level and keep this order: Bank Services, Share Portfolio, Personal Finance, Financial Summary, Settings. Do not move it into Settings or any sidebar.
2. **Never consolidate dashboards.** Each module keeps its own `*Dashboard.jsx`. Summary gets its own page.
3. **Migration must never destroy data.** Always write to a backup file first, then modify. Never overwrite `bank_transactions.xlsx` or `share_transactions.xlsx` in-place during migration.
4. **Synced entries are read-only in the target UI.** Any row whose source is not `manual` in the Personal Expenses Bank Flow view must NOT show edit/delete buttons.
5. **Financial Summary is analytics-only.** No entry forms, no mutation endpoints, no write operations on the Summary page.
6. **Do not build anything under Deferred.** See PLAN.md: v1.3.0 (opportunity cost engine, interest settings, daily interest sim) and v2.0.0 (Google Sign-In, Drive sync, Android) are explicitly off-limits.

## 7. Before You Write Code — Checklist

- [ ] Which files in the File Map (§2) are relevant to this task?
- [ ] Does this task conflict with any Hard Rule (§6)? If yes → **stop and ask**.
- [ ] Is anything I'm about to build listed under PLAN.md's "Deferred"? If yes → **stop**.
- [ ] Am I creating a new module? If yes → follow the Data Layer Rules (§3) exactly.
- [ ] Am I adding a new route? If yes → follow the error handling pattern (§4).
- [ ] Am I adding a new page? If yes → follow the component pattern (§5).
- [ ] Am I renaming UI labels? Check that only text changes — no logic changes unless explicitly required.

## 8. Mobile-Specific Rules:


Logic must be ported, not shelled out to Python — mobile has no background-process story on Android.
Every ported service needs a parity test against its backend/services/ counterpart before being marked done.
SQLite schema changes go in docs/schema.md first, before implementation.
Every module screen follows Add-entry ⇄ Dashboard as two screens — never combined into one page.
UI must be tested at minimum 360px and maximum ~430px width and remain legible and visually consistent at both.


## 9. Keeping this file current — whenever a task adds, removes, renames, or moves a file, folder, module, script, or config that is referenced anywhere in this file or in CODEBASE.md, the agent must update both files in the same task, before considering the task complete. This includes new pages, components, services, data files, scripts, docs, changed route prefixes, or changed folder structure. Do not leave AGENTS.md or CODEBASE.md stale — a future agent trusts these files completely and will not independently re-verify them against the actual repo.

## 10. Code Quality & Scalability Rules (non-negotiable, every task)

- **No duplicate logic.** If the same logic exists in two or more places, extract it into a shared function/module instead of writing it again. `backend/services/excel_utils.py` (see CODEBASE.md / TASKS.md Pass B) is the reference pattern for this — `to_float()`, `to_int()`, and timestamp helpers were pulled out of three duplicated copies into one shared module. Apply the same instinct everywhere, on both platforms.
- **One responsibility per file.** No file should mix unrelated concerns (e.g. a page component that also contains business logic that belongs in a service, or a service that also does routing). Split by concern, matching the existing `routes/` → `services/` → `models.py` layering on backend, and `pages/` → `components/` → `api/` on frontend.
- **Reusable over copy-pasted.** Before writing a new function or component, check whether an existing one already does this or can be generalized to. Prefer composition (small, combinable functions/components) over one large function that does everything.
- **No monolithic files.** If a file is growing long enough that it's doing multiple jobs, split it into smaller, clearly-named files before continuing — don't let one file become a dumping ground.
- **Match existing conventions exactly** (per AGENTS.md §1 Naming Conventions) — this is what "consistency" means in practice: same naming, same file layout, same patterns as the rest of the codebase, not a new personal style per task.
- **If you find inconsistency or duplication while working nearby** (not necessarily the thing you were asked to fix), correct it as part of the task — but only if you can verify it still runs/passes tests afterward. Never leave the codebase in a broken state to "clean up" something unrelated. If fixing it safely isn't possible in scope, leave a note in the relevant TASKS.md/TASKS-mobile.md entry instead of silently skipping it.
- **Design for scalability, not just the immediate ask.** Avoid hardcoding values or logic that will obviously need to change as new modules/platforms are added (e.g. category lists, platform-specific paths) — centralize them the way `models.py`'s enums are meant to be the source of truth (even though `bank_service.py`'s duplicate list is a known counterexample to fix, not follow).
- **"Simplify" never means merging files.** "Simplify" or "make it easier to understand" never means merging multiple screens/components into fewer files — that is the opposite of this rule. It means splitting further: smaller, single-responsibility files with clearer names. No screen/component file should mix more than one screen's rendering logic; `main.ts` is bootstrap/render-loop/event-binding only and must never contain screen markup directly (see CODEBASE.md's Mobile Repo Structure for the correct `screens/` / `components/` / `data/` split — that structure is the answer to "simplify," not a starting point to abandon).


## 11. Self-check before marking any task done

Before finishing any task that creates, updates, or deletes code, answer these honestly — if any answer is "no," fix it before considering the task complete:

- Did I duplicate logic that already exists elsewhere in the codebase? (If yes → extract it instead.)
- Does every file I touched still do exactly one job? (If a file now does two, split it.)
- Would another developer, unfamiliar with this codebase, understand this in under a minute? (If not, it needs clearer structure or naming, not just a comment.)
- Did I find inconsistent or duplicated code nearby that I could safely fix? (If yes and safe → fix it. If yes but risky → note it, don't silently skip it.)
- Is what I wrote reusable elsewhere, or is it a one-off that should have been generalized?
- Have I verified the code still runs / existing tests still pass after any change or refactor I made?

This checklist applies in addition to, not instead of, the existing ## 7. Before You Write Code — Checklist.

## 12. Doc authority — do not silently rewrite user decisions

These docs encode explicit user decisions, not agent scratch space. Progress trackers (TASKS.md, TASKS-mobile.md) may be freely appended to per §9. Every other doc (PLAN.md, design.md, schema.md, appflow.md, prd.md, rules.md, keepNotesImport.md, CODEBASE.md, AGENTS.md itself) may only be edited by: (a) pure additions that don't remove or reword existing content, or (b) a change the user explicitly requested in this task. If a task seems to require changing an existing requirement in one of these files, stop and show the user the exact before/after diff before applying it — never resolve a conflict by quietly rewriting the doc to match new code behavior.
