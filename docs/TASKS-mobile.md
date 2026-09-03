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
