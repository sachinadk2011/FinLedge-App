# TASKS-mobile.md — mobile-v1.0.0 Progress Tracker

## mobile-v1.0.0 Phases

- [x] 1. Scaffolding
  Notes: (seed) Set up the Capacitor-wrapped `frontendwebapp` runtime and
  `@capacitor-community/sqlite` storage so the mobile app builds and boots
  as a native Android app. Wire the mobile service layer, mobile/src entry,
  and the Capacitor Android project.

- [x] 2. Port shared business logic
  Notes: (seed) Reimplement backend/service logic on-device in TypeScript —
  bank category totals, share FIFO lot-matching, and personal-finance
  sync-row computation (see `mobile/services/*.ts`). No shelling out to
  Python; mobile has no background-process story on Android.

- [x] 3. SQLite schema + data layer (incl. updated_device column)
  Notes: (seed) Create the SQLite tables per docs/schema.md
  (bank_transactions, share_transactions, personal_finance_bank_flow,
  personal_finance_cash_flow, transfers) plus the new Updated Device column
  on both platforms, with a migration path and default for existing rows.

- [x] 4. UI build (responsive across phone sizes)
  Notes: (seed) Build the mobile UI from docs/design.md and docs/appflow.md.
  Responsive relative/flex layouts tested from 360px–430px; module screens
  are Add-entry ⇄ Dashboard pairs (never combined). Fixed drawer brand asset
  packaging, drawer pictogram icons, chart compact-money formatting/color
  audit issues, Settings sub-navigation, mobile form/dashboard parity gaps,
  Android launcher icon/splash generation, no-crop splash scaling, launch
  theme dark background, and confirmed `main.ts` remains
  bootstrap/render-loop/event-binding only.
  Browser/ADB-based on-device 360px/430px visual verification is still
  needed in an environment with a connected browser or Android device bridge.
  Session 2026-08-31 progress (UI gap closure):
  - shell.ts: Fixed periodControls (removed stale h3 title); rewrote
    historyRows with .meta wrapper, · separator, count label, search filter,
    placeholder edit/delete buttons; added sectionTitle(), searchInput(),
    statGrid(), barsChart(), categoryBarsSection() helpers.
  - bank-dash: 3-column stat grid; "Charges by category" catbar section;
    "Bank services trend" 5-month bar chart; search-filtered history rows.
  - shares-dash: Portfolio (remaining) holdings table with search; grouped
    stat cards (IPO & secondary, SIP position, Grand total purple card);
    "Value trend" bar chart; filtered transaction history.
  - expenses-add: transfer-chip navigation row (replaces plain button).
  - expenses-dash: Combined/Bank/Cash segmented tab (teal active); transfer-
    chip inside stats card; "Monthly trend" bar chart; filtered history.
  - summary: 4-stat grid; "Net worth trend" bar chart; "Where it comes from"
    mini table.
  - settings: "Import from Keep Notes" green CTA card.
  - styles.css: Added .transfer-chip, .bars .col/.v/.stick/.day, table.mini,
    .badge-new, .stat-card-purple, .search-input, .segmented.alt, .stat-box-full.
  - app-state.ts: Added dashSearchQuery (per-module) and expensesDashTab state.
  - main.ts: Wired data-search-module inputs and data-expenses-tab buttons.
  - Build verified: npm run mobile:build passes (tsc + vite) with 0 errors.

  Session 2026-09-01 progress (module parity + list/search UX):
  - shell.ts: historyRows sub-line is now `category · date` only (module name
    removed for the mobile transaction list).
  - shares-dash: Removed the Portfolio (remaining) card from the dashboard
    (stays on the Add screen only); added a "Total investment" stat
    (summary.overall_investment = IPO + secondary buy, matching desktop).
  - shares history format: `SHARE · type · allotted N` (allotted only when > 0),
    dividend → "dividend (cash)/(bonus)", sip → "sip (installment)/(redeem)".
  - shares-add: field order Date → Share name → Entry type, then per-type
    conditional fields (IPO: per-unit price + allotted; SIP: type + installment
    amount, no total-SIP-shares field; secondary buy/sell: total amount +
    quantity with auto per-unit; dividend: cash/bonus type → amount or shares).
    Added share-name autocomplete via knownShareNames()/ipoOnlyNames()/
    sipOnlyNames(); Add screen keeps the Portfolio (remaining) card.
  - app-state.ts: Added sharesDividendType ("cash") and sharesSipType
    ("installment"); main.ts wired their change events.
  - main.ts: Debounced search re-render (250ms) that stores the query
    immediately, refocuses the input, restores the caret, and scrolls into
    view; global focusin + visualViewport.resize scroll-into-view so update
    sections / search inputs stay above the on-screen keyboard.
  - styles.css: 16px font-size on .field inputs and .search-input to stop iOS
    auto-zoom on focus. Desktop verified already conformant (no changes).

  Session 2026-09-02 progress (UI polish):
  - share suggestions: Replaced the native <datalist> share-name autocomplete
    with a custom single-panel dropdown (new mobile/src/components/
    share-suggest.ts + .share-suggest CSS) that filters on keystroke without
    re-rendering, highlights the typed query, and supports tap/Enter/
    Arrow-Up/Down/Escape. Applied to the Add screen and both Update IPO
    allotment / Update SIP shares fields. This fixes the boxed/line-based
    suggestion rendering and search-in-update-module bugs.
  - shares trend chart: renderBars now colors the bar + its value label by
    sign (green positive / red negative) via a new BarChartBucket.signColor
    flag. The share trend is now a signed net cash-flow ("Portfolio net flow
    trend"): money in (sell / SIP redeem / cash dividend) +, money out
    (IPO / buy / SIP installment) −, with a matching Money in / Money out
    legend.
  - stat grid: statGrid auto-spans the last box across the full row when it
    would sit alone (odd count on 2 cols, count % cols === 1 on 3 cols) — so
    Expenses dashboard Bank net and Cash net no longer float in the left
    column of an empty cell.
  - settings: Grouped menu (Account / Data & storage / About) with small-caps
    group titles; larger rounded icon chips, roomier rows, press states, and
    chevron chips; redesigned "Import from Keep Notes" CTA card; polished
    sub-screen panels, Version row chips, and Import/Export status pills
    (.settings-tag). Dropped the now-unused .settings-row-left/.chevron rules.
  - CODEBASE.md: mobile components list updated with share-suggest.ts.
  - Build verified: npm run build:services, build:web, and all 7 parity/
    schema/repository tests pass.

  Session 2026-09-02 refactor (AGENTS.md §10 structure pass):
  - components/: shell.ts slimmed to app chrome only (screen wrapper, topbar,
    drawer, bottom nav). Split every remaining helper into focused reusable
    modules: charts.ts (single/grouped bar charts, category bars, period +
    range controls), forms.ts (formCard/field/selectOptions/sectionTitle/
    addFormScreen), stats.ts (statGrid/statBox), history.ts (search-aware
    transaction rows), search.ts (one common search — searchInput/searchQuery/
    filterRows/bindSearchInputs with debounce + caret restore). home-chart.ts
    and share-suggest.ts kept for the Home chips and autocomplete panel.
    home-chart.ts now uses shared period buckets from utils/periods.ts.
  - utils/: added html.ts (single escapeHtml/escapeAttr source of truth),
    periods.ts (PeriodBucket + getPeriodBuckets + matchesPeriod, shared by
    shares/bank/expenses trend builders), viewport.ts (scrollFieldIntoView +
    bindKeyboardScrollProtection). main.ts now imports these instead of
    duplicating scroll/keyboard/debounce helpers; removed local
    scheduleDebouncedSearch/scrollFieldIntoView.
  - screens/settings/: all 9 settings files moved into a folder — index.ts
    (menu), layout.ts (shared sub-screen shell), + profile/import-export/
    investment/backup-sync/privacy/about/how-to-use/version. Old flat
    settings*.ts files deleted; main.ts imports updated.
  - app-state.ts: dashSearchQuery initialized to {} (per-module keys created
    on first use) so future modules reuse the same search without edits.
  - Security: all user-supplied data interpolated into HTML is escaped via
    utils/html.ts (profile name in topbar + settings-profile input value,
    share names in holdings table + share-suggest items/attributes, category
    picker labels, history row descriptions/categories, chart/category bar
    labels). toast uses textContent. share-suggest.ts imports the shared
    escape helpers instead of its local copies.
  - CODEBASE.md: Mobile Repo Structure tree updated for components/settings/
    utils split.
  - Build verified: npm run build:services, build:web, and all 7 parity/
    schema/repository tests pass.


- [x] 5. Keep Notes bulk import
  Notes: (seed) Implement the Keep Notes parser and review/edit screen per
  docs/keepNotesImport.md: paste → parse preview/review → confirm → commit,
  writing via the same service layer as manual entries.
  Session 2026-09-03 progress (bulk import flow):
  - services/keep-notes-parser.ts: pure parser producing a staging list
    (StagedEntry[]). Handles amount-then-label (dash/space/none), relative
    date headers, running-total `=` checksums (flag on mismatch), `+`-joined
    multi-item splits (with lump fallback), plus-prefixed ambiguous lines,
    reversed label-then-amount with parentheticals, label-then-sum, arithmetic/
    balance info lines, `k` scaling, and the "planned/needed" qualifier flag.
  - services/keep-notes-commit.ts: writes confirmed staged entries THROUGH the
    same repository layer as manual entries (insertPersonalFinanceRecord /
    insertBankTransaction / insertShareTransaction), so timestamps + updated_device
    are stamped automatically. Flagged rows must be confirmed before commit.
  - screens/keep-notes/paste.ts: full paste screen (textarea + placeholder with
    sample syntax). screens/keep-notes/review.ts: FULL-SCREEN (non-modal) staged
    review with search, editable per-row fields (date/label/amount/module/flow/
    type/category/description), add-row, split, delete, confirm-flag chips, and a
    summary + commit button that is disabled until all flagged rows are resolved.
  - app-state.ts: added importPasteDraft / importEntries / importReviewQuery.
    types.ts: added import-paste + import-review ScreenId. main.ts: wired the
    parse → review → commit flow (event delegation for live row edits), plus a
    boot-time SQLite open for the commit path.
  - settings/import-export.ts: "Import from Keep Notes" row now navigates to the
    import flow. Settings drawer highlights the import screens.
  - styles.css: added .btn-soft (natural pill actions), import paste textarea and
    review layout styles, flag chips, full-width row grid.
  - tests: new tests/keep-notes-parser.test.ts (12 cases) covering the parser
    spec — all pass. Build verified: build:services + build:web. All tests green.

  LATER SESSION (2026-09-03) — loosen the parser for fully-unstructured notes
  (any note/jot-down app, not only Keep Notes) + rename the import entry points:
  - New parser rule: leading-label + amount(chains) on the SAME line, e.g.
    `travel 25 + 25 +20+20`, `gift 100 dd lai`, `aama le 505 earn`,
    `name 250 + 100`, `fruit  125`. Sums each `+` chain into one entry
    (`travel 25 + 25 +20+20` → 90), description = the leading label only
    ("travel").
  - classifyLabel loose-word mappings (checked BEFORE exact-option match so
    "travel" → Transportation, not the "Travel" option): travel/transport/ride →
    Transportation; salary → Salary income; earn/income/bonus → Other Income
    income; gift → Gift income; dahi/curd/fruit/milk/vegetable/rice/snack/cola →
    Food expense. Names without an income word still default to Other expense
    (editable in review).
  - UI: "Import from notes" (was "Import from Keep Notes"); removed the
    "Phase 5" pill; the Settings "Start import" CTA now navigates directly to
    the import-paste screen instead of the Import/Export sub-menu.
  - tests: added a 10-line unstructured-format test. 20/20 pass, builds green.

  LATER SESSION (2026-09-03, +2) — gift income/expense + wider Nepali food words:
  - Gift category: added "Gift" to PERSONAL_FINANCE_EXPENSE_CATEGORIES so it's a
    valid expense option. classifyLabel now treats a gift line as income by
    default (the app models Gift as income), but as an EXPENSE when a recipient
    is present (dative "lai"/"tina"/"tendsi"/"timarau" or "to <name>").
    e.g. "gift 100" → income/Gift; "gift 100 dd lai" → expense/Gift.
  - Food detection expanded with common English + Nepali terms
    (dahi=dudh/rice/bhat/dal/momo/roti/vegetable/tarkari/masu/chicken/egg/fruit…).
    A mixed label like "fruit dai" still maps to Food (description keeps "fruit dai").
    Unmatched names (janai, karuna, …) default to Other expense (editable).
  - tests: +2 (gift direction, Nepali food words). 22/22 pass, builds green.
  - NOTE: category lists now differ from desktop's by one entry (mobile adds "Gift"
    to personal expense categories). Desktop untouched per AGENTS.md §7.

  LATER SESSION (2026-09-03, +3) — import UX cleanup (feedback round):
  - Paste + review screens: replaced duplicate action bars (explicit "Back" +
    bottomNav Back + Home) with ONE 3-button row: [Back] [Home] [primary]. No
    repeated back buttons. "Back" uses true history go-back (data-back) so it
    returns to the settings section the user came from, not a hardcoded sub-menu.
  - Removed sample-data placeholder + the "date headers like 8/17…" hint from the
    paste screen; textarea now says "Paste your expenses or income note here…".
  - Split now tags both halves with a shared splitGroup id; added an "Undo split"
    button (visible on split halves) that merges the two halves back into one row.
  - Render now preserves scroll position on the import-review screen so edits /
    splits / deletes don't jump the viewport to another row.
  - StagedEntry gained optional splitGroup field. Tests still 22/22, builds green.

  LATER SESSION (2026-09-03, +4) — button layout + commit exit (feedback round 2):
  - Import paste + review screens: primary action ("Parse & review" / "Commit N rows")
    is now a full-width, centered button on its own row (.btn-stack/.btn-block),
    with [Back] [Home] stacked BELOW it. No more confusing 3-across row.
  - After a successful commit the user now lands on the main Settings screen
    (navigate("settings", { replace: true })) and importEntries is cleared, so
    there is no way to re-enter the already-committed review section (the review
    screen is also removed from the back-stack via history replace).

