# AGENTS.md — Rules for AI coding agents on FinLedge

Read this before every task. This is a checklist, not documentation.

---

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
| Excel columns | Title Case | `Date`, `Category`, `Amount`, `Cumulative Amount`, `Timestamp` |

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

Personal Finance:
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
- Every new or updated record must store a backend-generated `Timestamp` value using ISO format with seconds.
- No shared data-access layer exists — each service manages its own file directly.
- Never import or directly read another module's Excel file from a route handler. Use the service layer.
- Personal Finance uses separate files for Bank Flow and Cash Flow, and combined views only aggregate those outputs.

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
4. **Auto-synced entries are read-only in the target UI.** Any row with `source="share-sync"` in the Personal Finance Bank Flow or Cash Flow files must NOT show edit/delete buttons in the Personal Finance UI.
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
