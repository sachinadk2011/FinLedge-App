# Rules — Shared Business, Identity and Synchronization Rules

**Status:** Phase 1 design finalization — implementation not started.
This file defines behaviour. The data model is in `docs/schema.md`; safety is
in `docs/SAFETY.md`; transfer protocol is in `docs/device-transfer.md`.

Existing rules in this file are preserved. New sections are additive; where a
current implementation contradicts a rule below, the contradiction is recorded
in §20 and resolved in Phase 2, not silently reinterpreted.

---

## 0. Existing platform rules (unchanged)

### Desktop rules

- Never restructure app nav (existing Hard Constraints from PLAN.md).
- Never consolidate dashboards (existing Hard Constraints from PLAN.md).
- Migrations never destroy data (existing Hard Constraints from PLAN.md).

### Mobile rules

- Own runtime and service layer — logic is ported into the app, not
  shelled out to a backend process.
- SQLite is the source of truth on-device.
- Excel export must be lossless and re-importable.
- Drive-sync ships only in its own phase.
- No live bank-flow sync yet.

### Backend/shared rules

- Ported business logic must match `backend/services/` output bit-for-bit
  for shared test cases.
- Category lists, once centralized, must not drift between platforms.
- Schema changes — like `updated_device` — must land on both desktop and
  mobile schemas together, with a migration path, never mobile-only.

### Additional Phase 1 rules

- `docs/schema.md` is the single data-model authority. No table, column,
  constraint or index may exist in code without first existing there.
- The service layer is the only writer. Routes validate and delegate; UI
  components never compute authoritative financial values or write SQL.
- One shared implementation per rule. If two modules need the same calculation,
  it lives in one function; duplicated copies of stamping or hashing are forbidden.
- Financial formulas are versioned by tests. A change to a formula is a
  decision change, not a refactor.

---

## 1. Identity model

### 1.1 UUID lifecycle

| Event | `row_id` behaviour |
|---|---|
| Create | New UUID v4, cryptographic randomness, generated in the service layer |
| Read | Never changes |
| Edit | Never changes; the edit targets the existing UUID |
| Delete | The UUID moves to `deleted_records`; it is never reused |
| Import with a valid UUID | Preserved exactly |
| Import with no UUID | Deterministically generated (§1.2) |
| Transfer | Preserved exactly; the receiving device adopts the sender's UUID |
| Replace mode | Incoming UUIDs are preserved; replaced locals are tombstoned |

Rules:

1. A UUID identifies one logical transaction for its entire life.
2. Two legitimate transactions are never merged into one UUID, even when their
   business fields are identical.
3. An edit never mints a new UUID. A "delete + create" is two transactions and
   must be explicit.
4. UUIDs are stored as lowercase canonical text and are unique by primary key
   in every transaction table.
5. A UUID from one table may never be silently reused in another table. The
   `entity_type` is part of the logical address.

### 1.2 Legacy identity generation

For a row with no usable UUID, the canonical identity key is:

```text
identity_key = sha1(
    identity_scope
    + canonical_business_payload
    + normalized_created_timestamp
) + "#" + occurrence_ordinal
row_id = uuid5(NAMESPACE_URL, "finledge-row-v1:" + identity_key)
```

This is exactly the current `workbook_merge.ensure_row_metadata()` rule, kept
for compatibility:

- `identity_scope` is the workbook/sheet scope, e.g.
  `bank_transactions.xlsx#bank`, `share_transactions.xlsx#share`,
  `personal_finance_transfer.xlsx#transfer flow`.
- `canonical_business_payload` is the table's business fields after the
  normalisation in §2.3.
- `normalized_created_timestamp` is the row's `Created Timestamp` after the
  coercion in §3.3.
- `occurrence_ordinal` distinguishes genuinely identical historical rows that
  have no other distinguishing attribute. It is assigned deterministically
  and persisted in `legacy_identity_map`.

Rules:

- The UUID is **not** derived from business fields alone; the created timestamp
  and occurrence ordinal are part of the key.
- The mapping in `legacy_identity_map` always wins over a fresh computation.
  Re-importing the same legacy workbook therefore produces the same UUIDs even
  if row order changed.
- Never generate a UUID from a hash of date + amount + description + category
  alone. Two separate transactions can be identical.
- A legacy row that already has a valid UUID keeps it, even if its business
  content later changes.

### 1.3 UUID vs content hash

| | `row_id` | `content_hash` |
|---|---|---|
| Purpose | Identity | Change/integrity detection |
| Changes on edit | No | Yes |
| Used for dedupe | Yes | No |
| Used for merge ranking | No | Yes, as a final tie-breaker |
| Derived from business fields | Only for legacy UUID generation | Yes |
| Interchangeable | **No** | **No** |

For `share_transactions` and `sip_transactions`, `transaction_type` is immutable and included in the business hash; for `dividend_events`, `event_type` is immutable and included in the hash. Each SIP plan UUID is separately generated and stored with the SIP name; each SIP event carries it. A same-UUID/same-hash pair means "already synchronized". A same-UUID/different-
hash pair is a conflict. A different-UUID/similar-content pair is a possible
duplicate. None of these may be inferred from the hash alone.

### 1.4 Malformed and duplicate IDs

| Case | Rule |
|---|---|
| Valid UUID | Use it, verify uniqueness |
| Malformed UUID | Stage the row as `invalid`; offer deterministic re-mint; record the original text in the import report. Never silently reuse it |
| Duplicate UUID within one import | Keep the first by deterministic order; stage the rest as `possible_duplicate` for the user; never drop silently |
| Duplicate UUID across tables | Reject with an explicit message; a UUID belongs to one entity |
| Blank UUID | Generate per §1.2 |
| UUID with uppercase/braces | Normalise to canonical lowercase before comparison |