- [ ] 6. Excel-export round-trip verification
  Notes: (seed) Implement lossless SQLite ⇄ Excel export per docs/schema.md
  §3 and pass the round-trip test (export → re-import → byte-identical row
  data) before this phase is done.

- [ ] 7. Repo/release/versioning split (root scripts + GitHub Actions)
  Notes: (seed) Extend scripts/finledge.mjs, sync-version.mjs,
  verify-version.mjs, and start-release.mjs with a `--platform
  desktop|mobile` split; matrix GitHub Actions build keyed off
  desktop-v*/mobile-v* tag prefixes; add update-policy-mobile.json
  (see docs/techSpec.md).

- [ ] 8. Drive-as-sync
  Notes: (seed) Drive sync in its own phase (rules.md — Mobile; PLAN.md —
  Mobile deferred note). No live bank-flow sync yet.

- [ ] 9. Parity testing
  Notes: (seed) Shared test suite verifying desktop vs mobile computation
  parity for the ported services (rules.md — Backend/shared; AGENTS.md §8).

- [ ] 10. Release mobile-v1.0.0
  Notes: (seed) Tag mobile-v1.0.0 and publish the Capacitor/Android build to
  the mobile release channel via the CI pipeline.

## Sessions beyond the phases

Session 2026-09-05 (SQLite data layer finalization + on-device backup):
- data/store.ts: single in-memory row store (bankRecords, manualExpenseRows,
  shareRecords, transferRows) with hydrate/reload from SQLite and a demo
  fallback when the plugin is unavailable. demo-data.ts is now a facade
  re-exporting the live store arrays so screens import one place.
