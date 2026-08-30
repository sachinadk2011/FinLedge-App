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

- [ ] 4. UI build (responsive across phone sizes)
  Notes: (seed) Build the mobile UI from docs/design.md and docs/appflow.md.
  Responsive relative/flex layouts tested from 360px–430px; module screens
  are Add-entry ⇄ Dashboard pairs (never combined). Fixed drawer brand asset
  packaging, drawer pictogram icons, chart compact-money formatting/color
  audit issues, Settings sub-navigation, mobile form/dashboard parity gaps,
  and confirmed `main.ts` remains bootstrap/render-loop/event-binding only.
  Browser/ADB-based on-device 360px/430px visual verification is still
  needed in an environment with a connected browser or Android device bridge.

- [ ] 5. Keep Notes bulk import
  Notes: (seed) Implement the Keep Notes parser and review/edit screen per
  docs/keepNotesImport.md: paste → parse preview/review → confirm → commit,
  writing via the same service layer as manual entries.

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