---

## 2. Content hash

### 2.1 Algorithm and format

- New hashes: `sha256:<64 lowercase hex>`.
- Legacy hashes: bare 40-hex SHA-1 are recognised on import, optionally
  verified, and replaced by the canonical SHA-256 value.
- The algorithm is explicit in the stored value. A bare 40-hex value is never
  written by the new code.
- SHA-1 is retained only as an import-compatibility check; it is not a
  security primitive and must not be used for authentication.

### 2.2 Canonical inputs

The hash input is a JSON object of the table's business fields, serialised with
sorted keys and no insignificant whitespace:

| Table | Hashed fields |
|---|---|
| bank_transactions | date, category, amount, description |
| personal_finance_entries | date, flow_type, direction, category, amount, description, source, source_ref |
| share_transactions | date, canonical share name, transaction_type, per_unit_price, charge, quantity |
| sip_transactions | date, investment_name, sip_plan_id, transaction_type, amount, charge, units |
| dividend_events | date, canonical share name, event_type, cash_amount, quantity |
| transfers | date, direction, amount, description, source_ref |
**Share rows hash the canonical share NAME, not `share_id`.** Each device mints its
own local `share_id` for the same share, so `share_id` must never enter
`content_hash`. The hash input resolves `shares.name` and uses that canonical name.
The transfer payload follows the same rule, so two devices hashing the same business
row agree even when their local UUIDs differ. SIP rows keep hashing their
`investment_name` because SIP names are not `shares` rows.

**Legacy SHA-1 verification uses the legacy field set, not this table.** The current
`workbook_merge.BUSINESS_FIELDS` hashes `Buy/Sell` for share rows and the pre-split
Personal Finance columns; a legacy workbook's SHA-1 can only be verified by replaying
that exact field set and normalisation. Canonical SHA-256 hashes use the canonical fields
above, with `buy_sell` reconstructed only for export, not hashed. A legacy SHA-1 is
replaced by the canonical SHA-256 after verification; it is never compared to a
canonical SHA-256.

Excluded from every hash:

- `row_id`, `sequence_no`
- `created_timestamp`, `last_updated_timestamp`, `updated_device`,
  `metadata_quality`
- every derived value (cumulative amount, total amount, profit/loss,
  cumulative profit, holding cost, average cost)
- the hash itself

This matches the current `BUSINESS_FIELDS` intent. The current `share` set
excludes `Total Amount` and `Profit/Loss`, which are derived; the canonical
set excludes them explicitly.

### 2.3 Normalisation

- Dates: `YYYY-MM-DD`.
- Money and prices: canonical scaled integer; no float conversion.
- Text: Unicode NFC, trim, collapse internal whitespace runs to one space.
- Share names additionally upper-case after that normalization (§7.11); SIP names keep the general text rule.
- Categories, flow types, directions, buy/sell, source: trim + casefold.
- Empty text and `NULL` are distinct (`""` vs `null`) and are normalised
  consistently on both platforms.
- Null optional fields hash as JSON `null`.

### 2.4 Recalculation

- Recalculate on every authoritative write.
- Recalculate on export from the authoritative fields, not by trusting a stored
  value.
- On import, a provided hash is compared after normalisation; a mismatch is an
  integrity warning, not an automatic rejection.
- A stale stored hash is repaired on the next write; reads never repair.

### 2.5 Relationship to sync

`content_hash` answers "did the business content change?" It does not answer
"which version is newer?" Merge ranking uses timestamps and device only as
supporting evidence, and the hash as a deterministic final tie-breaker. See
§14.

---

## 3. Timestamp rules

### 3.1 Representation

- Canonical: `YYYY-MM-DDTHH:MM:SS.ffffffZ`, UTC, always six fractional digits.
- Fixed width makes lexical order equal chronological order.
- `txn_date` remains a separate local calendar date. Never replace it with a
  timestamp.

### 3.2 Creation and edit

| Event | `created_timestamp` | `last_updated_timestamp` | `updated_device` |
|---|---|---|---|
| Create | now | now (same value) | current device |
| Real edit | unchanged | now | current device |
| No-op edit | unchanged | unchanged | unchanged |
| Delete | The live row is removed; its original timestamps are never rewritten | Not changed | Deletion recorded separately in `deleted_records` |
| Import of a new row | source value, or backfill | source value, or `created` | source value, or `legacy` |
| Migration | source value exactly | source value exactly | source value exactly |
| Transfer commit | source value | source value | source value (the originating device) |

"Material change" means any hashed business field changed. A request that
rewrites identical values, reorders `sequence_no`, or changes only display
state is not material.

### 3.3 Legacy coercion

Exactly as `docs/schema.md` §9.4:

- Offset-aware value → convert to UTC, `metadata_quality='legacy_offset'`.
- Naive value → preserve digits, append `Z`, no shift,
  `metadata_quality='legacy_naive'`.
- Date only → midnight UTC, `legacy_date_only`.
- Empty with a date → midnight UTC, `backfilled`.
- Empty with no date → import time, `imported_missing` (last resort; must be
  reported, because it is not historically stable).
- Migration never uses `now()` for a row that has any original date.

### 3.4 Ordering

- Transactions are replayed in `(txn_date, sequence_no)` order.
- Same-date rows therefore keep their workbook/insertion order.
- `sequence_no` never changes on edit.
- Deleting a row leaves a gap; remaining rows are not renumbered.
- On transfer, the receiving device assigns `sequence_no`: Smart Merge appends after
  the current maximum in staged order, Replace assigns `1..N` in sender order. The
  sender's `sequence_hint` is advisory (device-transfer §9.4).