- data/repositories.ts: full CRUD — insertBankTransaction /
  insertPersonalFinanceRecord / insertShareTransaction / insertTransfer,
  delete* helpers, and commitKeepNotes writes through this layer (receive
  updated_device stamping). Keep Notes commit now calls reloadStore() after
  writing, so the UI reflects imported rows immediately.
- data/storage.ts: manages the app-private FinLedge[Dev] folder in
  Directory.Data (no scoped-file permission prompts): aggregate
  finledge_save.json full export + backup/<date>.json daily incremental
  (id/cursor-tracking), run once per day on open/resume, plus
  runStorageMaintenance/refreshStorageInfo and the Backup & sync storage
  info card + "Back up now" button.
- forms.ts: FormField tuples now carry an optional field name; field()/
  formCard()/addFormScreen() emit name= attributes and data-form ids.
  Screens tagged: bank-add, expenses-add, shares-add, transfer (with
  direction chips + notes).
- historyRows: rows tagged _table/_id get working delete buttons (bound via
  bindRowDeletes in main.ts); read-only synced rows never show them.
- main.ts: async bootstrap() (SQLite → demo fallback, boot notice, storage
  maintenance), per-form submit handlers, delete binding, transfer chips,
  backup-now, resume-maintenance listener. Remains bootstrap/render-loop/
  event-binding only.
