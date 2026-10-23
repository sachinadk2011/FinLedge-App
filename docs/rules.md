# Rules

## Desktop rules

- Never restructure app nav (existing Hard Constraints from PLAN.md).
- Never consolidate dashboards (existing Hard Constraints from PLAN.md).
- Migrations never destroy data (existing Hard Constraints from PLAN.md).

## Mobile rules

- Own runtime and service layer — logic is ported into the app, not
  shelled out to a backend process.
- SQLite is the source of truth on-device.
- Excel export must be lossless and re-importable.
- Drive-sync ships only in its own phase.
- No live bank-flow sync yet.

## Backend/shared rules

- Ported business logic must match `backend/services/` output bit-for-bit
  for shared test cases.
- Category lists, once centralized, must not drift between platforms.
- Schema changes — like `updated_device` — must land on both desktop and
  mobile schemas together, with a migration path, never mobile-only.