- If a future feature supports user reordering, it rewrites `sequence_no` for
  the affected table inside one transaction and records the change; identity
  and timestamps do not change.
- Unified history sorts by `(txn_date, sequence_no, row_id)` within the
  share/dividend family and places SIP rows after them on the same date, as
  defined in `docs/schema.md` §6.2, so the order is total and stable across
  reads.

---

## 4. Device identifiers

Canonical values:

`desktop-exe`, `desktop-appx`, `desktop-dev`, `desktop-test`, `mobile`,
`legacy`.

Rules:

- Normalise by trim + lowercase.
- `desktop` normalises to `legacy` (historical alias).
- Any unknown value normalises to `legacy`, with a warning; it is never
  silently stored as an arbitrary string.
- Assignment: Electron sets `FINLEDGE_DEVICE_ID` before the backend starts
  (`desktop-test` for any testing build, `desktop-dev` for source,
  `desktop-appx` for packaged AppX, `desktop-exe` otherwise). Mobile uses
  `mobile`.
- `updated_device` records the last writer of the business content, not the
  last reader.
- Migration preserves existing labels; missing labels become `legacy`.

---

## 5. Bank calculations

### 5.1 Sign convention

- `Interest Earned` is income and is stored positive.
- Every other bank category is a charge/expense and is stored negative.
- The frontend currently normalises the sign (`bankApi.js`: absolute value for
  `interest earned`, negative otherwise) and the backend validates it
  (`BankAddRequest.validate_amount_sign`). In SQLite the same invariant is
  enforced by the shared service: sign is derived from category once, then
  validated.
- `BANK_INCOME_CATEGORIES` includes `interest earned` and the legacy `income`.
  The `BankCategory` enum does not contain `income`; a legacy `Income` row must
  be imported and flagged rather than rejected. This is a known mismatch, not
  a new category.

### 5.2 Cumulative amount

Current behaviour:

- On append: `cumulative = previous row's cumulative + amount`.
- On edit or delete: every row from the first change onward is recomputed as a
  running sum over the physical row order.

Canonical rule:

```text
cumulative(row) = sum(amount of all rows with sequence_no <= row.sequence_no)
```

Worked example:

| sequence | amount | cumulative |
|---|---|---|
| 1 | +1000.00 | 1000.00 |
| 2 | −200.00 | 800.00 |
| 3 | +50.00 | 850.00 |

Deleting row 2 yields 1000.00 and 1050.00. Editing row 1 to +900 yields 900.00,
700.00, 750.00.

Cumulative amount is derived, never stored authority. Export writes it; import
ignores it and recomputes.

### 5.3 Summary

- `total_income` = sum of income-category amounts.
- `total_expenses` = sum of `abs(expense amounts)`.
- `net_balance = total_income − total_expenses`.
- Category totals use absolute values for expenses.
- Frontend summary code must be replaced by a call to the authoritative
  service/API result; it must not independently recompute these values.

---

## 6. Personal finance calculations

### 6.1 Manual entries

- `amount` is always positive (`gt 0`).
- `direction` is `income` or `expense`.
- `signed_amount = +amount` for income, `−amount` for expense.
- Income categories and expense categories are disjoint; a mismatch is
  rejected with a clear message.
- `flow_type` is `bank` or `cash`; the two screens/exports remain separate even
  though storage is unified.

### 6.2 Summary

Per flow:

```text
total_income   = sum(amount where direction = income and source != transfer)
total_expenses = sum(amount where direction = expense and source != transfer)
net            = total_income - total_expenses
```

Transfers adjust income on each side from the transfer's `signed_amount`:

- positive signed amount → `total_income += amount`, `income += amount`,
  `transfer_in += amount`
- negative signed amount → `total_income -= amount`, `income -= amount`,
  `transfer_out += amount`

Combined totals sum the two flows. `overall_net = overall_income −
overall_expenses`.

### 6.3 Derived rows (read-only)

- `bank-services-sync` rows come from Bank Services transactions.
- `share-sync` rows come from Share Portfolio activity.
- They are never copied into `personal_finance_entries`.
- They are excluded from manual income/expense totals when
  `source in {share-sync, bank-services-sync}`.
- `SHARE_ONLY_CATEGORIES` (`investment`, `investment expense`,
  `investment income`, `investment return`, `sip`, `share market`, `dividend`)
  are excluded from PF summaries.
- The UI must show them read-only; the API must refuse edits/deletes on them.
  Phase 2 enforces this by returning derived rows without a writable
  `row_id`.

---

## 7. Share calculations

This section describes current Desktop behavior and the approved target model. Current code uses floating-point arithmetic; scaled-integer storage and exact arithmetic are Phase 2 requirements and need parity validation.

### 7.1 Replay order

Share holdings and realized results replay `share_transactions` and `dividend_events` by `(txn_date, sequence_no)`. These two tables share one `sequence_no` counter, so same-day buys, sells, bonuses and dividends have one unambiguous order. `sip_transactions` has its own `sequence_no` counter and replays separately by `(txn_date, sequence_no)`; SIP never changes share holdings, so it never needs to be ordered against share rows.

**Ordering policy: PROPOSED — AWAITING USER APPROVAL.** Migration preserves the Share worksheet row order for same-day events. Imported/transferred events receive new local sequence numbers in sender-created timestamp UTC order, then UUID as a final tie-breaker. A fixed event-type priority is the alternative; it is less safe because it can change weighted-average cost when a user actually sold before buying on the same day.
### 7.2 IPO and secondary purchases

For `ipo` and `buy`:

```text
share_value   = per_unit_price × quantity
total_amount  = share_value + charge
holding.qty  += quantity
holding.cost += total_amount
```