- config.ts: defensive readMode so tsc/Node tests work where import.meta.env
  is undefined. Bank-flow queries/investment settings/updated_device export
  fixed; test list greened back to 22/22; builds + `cap sync android` +
  `gradlew :app:assembleDebug` → BUILD SUCCESSFUL; APK rebuilt. Dev build by
  default (DB finledge_mobile_dev, FinLedgeDev folder); production via
  VITE_FINLEDGE_MODE=production.

Session 2026-09-06 (functional fixes round 1 — transfers, updates, edits, filters):
- Transfers now MOVE money: data/mobile-data.ts shapes transfer rows per
  Bank/Cash flow so dashboard totals include the cash ⇄ bank shift (replacing
  the misleading old "transfer chip" card). Transfer rows show in the expenses
  history (Combined all, Bank/Cash tabs scoped by involved flow) tagged
  _table:"transfers" + _id, so they get delete + edit buttons.
- time default: transfer screen date defaults to today; field() now honors a
  provided date value for draft/edit rehydration instead of always today.
- Shares quick updates write for real: "Update IPO allotment" →
  updateShareAllotment (applies to the newest ipo row, recomputes FIFO);
  "Update SIP shares" → updateSipQuantity (adjusts newest installment row so
  total allotted equals the entered number, recomputes). Both throw (toast)
  when no matching rows exist and use the share-name suggestion panel.
