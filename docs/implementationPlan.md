# Implementation Plan — mobile-v1.0.0 phased execution

Execution roadmap only. One paragraph per phase, in order, from
TASKS-mobile.md's 10 phases. Each paragraph states the goal, the
deliverable, and the exit criteria for that phase.

## 1. Scaffolding

Goal: stand up the Capacitor runtime so the mobile app builds and boots as
a native Android app wrapping the existing web frontend, with SQLite
available on-device. Deliverable: the Capacitor Android project wired to
`frontendwebapp`, `@capacitor-community/sqlite` initialized and usable, and
a `mobile/src` entry that renders the web UI. Exit criteria: `mobile-build`
runs end-to-end, the app launches on Android, and a SQLite database can be
opened/created on-device without error.

## 2. Port shared business logic

Goal: reimplement the desktop backend computation on-device so mobile never
shells out to Python. Deliverable: TypeScript service modules for bank
category totals, share FIFO lot-matching, and personal-finance sync-row
computation (in `mobile/services/`), mirroring their `backend/services/`
counterparts. Exit criteria: each ported service runs and its unit results
match the corresponding Python service on the same inputs.

## 3. SQLite schema + data layer (incl. updated_device column)

Goal: create the on-device data layer defined in docs/schema.md with the
`Updated Device` column across both platforms. Deliverable: the five SQLite
tables (bank_transactions, share_transactions, personal_finance_bank_flow,
personal_finance_cash_flow, transfers) implemented on-device, plus the
matching `Updated Device` header on the three desktop services with the
backup-then-replace migration (default `"desktop"` for existing rows). Exit
criteria: schema matches docs/schema.md, the migration runs non-destructively,
and existing rows carry the default `updated_device`.

## 4. UI build (responsive across phone sizes)

Goal: build the mobile screens from docs/design.md (dark tokens, Inter,
tabular-nums) and docs/appflow.md (Home → drawer → module Add-entry ⇄
Dashboard pairs → Summary → Settings → Import/Export). Deliverable:
functional screens using relative/flex layouts with no fixed 390px frame.
Exit criteria: all screens render legibly and consistently between 360px
and 430px, and every module is exactly the Add-entry ⇄ Dashboard pair.

## 5. Keep Notes bulk import

Goal: let users paste raw notes and import them with a review gate rather
than re-entering by hand. Deliverable: the parser and review/edit screen
per docs/keepNotesImport.md — paste → parse preview/review → confirm →
commit, writing through the same service layer as manual entries. Exit
criteria: parsed items are staged with assigned module/category, editable,
splittable, deletable and searchable, and nothing commits without user
confirmation.

## 6. Excel-export round-trip verification

Goal: guarantee data can move losslessly between mobile SQLite and desktop
Excel. Deliverable: the SQLite-column → Excel-header export mapping and
re-import path per docs/schema.md §3. Exit criteria: the round-trip test
passes — export → re-import → byte-identical row data, with `transfers`
excluded and `id` not written to the worksheet.

## 7. Repo/release/versioning split (root scripts + GitHub Actions)

Goal: trigger both platforms from the root the same way, and publish each
to its own channel. Deliverable: `scripts/finledge.mjs`, `sync-version.mjs`,
`verify-version.mjs`, and `start-release.mjs` accept a `--platform
desktop|mobile` split (or `*-mobile.mjs` siblings), a matrix GitHub Actions
build keyed off `desktop-v*`/`mobile-v*` tag prefixes, and
`update-policy-mobile.json`. Exit criteria: `mobile` tags build and publish
to the mobile channel, `desktop` tags still publish to the desktop channel,
and mobile's update check uses a dismissible banner.

## 8. Drive-as-sync

Goal: add cloud sync for the mobile app in its own phase, keeping it
separate from the desktop/local flow. Deliverable: Drive sync as a distinct
feature per rules.md and PLAN.md, with no live bank-flow sync in this phase.
Exit criteria: sync works for the mobile data set in its own phase and does
not introduce live bank-flow sync or block normal local operation.

## 9. Parity testing

Goal: prove desktop and mobile compute identical numbers. Deliverable: a
shared test suite that runs the same business-logic cases against both
platforms' service layers. Exit criteria: the shared suite passes with
bit-for-bit matching output for every ported service (rules.md —
Backend/shared; AGENTS.md §8).

## 10. Release mobile-v1.0.0

Goal: ship the first mobile release to users. Deliverable: `mobile-v1.0.0`
tag with the Capacitor/Android build published to the mobile release
channel via CI. Exit criteria: the tagged build is published, the update
policy reflects `mobile-v1.0.0` as latest, and the release is installable
on Android.