- IPO charge defaults to `5.00` when not supplied.
- Secondary `buy` charge is forced to `0` by the current service.
- IPO and secondary purchases contribute to the same holding.
- IPO allotment status is not stored. For an IPO row, `quantity IS NULL` and
  `quantity = 0` mean the same thing: not allotted / result not entered. There is
  no separate "pending" state. A stored IPO quantity is therefore `NULL` or
  `> 0`; the database CHECK rejects `0`.
- **Normalization on every write path:** the entry form's `Allotted` field
  defaults to `0`, and an untouched field also submits `0`. On IPO create, edit,
  Excel import and transfer import, blank or `0` is stored as `quantity = NULL`;
  `> 0` is allotted. Buy/sell rows require `quantity > 0`.
- Confirming an allotment updates the existing IPO row by its UUID `row_id`,
  never by name or date, and does not create a second row.
- Legacy Excel IPO rows with `Allotted = 0` or blank migrate to `quantity = NULL`.
  The earlier "legacy `Allotted = 0` is ambiguous" problem is resolved
  2026-11-06; the migration report still lists the row.
- Only an IPO row with `quantity > 0` creates a holding position.
- The original applied kitta is not stored (decided 2026-11-06).

Worked example (IPO): 10 shares at 100.00, charge 5.00.

```text
total_amount = 10 × 100.00 + 5.00 = 1005.00
holding: qty 10, cost 1005.00, average 100.50
```

### 7.3 Weighted-average cost

For a sale:

```text
average_cost = holding.cost / holding.quantity
cost_basis   = average_cost × sell_quantity
holding.qty -= sell_quantity
holding.cost -= cost_basis
if holding.qty == 0: holding.cost = 0
realized_profit = sale_proceeds - cost_basis
```

`average_cost` is unchanged by a sale because both quantity and cost are
reduced proportionally.

Worked example:

| Step | Event | Qty | Cost | Avg |
|---|---|---|---|---|
| 1 | buy 600 @ 10.00 | 600 | 6000.00 | 10.00 |
| 2 | sell 200 @ 10.00 (proceeds 2000) | 400 | 4000.00 | 10.00 |
| 3 | buy 100 @ 11.00 | 500 | 5100.00 | 10.20 |
| 4 | sell 200 @ 10.45 (proceeds 2090) | 300 | 3060.00 | 10.20 |

Step 4 realized P/L: `2090 − (10.20 × 200) = 2090 − 2040 = +50.00`.

### 7.4 Bonus shares

- Bonus shares add quantity at **zero acquisition cost**.
- They do not increase `holding.cost`.
- They reduce the average cost per share.
- They are dividend_events rows with event_type=bonus, not buys.

Worked example: after step 4 above, receive 100 bonus shares.

```text
qty = 400, cost = 3060.00, average = 7.65
```

### 7.5 Cash dividends

- Cash dividends are dividend_events rows with event_type=cash.
- They do not change quantity, cost, or average cost.
- Excel maps the cash amount to Per Unit Price and the derived Total Amount and Profit/Loss columns; the canonical event stores cash_amount_scaled.
- Cash dividends contribute to total_dividend and net cash result, but not trading P/L.
### 7.6 SIP installments

- Each SIP installment is a `sip_transactions` row with `transaction_type='sip_installment'`, a separately generated `sip_plan_id` UUID, and the SIP name.
- SIP units are stored per installment. Pending units are NULL in storage; UI zero/blank maps to NULL; an updated value is a whole number greater than zero.
- Pending units apply **only** to `sip_installment` rows. A `sip_redemption` row stores `units = NULL` because units are not applicable, and it must never appear in a pending-units suggestion or in the "Pending" display.
- Pending-unit suggestions come only from the plan's first installment.
- The installment is saved before units are entered. A later update targets the installment UUID, never the SIP name alone.
- A plan is identified by its separately generated sip_plan_id and SIP name. The first installment starts it; full redemption closes it; a later purchase starts a new plan UUID.
- Installment amount and applicable charge contribute to the plan's invested principal. SIP does not affect share quantity or weighted-average share cost.
- If `sip_plans` is approved (`docs/schema.md` §4.3.4), one open plan per canonical SIP name is enforced by a partial unique index, and `closed_date` is written in the same transaction as the full redemption.
### 7.7 SIP full redemption

- A redemption event is a `sip_transactions` row with `transaction_type='sip_redemption'` and references one `sip_plan_id`.
- Redemption is full-only and closes that plan; the derived outstanding/remaining investment becomes zero.
- `amount_scaled` is the **total amount the user actually received, net of charges**, and must be `> 0` (decided 2026-11-06). `charge_scaled` is recorded separately with default `0` for reporting; because the entered amount is already net, the redemption charge is **not** subtracted again.
- Profit/loss for the redemption = amount received (`amount_scaled`) − total invested in that plan. Total invested is the sum, for that `sip_plan_id`, of each installment's `amount_scaled + charge_scaled`, matching the current accounting where an installment's total is `amount + charge`. A prior redemption cannot exist in the same plan because redemption is full-only and closes it.
- Pending installment units must be resolved or explicitly accepted before redemption. This validation is PROPOSED — AWAITING USER APPROVAL.
- A later SIP purchase starts a new plan with a separately generated UUID, even when the SIP name is unchanged.
### 7.8 Overselling prevention

- A sale with `quantity > holding.quantity` at that point in replay order is
  rejected with `Not enough available quantity to sell for this share.`
- The check is against the running holding, not the final holding.
- Bonus shares count as available quantity.
- SIP and cash dividends never count as share quantity.
- Import validation replays the same rule; a batch that would oversell is
  staged as invalid and never committed.

### 7.9 Realized profit/loss and cumulative profit