- ✎ Edit buttons work: new screens/entry-edit.ts (per-table prefilled
  forms; share category select preserves raw values) + types.ts entry-edit
  ScreenId + appState.editingEntry. Save runs the new repositories
  updateBankTransaction / updatePersonalFinanceRecord (per flow) /
  updateTransfer (direction chips) / updateShareTransaction, then
  reloadStore() + toast + back.
- Income vs expense categories: availableHomeCategories() now filters by
  appState.homeMode so income mode never lists expense categories; mode
  switch resets selection.
- Shares add-entry draft: appState.shareFormDraft captures every named input
  and rehydrates on render, so switching entry type (IPO/SIP/buy/sell/
  dividend) no longer wipes user input; cleared after a successful submit.
- Keep Notes: disabled "Commit" now toasts "Resolve flagged rows before
  committing." (import already legitimately writes on confirm via
  repositories + reloadStore — nothing fake).
- Reuse pass (§10): extracted utils/form.ts formReader({ pick, toNumber })
  (was 3 duplicated copies in main.ts) and forms.ts selectWithCurrent()
  (entry-edit now reuses it instead of a local select helper).
- Verify: tsc + vite build clean, 22/22 tests pass, cap sync + gradle
  assembleDebug → BUILD SUCCESSFUL, APK rebuilt.

Session 2026-10-04 (mobile transfer replay validation):
- mobile/services/transfer-running-balance.ts: added a reusable full
  chronological replay validator for transfer mutations. It collects manual
  Bank/Cash income and expenses plus proposed transfer rows, orders by date
  then timestamp, and reports the first transaction that would push either
  flow below zero.
- mobile/src/data/repositories.ts: transfer create, update, and delete now
  validate the complete proposed post-change sequence across both Bank and
  Cash before writing. Plain manual expense entries are unchanged and can
  still make a flow negative.
- mobile/tests/sqlite-schema.test.ts: added regression coverage for direct
  delete breakage, indirect downstream delete breakage, edit breakage, and a
  delete that remains valid.

Session 2026-10-04 (mobile transfer + dashboard follow-up):
- transfer-running-balance.ts: refined replay validation to use income capacity
  rather than net after manual expenses. Manual income and prior transfer-in
  rows fund later transfer-out rows; manual expenses do not consume transfer
  capacity. Negative/insufficient source-flow income capacity still blocks the
  transfer.
- repositories.ts/sqlite-schema.test.ts: Personal Finance income writes now
  reject negative amounts on add and edit, keeping income totals non-negative.
- mobile/package.json: `npm run mobile:build` now runs the mobile test suite
  after the web build, so transfer/business-logic regressions fail the same
  command used for release checks.
- app-state.ts/styles.css: validation toasts now stay visible longer and wrap
  cleanly, so detailed "would leave Cash/Bank..." messages are readable.
- mobile-data.ts/expenses.ts: Personal Expenses now uses only manual Bank/Cash
  rows plus recorded Cash/Bank transfers. Bank Services and Share Portfolio are
  no longer shown inside the Personal Expenses Bank tab; they remain available
  through their own modules and the Financial Summary.
- summary.ts/history.ts: Financial Summary now ends with a read-only All history
  list spanning Bank Services, Share Portfolio, Personal Expenses, and
  transfers, ordered by Date, Created Timestamp, Last Updated Timestamp, then
  row identity.
- shell.ts and module screens: drawer version text shows `mobile-v1.0.0` only,
  and main mobile module screens drop explanatory description copy in favor of
  titles and actions.

Session 2026-10-04 (mobile dependency security pass):
- `npm audit` in mobile/ reported 3 findings (2 high, 1 critical — 8 advisory
  instances), all dev-tool-only; runtime app deps were never affected.
  Root cause: `@capacitor/assets@3.0.5` (icon generator) pins outdated
  transitive deps: nested `@capacitor/cli@5.7.8 → tar@6.2.1` (critical DoS /
  path-traversal cluster), `sharp@0.32.6` (libvips CVEs), `xcode → uuid@7.0.3`,
  and `brace-expansion@2.1.4` + top-level `brace-expansion@5.0.9` (quadratic
  expansion DoS GHSA-q2hr-2g5m-vwhr) under cli's glob/minimatch.
- Fix (mobile/package.json `overrides`, applied via a clean lockfile
  re-resolution): force `tar@7.5.22` inside assets' nested cli,
  `sharp@^0.35.4`, `uuid@^11.1.1` under `@trapezedev/project → xcode`, and
  `brace-expansion@^5.0.12` tree-wide. Removed the stale non-standard
  `allowScripts` field (it pinned sharp@0.32.6).
- Verified the overrides preserve behavior: `@capacitor/assets` never imports
  `@capacitor/cli` at runtime (grep of its dist), so aligning its nested cli
  was unnecessary — only its transitive deps were patched. `npm audit` → 0
  vulnerabilities; npm ls clean (tar 7.5.22 deduped, sharp 0.35.5 + libvips
  8.18.7, uuid 11.1.1, brace-expansion 5.0.12).
- No breakage: `tsc` clean, 30/30 tests pass, vite build clean (66 modules),
  `npx cap sync android` clean (4 plugins), `gradlew :app:assembleDebug` →
  BUILD SUCCESSFUL, APK rebuilt; `@capacitor/assets --help` boots and sharp
  resize smoke test passes.
- Note for future agents: do not remove these `overrides` — `@capacitor/assets`
  is unmaintained upstream (3.0.5 is latest) and its vulnerable transitive
  tree is reinstated on any plain `npm install` that drops them.

Session 2026-10-04 (mobile UX + Keep Notes import fixes):
- transfer-running-balance.ts: simplified transfer rejection copy so the toast
  says only the relevant source flow and available income, without exposing
  replay internals to the user.
- main.ts/app-state.ts/forms.ts: successful Add-entry submits stay on the same
  Add screen and preserve selected fields for repeat entry. Bank and Personal
  Expenses keep date/category/type/flow selections; Transfer keeps the chosen
  direction chip after saving.
- home.ts/mobile-data.ts: Home category analysis now uses the active Week/
  Month/Year/Custom range instead of current-month-only data, with a filter
  sheet for selecting specific categories.
- main.ts/store.ts: browser preview now falls back immediately to demo data
  instead of waiting on unavailable web SQLite, and demo Personal Expense rows
  include their dates so time-range category filters can be visually verified.
- keep-notes-parser.ts/keep-notes-commit.ts/review.ts: Keep Notes parsing still
  stages only; commit now respects edited review values, supports Transfer rows
  through the transfer repository, and parses mixed `cash ... online` income
  lines into separate Cash/Bank income rows.
- tests: added parser and repository coverage for staged transfer rows, mixed
  cash/online income splitting, edited Cash→Bank review rows committing to Bank
  history, and confirmed transfer rows committing through `transfers`.

Session 2026-10-04 (mobile polish — signs, tap states, compact totals):
- home.ts/styles.css: Home's three balance totals now use a compact
  three-column row even on narrow phones, instead of collapsing into a tall
  single column when there is still enough horizontal space.
- expenses.ts: removed redundant Bank/Cash "Total income" and "Total expense"
  stat cards from the Personal Expenses dashboard; the useful Income, Expense,
  transfer movement, and Net cards remain.
- history.ts/bank.ts/shares.ts: history row signs and colors now follow the
  business meaning of the transaction. Bank Services treats only Interest
  Earned as income; charges render as red negative rows. Share Portfolio treats
  sell, cash dividend, and SIP redeem as income; IPO/buy/SIP installment render
  as red negative rows.
- styles.css: disabled mobile tap-highlight rectangles, kept keyboard
  `:focus-visible` feedback, and added reduced-motion handling to cut visual
  churn on devices that request it.

Session 2026-10-04 (Home totals row — flexible auto-fit, supersedes the
"compact totals" bullet in the mobile polish session above):
- styles.css: `.home-total-row` no longer hard-forces three equal columns.
  It now uses `repeat(auto-fit, minmax(96px, 1fr))`, and `minmax(92px, 1fr)`
  inside the `≤338px` media query — that override also runs *after* the
  `.split-3 { grid-template-columns: 1fr }` rule there, so the row is never
  forced into a single tall column on small screens.
- Resulting behavior, per the user's rule: all three totals sit in one row
  whenever content width is enough (≥ ~308px, ~296px on small screens);
  column count drops to 2+1 by grid auto-fit when values/labels are too wide,
  and only goes single-column below ~194px of content space (never on real
  phones). Large amounts wrap via existing `overflow-wrap: anywhere` instead
  of crushing text.
- home.ts markup unchanged (`split split-3 home-total-row`); only the CSS
  grid was loosened.
- Verify: `npm run mobile:build` exit 0, mobile tests green (34/34), 360px
  preview measurement showed the row laying out 2+1 instead of squeezing
  three tiny cells; preview server stopped afterwards.

Session 2026-10-04 (UX bug fixes — home category filter, import add-row, history amounts):
- screens/home.ts: `manualRowsForSelectedRange()` now uses proper period windows
  for the category bars and stats. Previously it passed ALL 90 daily buckets
  (the chart's scroll-depth history) to the filter, so "Week" showed 90 days of
  category totals instead of 7. Fixed per range: week -> rolling 7 days, month ->
  rolling 30 days, year -> last 12 calendar months, custom -> exact custom range.
  The scrollable bar chart is unaffected (it still generates its own 90 buckets).
  Imports: added addDays and toDateKey from utils/date.ts.
- main.ts: data-import-add-row handler now captures the new entry reference
  before pushing it so scrollIntoView can target the new card by its id after
  render(). Uses requestAnimationFrame to wait for the DOM repaint. The user
  now sees the newly created card immediately instead of wondering if the button
  did anything.
- styles.css: split .history-row / .settings-row shared block so .history-row
  uses align-items: flex-start (top-align for multi-line descriptions) while
  .settings-row keeps align-items: center. Added .history-row .meta
  (flex:1; min-width:0) so the left-side text can shrink, and .history-row .money
  (flex-shrink:0; white-space:nowrap) so the amount never wraps mid-token
  (no more "-Rs" on one line and "1,000" on the next). Left-side text uses
  overflow-wrap: break-word to wrap at word boundaries when it is long.
- Verify: npm run build exit 0, 34/34 tests pass.
- Docs touched: TASKS-mobile.md (this entry).
- Static source/HTML check only -- rendered-in-browser verification was NOT performed.

Session 2026-10-04 (Home category compact header + Import clear/undo):
- screens/home.ts: Replaced the two-element section-title + separate period-controls
  blocks with a single .cat-header container. .cat-header-top holds the title,
  filter chip, and "View dashboard" link all in one flex row. inlinePeriodTabs()
  renders the Week/Month/Year/Custom segmented tabs directly beneath it — no
  wrapper card or extra padding between them. Removed the now-unused periodControls
  import from charts.ts.
- screens/keep-notes/paste.ts: Added a red "Clear" button (data-import-clear)
  next to the textarea label — only visible when there is text to clear. Clicking
  it saves the text to appState.importClearUndo + importClearTime, then wipes
  importPasteDraft. An "Undo" pill bar (data-import-undo-clear) appears above
  the textarea while the 5-minute window is open; it disappears after the window
  expires (next render checks Date.now() - importClearTime). After 5 minutes the
  cleared text is permanently gone. Also wired textarea input -> importPasteDraft
  sync so the draft stays current as the user types.
- app-state.ts: Added importClearUndo (string | null) and importClearTime (number)
  fields to hold the clear undo buffer.
- main.ts (bindImportEvents): Added data-import-clear handler (saves+clears),
  data-import-undo-clear handler (restores if within 5 min, then nulls the buffer),
  and data-import-note input handler (keeps importPasteDraft in sync while typing).
- styles.css: Added .cat-header, .cat-header-top, .cat-period-tabs, .cat-dash-btn
  rules for the compact category header; added .import-paste-head, .import-paste-label,
  .import-clear-btn, .import-undo-bar, .import-undo-label for the paste screen.
- Verify: npm run build exit 0, 34/34 tests pass.
- Docs touched: TASKS-mobile.md (this entry).
- Static source/HTML check only -- rendered-in-browser verification was NOT performed.

Session 2026-10-07 (Import UX polish — add-row instant jump, Clear/Undo in-place toggle):

BUG 1 — Add row scroll animation was jarring.
- main.ts: Changed scrollIntoView({ behavior: "smooth" }) to { behavior: "instant" }
  in the data-import-add-row click handler. The new card now appears without
  any scroll animation — it simply jumps into view immediately.

BUG 2 — Clear button not visible after pasting (only appeared after navigate away+back),
         and the Undo card caused layout shift (page moving up/down on click).
Root cause A: The data-import-note input handler only updated appState.importPasteDraft
  but never called render(), so the Clear button that depends on hasText was never
  shown while the user stayed on the screen.
Root cause B: The previous design used a separate .import-undo-bar card that appeared
  above the textarea section when undo was available — causing the entire card section
  to shift down/up on clear/undo clicks.

Fix:
- paste.ts: Removed the separate undo bar card entirely. The Clear/Undo is now a
  single .import-note-action button that always occupies the same spot in the
  .import-paste-head row (right side, beside the "Raw note text" label). It is
  rendered as visibility:hidden (not display:none) when neither state applies, so
  the row height is always stable and no layout shift occurs. When undo is
  available it shows "Undo" (teal); when there is text it shows "Clear" (red).
- main.ts: Added syncImportActionBtn() — a lightweight DOM patcher that directly
  swaps the button's text, class, data-attribute, and visibility WITHOUT calling
  render(). Called from the data-import-note input handler on every keystroke/paste
  so the button appears the instant the user types or pastes, without a full
  re-render (which would reset cursor position and scroll). The clear/undo click
  handlers still call render() (single click, acceptable) which re-renders the
  whole paste screen with the correct initial state.
- styles.css: Replaced .import-clear-btn / .import-undo-bar / .import-undo-label
  with .import-note-action (base), .import-note-clear (red), .import-note-undo
  (teal). Added min-width:36px and text-align:right to prevent width jitter
  between "Clear" (5 chars) and "Undo" (4 chars).

- Verify: npm run build exit 0, 34/34 tests pass.
- Docs touched: TASKS-mobile.md (this entry).
- Static source/HTML check only -- rendered-in-browser verification was NOT performed.
Session 2026-10-07 (Import UX: clear button fix + add row at top):

BUG 1 -- Clear/Undo button not clickable.
Root cause: bindImportEvents() used document.querySelector("[data-import-clear]") to attach
  the listener. At bind time the button starts attribute-less (visibility:hidden, no data-*),
  so querySelector returned null and no listener was ever attached. Swapping the attribute
  live via syncImportActionBtn() didn't help because the listener was never bound.
  Additionally the block was inside bindImportEvents() which is called on every render(),
  so any delegated listener attached to #app would accumulate on each render.

Fix:
- main.ts: Added initImportPasteDelegation() -- a ONE-TIME delegated listener attached to
  document.body at bootstrap(), before the first render(). It checks event.target.closest()
  for [data-import-clear] and [data-import-undo-clear] so it works regardless of when the
  data-* attribute is set or removed. Being on document.body it only fires once ever -- no
  accumulation across renders.
- main.ts: Removed the broken per-element querySelector bindings for data-import-clear and
  data-import-undo-clear from bindImportEvents() entirely. Also removed the previous
  delegated block that was incorrectly inside bindImportEvents() (would have multiplied).
- The data-import-note input handler stays in bindImportEvents() (rebinds each render,
  correct because the textarea element is replaced each render).

BUG 2 -- Add row: still felt awkward with scroll.
Fix: Changed appState.importEntries.push(newEntry) to .unshift(newEntry) in the
  data-import-add-row handler. New row is inserted at the TOP of the list so it is
  immediately visible without any scrolling. The scrollIntoView call now just ensures
  .import-rows top is in view (instant, no animation).

- Verify: npm run build exit 0, 34/34 tests pass.
- Docs touched: TASKS-mobile.md (this entry).
- Static source check only -- rendered-in-browser verification NOT performed.

Session 2026-10-07 hotfix (Parse & review button broken):
Bug: data-import-parse click handler was accidentally deleted during the Clear/Undo
delegation refactor (fix_import_ux.py merged parse into a delegated block on #app,
then fix_delegation.py stripped that entire block, leaving no parse handler anywhere).
Fix: Restored document.querySelector('[data-import-parse]')?.addEventListener(...)
at the top of bindImportEvents() in main.ts — the standard per-render querySelector
pattern is correct here since the button is always in the DOM when the paste screen
is rendered. Verified all other import handlers (add-row, search, commit, row actions,
clear, undo-clear) are still present and correct.
Verify: npm run build exit 0, 34/34 tests pass.
Static source check only -- rendered-in-browser verification NOT performed.

Session 2026-10-07 hotfix (add-row: stop viewport from moving on click):
Removed the requestAnimationFrame + scrollIntoView call from the data-import-add-row
handler. New row is already inserted at the top of the list via unshift(), so it sits
right below the toolbar button after render() -- no scroll needed. The render()
preserveScroll logic restores the previous scrollTop so the page position is stable.
Verify: npm run build exit 0, 34/34 pass.