# Desktop Backend Phase 0 Audit

Date: 2026-10-22

Scope: desktop backend organization and write paths, plus implementation work for
desktop Phase 1. The shared mobile-edited planning files were read as constraints
and left unchanged. No mobile files were inspected for edits or modified.

## Phase 0 findings

The backend has the expected top-level separation between `routes/`, `services/`,
and `models.py`. Bank, Share Portfolio, Personal Expenses, Settings import/export,
and Financial Summary each have service-layer entry points; route handlers delegate
to services instead of directly editing Excel files.

Several service files are now large enough to mix multiple concerns:

- `backend/services/personal_finance_service.py` combines Bank Flow and Cash Flow
  workbook I/O, transfer persistence and validation, synced view-row construction,
  and summary calculations. It is the clearest candidate for a future desktop-only
  split into focused modules, while keeping the current service API stable.
- `backend/services/share_service.py` combines Excel persistence, FIFO lot matching,
  and transaction calculations. A future split could move the lot-matching and
  calculation helpers behind the same service API.
- `backend/services/settings_service.py` combines workbook import/export, format
  normalization, staging, and live-file replacement. This should be mapped before
  any refactor because import safety and existing backup behavior are sensitive.
- `backend/models.py` is the shared Pydantic model and enum registry. It is not
  currently one function-heavy file, but may need module-scoped model files as the
  desktop backend grows; such a move would require updating imports consistently.

The existing per-module service boundary is useful and should remain the public
boundary for routes. Phase 1 adds one reusable helper in `excel_utils.py` rather
than copying backup logic into each service.

## Phase 1 implementation record

- Added automatic pre-write snapshots under
  `backups/auto/<workbook-stem>/<UTC timestamp>.xlsx`.
- Added retention for every snapshot under 24 hours, the newest snapshot per day
  for ages 24 hours–30 days, and the newest snapshot per calendar month for ages
  30–365 days. Pruning only
  enumerates direct `.xlsx` files in the specific `backups/auto/<workbook-stem>`
  directory.
- Wired the helper to Bank Services, Share Portfolio, Personal Expenses Bank/Cash
  Flow, transfer, and persisted share-sync mutation paths. Settings import remains
  on its existing backup flow.
- Snapshot failures raise a plain-language error before the live workbook save.
- Recovery scans already include `backups/auto/`, while continuing to exclude any
  path under `backups/corrupted/`. Successful recovery records a warning that the
  data routes return and the desktop pages display.
- Settings → Backup now shows the automatic backup folder and an open-folder action.

## Verification status

`pytest backend/tests/` passed: 75 passed. The frontend production build passed.
The Backup panel was opened in a browser preview and visually inspected. The
development update overlay obscured part of the panel, and the browser preview
does not provide the Electron bridge, so the backup-folder path and native open
action were not verified in the packaged desktop app. No live/dev workbook
directories were used for verification.