- `profit_loss` per sale = sale proceeds − weighted-average cost basis.
- `profit_loss` per SIP redemption = net amount received (`amount_scaled`) − total invested in that plan (installment `amount_scaled + charge_scaled`).
- Cash dividends are cash income, not trading P/L.
- `cumulative_profit` is the running sum of realized share P/L across
  `share_transactions` and `dividend_events`, in `(txn_date, sequence_no)` order.
  SIP redemption P/L is tracked separately in `sip_plan_summaries`. The current
  sheet-wide accumulator also includes SIP rows; the split is intentional and
  must be parity-tested.
- Derived values are recomputed on read/export and are never stored as
  authority.

### 7.10 Summary formulas

The verified summary (`share_summary.py`) is canonical:

```text
overall_investment      = total_ipo_investment + total_buy_amount
share_holding_cost      = sum(latest holding_cost per share as of closing date)
sip_unrecovered_capital = max(all_sip_investment - all_sip_redeemed, 0)
realized_trading_pl     = total_profit
share_net_cash_result   = realized_trading_pl + total_dividend - share_holding_cost
grand_total_investment  = overall_investment + total_sip_investment
grand_holding_cost      = share_holding_cost + sip_unrecovered_capital
grand_total_received    = total_sell_amount + total_dividend + total_sip_redeemed
grand_net_cash_result   = grand_total_received - grand_total_investment
```

These names and formulas must be identical on both platforms. Mobile's
current `grand_*` / `share_holding_cost` implementation must be reconciled
against this list before it is wired to the canonical schema.

### 7.11 Share identity and name normalization

- `shares` (`docs/schema.md` §4.3.3) is the master identity table. A share
  transaction or dividend/bonus event references it by `share_id`; the display
  name comes from `shares.name`.
- **One normalization function** is applied on UI input, API input, Excel
  import and transfer import: trim, collapse every run of internal whitespace to
  one space, upper-case, and reject an empty result. There is no per-path
  variant. The database CHECK enforces `name = upper(trim(name))` and
  `trim(name) <> ''`; the function additionally collapses internal whitespace.
- **Resolve or create by canonical name.** The first write for a new share
  inserts its `shares` row in the same transaction as the event. Import and
  transfer resolve an existing row by canonical name before creating one.
- **`content_hash` and the transfer payload use the canonical name**, never the
  local `share_id`. Two devices may mint different local UUIDs for the same
  share without creating a false conflict. See §2.2.
- **Renaming is not supported in Phase 2 — PROPOSED — AWAITING USER APPROVAL.**
  A rename would change `shares.name` and every referencing row's `content_hash`,
  and would require recalculating the share's holdings. Until a rule is approved,
  a misspelled name is corrected through a migration/review action.
- **PROPOSED — AWAITING USER APPROVAL: deterministic `share_id` = UUIDv5 of the
  canonical name.** Two devices would derive the same UUID independently. The
  limitation is that a name-derived UUID cannot support renaming without changing
  the key; if rejected, keep local UUIDs and resolve by name on import.
- A `shares` row with existing events cannot be deleted (`ON DELETE RESTRICT`);
  the service reports the dependency. There is no cascade delete of financial
  history.

### 7.12 Dividend and bonus validation (Rules A, B and C)

One validation function is used by **every** write path: UI/API create, update,
delete, Excel import, and device-transfer apply. The backend is the authority;
frontend validation is advisory and must never be the only check.

**Rule A — event creation or edit**

1. The share must exist in `shares`. The foreign key guarantees the row; the
   service must also return a clear error for an unknown share instead of a raw
   database error.
2. The holding at the event position must be greater than 0. Holding is
   computed by replaying, for that share, every `share_transactions` row and
   every earlier bonus event, ordered by `(txn_date, sequence_no)`, up to but not
   including the event's own position. In that replay an IPO with
   `quantity IS NULL` counts as 0, a buy adds, a sell subtracts, and an earlier
   bonus adds.
3. Cash dividend and bonus both require holding `> 0`. A bonus `quantity` must
   be `> 0`.
4. If the holding is 0 or NULL-equivalent, reject with a structured error, for
   example HTTP 422 with error code `no_holding_at_event_date` and a
   human-readable message naming the share and the event date.

**Rule B — any edit or delete of a share transaction or event**

- Replay the whole timeline of the affected share(s) inside the same
  transaction. Reject if any sell exceeds the holding at its position, or if any
  dividend/bonus lands where the holding is 0. The error names the first record
  that would become invalid.
- Use one write transaction per request, opened with `BEGIN IMMEDIATE`, so the
  check and the write are atomic. With `busy_timeout = 5000` and the bounded
  retry policy in §22, a locked database fails with a `database_locked` error
  and no partial write; the UI tells the user another window is writing and
  offers retry. Never force the lock or commit part of the change.
- Deleting a buy that a later bonus or dividend depends on is rejected by the
  replay; it is not auto-corrected and the dependent rows are not deleted.

**Rule C — imports and transfers**

- Apply the same validation to each incoming record in replay order. Failures go
  to the review/rejected list and are never silently skipped, coerced or
  auto-corrected. A batch containing such a record is not committed until the
  user resolves it.

**Optional database-level safety net — PROPOSED — AWAITING USER APPROVAL**

- Triggers could block inserting a dividend/bonus where the holding is 0.
  Downside: the replay logic is duplicated in SQL, must be kept exactly equal to
  the service rule, is harder to test and evolve, and a trigger can only reject,
  never compute. Service-layer validation remains the primary mechanism;
  triggers are a backstop only if the user approves them.

---

## 8. Transfer financial effects

A transfer is one row with two effects:

| Direction | Origin effect | Destination effect |
|---|---|---|
| `bank_to_cash` | bank income `−amount` | cash income `+amount` |
| `cash_to_bank` | cash income `−amount` | bank income `+amount` |

Rules:

- The combined view shows each transfer once, from the origin side
  (`signed_amount = −amount`).
- The per-flow view shows the transfer on both sides with the correct sign.
- A transfer never creates a `personal_finance_entries` row and never changes
  an existing bank or PF entry.
- Creating/editing/deleting a transfer is a single atomic operation; the
  derived balances are computed from the transfer table plus PF entries, so no
  second write is needed.
- Validation: `amount > 0`; `amount <= available origin income`. The verified
  implementation compares against
  `summarize_personal_finance_records(flow)["total_income"]`, which includes manual
  income and prior transfer effects, and excludes linked-module and share-only rows. It
  does **not** subtract non-transfer expenses. Preserve that rule exactly, and exclude
  the transfer being edited when validating an update.
- Import validation replays dated events in `(date, timestamp, priority,
  sequence)` order and rejects an overdraw with the available amount in the
  message.
- Deleting a transfer writes a tombstone and removes the row atomically. The
  previous absence of transfer deletion is a known gap, resolved in Phase 2.

Worked example: Bank income 1000, Cash income 300, transfer 500 bank→cash.

```text
bank income 1000 - 500 = 500
cash income  300 + 500 = 800
combined net unchanged
```

---

## 9. Share holdings: incremental update and rebuild

### 9.1 Invariants

1. share_transactions, sip_transactions, and dividend_events are the only canonical financial sources of truth.
2. `share_holdings` is a cache. A full rebuild must produce exactly the same
   values as incremental maintenance.
3. `quantity >= 0`; `total_cost >= 0`; when `quantity = 0`, `total_cost = 0`
   and `average_cost = 0`.
4. `average_cost = total_cost / quantity` for `quantity > 0`.
5. Cash dividends and SIP rows do not change share holdings.
6. Every `share_transactions` and `dividend_events` row references an existing
   `shares` row. A dividend or bonus cannot exist without its share.

### 9.2 Incremental updates

- Insert of an ordinary `ipo`/`buy`/`sell`/`bonus` row: apply the replay in one
  SQLite transaction and update the affected share's summary.
- Edit or delete: recalculate the affected share from full history, because an
  earlier change can alter every later average and cost.
- If an edit re-links a row to a different `share_id` (or a future approved
  rename changes `shares.name`), recalculate **both** the old and the new share
  inside the same transaction.
- Bulk import: recalculate affected shares once after the batch, not per row.
- Full rebuild: `DELETE FROM share_holdings` then replay all transactions, or
  rebuild into a temp table and swap atomically. The swap must be one
  transaction so readers never see an empty cache.

#### 9.2.1 SIP summary invariants

sip_plan_summaries is a derived cache keyed by the separately generated sip_plan_id UUID and includes the SIP name. Installments and full-redemption events are its source. Full replay must reproduce outstanding principal, updated units, pending installment count, redemption totals, P/L, and open/closed status. Changes to any canonical SIP event recalculate the affected plan summary in the same transaction. Missing, stale, corrupt, or calculation-version-incompatible summaries are rebuilt or marked invalid before use.
### 9.3 Failure behaviour

- If the holdings update fails, the transaction change rolls back.
- No trigger performs financial calculations. Correctness lives in the tested
  service layer.
- `summary_updated_timestamp` and `summary_updated_device` are set on every
  successful recalculation.

---

## 10. Import behaviour

### 10.1 Modes

- **Merge** appends new UUIDs, updates same-UUID rows, and records conflicts.
- **Replace** replaces the complete set of explicitly selected categories
  atomically after a verified backup; it never wipes unrelated categories.

### 10.2 Metadata preservation

- A source row's `created_timestamp` is preserved exactly.
- `last_updated_timestamp` is preserved when present; when absent it copies
  `created_timestamp`, never `now()`.
- `updated_device` is preserved; missing becomes `legacy`.
- A reviewed import that **changes** a row is a real edit: it bumps
  `last_updated_timestamp` and sets the current device. A reviewed import that
  confirms an unchanged row must not bump either.
- Current `workbook_import.py` falls back to import time when no timestamp and
  no date exists, and restamps reviewed rows unconditionally. The canonical
  rule above supersedes that; Phase 2 must change the code, and the import
  report must list every row where `metadata_quality='imported_missing'`.

### 10.3 Idempotency

- Re-importing the same source with the same UUIDs must not duplicate rows.
- Re-importing a legacy source without UUIDs uses `legacy_identity_map` and
  must produce the same UUIDs.
- A missing `Content Hash` never causes duplication.
- Import is committed as one batch; a partially written batch is rolled back.

### 10.4 Unknown data

- Unknown categories: stage as `unsupported`, show the row, never coerce.
- Unknown columns: ignore with a report entry; never delete the source.
- Malformed values: stage as `invalid` with the reason and the offending value.

---

## 11. Export behaviour

- Export is lossless for authoritative fields and recomputes derived columns.
- Export order is `sequence_no`.
- `Row ID` and `Content Hash` are always written.
- Empty text/optional values are written as blank cells, matching current
  behaviour.
- Share price/total/profit columns are written as text where the current
  workbook stored text, preserving the entered decimal representation.
- Source workbooks are never overwritten in place by export; a new file is
  produced or the existing workbook is updated through the service with a
  backup, per `docs/SAFETY.md`.

---

## 12. Smart Merge and Replace

### 12.1 Smart Merge (default)

- Add genuinely new records.
- Detect same-UUID records.
- Report conflicts; never overwrite silently.
- Report possible duplicates; the user decides.
- Preserve all unrelated local data.
- Require explicit confirmation.
- Idempotent on retry.

### 12.2 Replace (advanced)

- Only explicitly selected categories; replace the selected set as one atomic
  commit after a verified backup.
- Require confirmation and a recoverable backup first.
- Never touch unrelated categories.
- Related-record handling:
  - Replacing any share transaction category triggers a holdings rebuild for
    every affected share (resolved by `share_id`).
  - Replacing transfers does not touch PF entries (transfers are separate).
  - Replacing PF entries does not touch transfers or derived sync rows.
- Replaced local rows are tombstoned so other devices learn about the
  replacement; they are not silently erased without a tombstone.
- A failed Replace rolls back to the pre-replace snapshot.

---

## 13. Duplicate detection

| Situation | Classification | Action |
|---|---|---|
| Same UUID, same `content_hash` | Already synchronized | Skip insertion; show "already present" |
| Same UUID, different `content_hash` | Conflict | Show both versions; never auto-overwrite |
| Different UUID, same table and similar business fields | Possible duplicate | Show to the user; do not auto-reject |
| Different UUID, different table | Not a duplicate | Treat independently |
| Same UUID across tables | Invalid | Reject with an explicit error |

"Similar business fields" means the same transaction date, amount, category and
normalised description/share name. It is a hint, never an automatic merge.
Two genuinely separate transactions can be identical.

For conflicts, show:

- existing and incoming values
- source device of each
- `last_updated_timestamp` of each
- a clear note that the timestamp is advisory because clocks may differ

---

## 14. Synchronization conflicts

- Same UUID + same hash → already synchronized.
- Same UUID + different hash → conflict. Never silently overwrite. The UI
  shows both and requires a decision.
- Different UUID + similar fields → possible duplicate. User decides.
- Timestamps rank candidates but do not decide truth; device clocks may be
  wrong.
- Current deterministic ranking
  `(last_updated_timestamp, updated_device, content_hash)` is preserved as the
  tie-breaker for automatic workbook merge, and the losing version is recorded
  in `record_conflicts`. The transfer review UI must not hide the losing
  version.
- A tombstone wins only when `deleted_timestamp` is strictly newer than the
  record's `last_updated_timestamp`. This prevents resurrection.

---

## 15. Cross-platform financial consistency

- Both platforms implement the same formulas, in the same order, with exact
  arithmetic.
- A shared golden-fixture suite covers: bank cumulative, PF signed amounts,
  transfer effects, IPO cost, weighted average after multiple buys/sells,
  bonus, cash dividend, SIP installment/redemption, oversell rejection, and
  holdings rebuild.
- Every fixture asserts exact scaled-integer equality, not approximate float
  equality.
- Mobile must not ship a divergent formula. The current FIFO implementation is
  a discrepancy to be replaced (§20), not an alternative interpretation.
- Category lists and device labels are centralised and generated/ported from
  one source, not hand-copied.

---

## 16. Delete and tombstone rules

- Deleting a transaction writes `deleted_records` and removes the row in one
  transaction.
- `deleted_timestamp` is set once and never updated.
- Re-creating a transaction uses a new UUID; it does not resurrect the old one.
- Restoring a backup restores the pre-delete state as a whole; it is not a
  per-row undo.
- Tombstones are excluded from all financial summaries.
- Transfer deletion is now included (previously missing).

---

## 17. Migration rules

- Migration reads workbooks, never rewrites them.
- `sequence_no` follows workbook row order.
- UUIDs and both timestamps are preserved.
- `metadata_quality` records every legacy assumption.
- Migration is idempotent: re-running it against the same source produces the
  same database state and does not create duplicates.
- Migration does not make a record appear newly edited.
- A failed migration leaves the source intact and the partial database
  quarantined.
- Verification compares counts and totals per category against the source
  before the migration is marked complete.

---

## 18. Holdings rebuild invariants (test contract)

For every share:

```text
rebuild(transactions) == incremental_state
quantity == sum(purchase quantities) + bonus quantities - sold quantities
total_cost == sum(purchase total amounts) - sum(sale cost bases)
average_cost == total_cost / quantity (0 when quantity == 0)
```

The two paths are tested against each other on randomised fixture sets,
including same-date rows, edits that move a transaction between shares, and
deletions of the first transaction.

---

## 19. UI and service boundary

- The service layer returns authoritative totals. The UI formats them; it does
  not recompute them.
- Frontend summaries that currently duplicate backend formulas
  (`frontendwebapp/src/utils/summaries.js`) are replaced by API-provided
  values during Phase 2.
- The Import Review UI may show a preview computed by the backend; it must
  label it as a preview and must not commit without explicit confirmation.
- A hidden or disabled button is not a security boundary. Backend endpoints
  enforce the rule.

---

## 20. Known discrepancies and their resolution

These are verified contradictions between documentation and code, or between
platforms. They are recorded here so Phase 2 fixes them deliberately.

| # | Discrepancy | Evidence | Resolution |
|---|---|---|---|
| 1 | Mobile uses FIFO lot matching; desktop uses weighted average; PLAN.md says mobile uses FIFO | `mobile/dist/services/share-fifo-lot-matching.js`, `share_lot_calculations.apply_weighted_average_transaction`, `docs/PLAN.md` | This migration is Desktop-only and leaves Mobile unchanged. Desktop weighted average is canonical; a later Mobile adoption requires a separate approved task. Until then, Mobile transfer is schema-gated |
| 2 | Mobile hardcodes IPO charge 5 | `share-fifo-lot-matching.js` | Correct for IPO, but must come from the shared charge rule; secondary and SIP charges use the same rule set |
| 3 | Dead FIFO helpers remain in the backend | `share_lot_calculations.py` `add_share_lot`, `consume_share_lots`, `_build_open_lots`, `_cost_basis_for_sell` | Not used by the authoritative path. Remove or mark deprecated in Phase 2 after grep proves no call sites |
| 4 | Import falls back to import time for missing timestamps | `workbook_import.py:112-113`, `191-192`, `276-277`, `392-393`, `531` | Canonical rule: date first, then `legacy_date_only`/`backfilled`; import time only as last resort with `imported_missing` |
| 5 | Reviewed import restamps `Last Updated Timestamp`/`Updated Device` | `workbook_import.py:738-743` | Bump only on material change; no-op confirmation must not bump |
| 6 | Bank sign is normalised in the frontend, validated in the backend | `bankApi.js`, `models.BankAddRequest` | Canonical service derives sign from category; UI and API both validate |
| 7 | `BANK_INCOME_CATEGORIES` includes `income`, but `BankCategory` does not | `bank_service.py:30`, `models.py` | Treat legacy `Income` as income on import and flag it; do not add a new enum value silently |
| 8 | `schema.md` previously said transfers are never exported | Old `schema.md` §3 | Transfers have `personal_finance_transfer.xlsx` / `Transfer Flow`; export is supported |
| 9 | `schema.md` previously described a pending `Timestamp` split and "mobile doesn't exist yet" | Old `schema.md` §2/§4 | Both are obsolete; this document and the new schema are authoritative |
| 10 | Mobile summary fields differ from desktop (`grand_*`) | `mobile/tests`, `share_summary.py` | Reconcile against §7.10 before wiring Mobile to the canonical schema |
| 11 | Transfers have no delete endpoint or tombstone | `routes/personal_finance.py`, `personal_finance_transfers.py` | Add delete + tombstone in Phase 2 |
| 12 | Mobile schema has no `row_id`/`content_hash` and uses split PF tables | `mobile/dist/src/data/schema.js` | Refactor to the canonical schema (§10 of `schema.md`) |
| 13 | `share_summary` closing position uses `(date, id)` where `id` is the row index | `share_summary.py:57` | Canonical equivalent is `(txn_date, sequence_no)` |
| 14 | Bank cumulative is recomputed over physical row order | `bank_service._recompute_bank_sheet` | Canonical equivalent is the `sequence_no` window sum |
| 15 | A dividend or bonus can be recorded with no holding, or before the first buy | `share_service.append_share_record` stores a dividend row without replaying the share timeline | Phase 2 rule §7.12 replays the share timeline on every write path and rejects with `no_holding_at_event_date` |
| 16 | Share identity is free text repeated on every event row | Old `schema.md` §4 said there is no `shares` dimension table; both event tables stored `investment_name TEXT` | Reversed 2026-11-06: `shares` master table plus `share_id` foreign keys on `share_transactions` and `dividend_events` (`schema.md` §4.3.3) |

---

## 21. Unresolved behaviour (must not be invented)

The following remain open. Phase 2 must not guess:

1. RESOLVED 2026-11-06: SIP units are stored per installment; pending values are NULL and the UI may show 0. Redemption rows store `NULL` because units are not applicable, never because they are pending (§7.6).
2. RESOLVED 2026-11-06: SIP redemption is full-only, and `amount_scaled` is the total net amount received. The redemption charge is stored separately and is not subtracted again (§7.7).
3. Exact rounding of sub-cent artefacts produced by the current float
   implementation. Phase 2 must pin this with parity tests before release.
4. Tombstone compaction policy across devices.
5. Whether `metadata_quality` should be exposed in Excel or kept internal.
6. Mobile's transition period: whether it exports canonical DB or keeps the
   JSON backup as the primary recovery format.
7. RESOLVED 2026-11-06: `applied_quantity` is not added; only the allotment
   result is stored. The form's default `0` is normalized to `NULL` on IPO
   create/import, and an explicit allotment result of `0` is stored as `0`.
8. RESOLVED 2026-11-06: legacy IPO `Allotted = 0` and a blank `Allotted` both
   migrate to `quantity = NULL` (not allotted / result not entered). There is no
   ambiguity to review (§7.2, `schema.md` §9.3).
9. PROPOSED — AWAITING USER APPROVAL: share rename rule. Renaming is not
   supported in Phase 2 (§7.11).
10. PROPOSED — AWAITING USER APPROVAL: deterministic `share_id` = UUIDv5 of the
    canonical name (§7.11).
11. PROPOSED — AWAITING USER APPROVAL: `sip_plans` master table and the
    `sip_transactions.sip_plan_id` foreign key (`schema.md` §4.3.4).
12. PROPOSED — AWAITING USER APPROVAL: database triggers that block a
    dividend/bonus where the holding is 0 (§7.12).

Until resolved, preserve current behaviour and record the question in
`docs/desktop-tasks.md` *Decision changes* / open decisions.

## 22. Desktop environment and shared database rules

Within each environment, EXE and AppX use one physical SQLite database. Development, Testing, and Production have separate roots. The shared per-user folder is PROPOSED — AWAITING USER APPROVAL; it must be outside AppX package storage and AppData virtualization. A Windows install verification gate must prove both packages open the same file, cross-visible writes, data survival after either uninstall, and antivirus/App Certification Kit acceptance.

Before migration, identify existing workbooks, create and verify their backup in the source folder tree, then create SQLite and import from copies. AppX-only installation uses the same shared resolver. No source workbook or backup is deleted. Both apps may run concurrently: WAL, a 5-second busy timeout, one writer, short transactions, visible locked/retry messaging, refresh on window focus, and periodic PRAGMA data_version checks. The Python sidecar uses a per-database single-instance/port rule.

Store schema_version and min_app_version in the database. An older app refuses writes to a newer schema and never downgrades or repairs it.
