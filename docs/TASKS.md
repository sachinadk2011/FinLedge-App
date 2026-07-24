# TASKS.md — v1.2.0 Progress Tracker

## v1.2.0 Progress

- [x] 1. Baseline inventory
  Notes: Completed from the current working tree on 2026-07-24.

  Rule files checked:
  - `docs/AGENTS.md`
  - `docs/PLAN.md`
  - `docs/TASKS.md`

  Requested lowercase files `docs/agent.md` and `docs/task.md` are not present in the repo; the existing tracked docs are uppercase/plural.

  Current module inventory:
  - App shell: `frontendwebapp/src/App.jsx`, `frontendwebapp/src/styles.css`
  - Bank module: `backend/routes/bank.py`, `backend/services/bank_service.py`, `frontendwebapp/src/pages/BankPage.jsx`, `frontendwebapp/src/pages/BankDashboard.jsx`, `frontendwebapp/src/components/BankForm.jsx`, `frontendwebapp/src/api/bankApi.js`
  - Share module: `backend/routes/share.py`, `backend/services/share_service.py`, `frontendwebapp/src/pages/SharePage.jsx`, `frontendwebapp/src/pages/ShareDashboard.jsx`, `frontendwebapp/src/components/ShareForm.jsx`, `frontendwebapp/src/api/shareApi.js`
  - Summary module: `backend/routes/summary.py`, `backend/services/summary_graph_service.py`, `frontendwebapp/src/pages/Summary.jsx`
  - Settings module: `frontendwebapp/src/pages/Settings.jsx`
  - Shared models/options: `backend/models.py`, `frontendwebapp/src/constants/options.js`

  Current backend state:
  - FastAPI app registers bank, share, and summary routers only.
  - Bank data is stored in `bank_transactions.xlsx` through `backend/services/bank_service.py`.
  - Share data is stored in `share_transactions.xlsx` through `backend/services/share_service.py`.
  - No Personal Finance router/service/data file exists yet.
  - Share categories currently include IPO, SIP, buy, sell, and dividend.
  - Bank categories are still the older broad categories: income, service cost, investment cost, operation cost.

  Current frontend state:
  - Top-level app navigation is still in `frontendwebapp/src/App.jsx`.
  - Current visible nav labels are Bank, Share, Summary, and Settings.
  - Routes exist for home, bank, bank dashboard, share, share dashboard, summary, and settings.
  - No Personal Finance page/dashboard/routes exist yet.
  - Tour guide component exists in the tree but is currently disabled in `App.jsx`.

  Step 1 only: no v1.2.0 implementation changes were made yet. Continue with Step 2 only after explicit confirmation.

- [x] 2. Rename modules (Bank Services, Share Portfolio, Financial Summary)
  Notes: Completed as visible UI text only. Routes, filenames, service names, and storage filenames were intentionally left unchanged for compatibility. Updated app header labels, top nav labels, Home cards, module page headings, dashboard headings, form headings/buttons, Summary page labels, and disabled tour copy.

- [x] 3. Bank Services category redesign
  Notes: Completed with the same existing form fields. Replaced the old broad category set with Interest Earned, Interest Tax, Mobile Banking Charge, Debit Card Charge, ATM Charge, SMS Charge, Cheque Book, Locker, Demat Renewal, Broker Renewal, MeroShare Renewal, and Other Charges. Interest Earned is stored as positive income; every other Bank Services category is stored as a negative charge. Dashboard category totals now use the new category list. Legacy `income` records are still treated as income in summaries until the Step 7 data migration runs.

- [x] 4. Personal Finance module (Bank Flow / Cash Flow / Combined Overview)
  Notes: Completed as a new independent module with its own backend route, service, model validation, frontend API, module home page, entry form page, and dedicated dashboard. Personal Finance stores Bank Flow data in `personal_finance_bank_flow.xlsx` and Cash Flow data in `personal_finance_cash_flow.xlsx`, separate from Bank Services and Share Portfolio files. The `/personal-finance` module home opens first and shows three cards: Bank Flow, Cash Flow, and Combined Overview. Entry page supports Bank Flow and Cash Flow manual income/expense records with the required category lists, recent transaction table, edit/delete for manual rows, and read-only handling for future `source="share-sync"` rows. Bank Flow entry shows Bank Flow transactions only, Cash Flow entry shows Cash Flow transactions only, and combined entry mode shows both. Combined rows expose flow-prefixed display IDs such as `B-1` and `C-1` so duplicate Excel row numbers remain identifiable. View dashboard from a Bank Flow entry opens the Bank Flow dashboard, and View dashboard from a Cash Flow entry opens the Cash Flow dashboard. Each flow dashboard shows only its own recent transactions. Dashboard includes Combined Overview, Bank Flow, and Cash Flow views with stats, category breakdowns, and monthly trend charts. App navigation and Home now include Personal Finance without moving the top-level nav. Backend services now save a backend-generated `Timestamp` column for new/updated Bank Services, Share Portfolio, and Personal Finance records.

- [ ] 5. Share → Personal Finance auto-sync
  Notes:

- [ ] 6. Financial Summary dashboard (4 sections)
  Notes:

- [ ] 7. Data migration
  Notes:

- [ ] 8. Settings redesign (left nav, Settings page only)
  Notes:

- [ ] 9. About / How To Use content
  Notes:

- [ ] 10. Testing
  Notes:

- [ ] 11. Release v1.2.0
  Notes:
