# Keep Notes Import — Parser & Review Spec

Keep Notes bulk import is a v1.0.0 priority (see PLAN.md — Mobile). This
doc specs the raw-note parser, the type/category assignment, and the
review/edit screen that gates every import.

Nothing auto-imports. Every parsed item is staged in a review screen and
only written after user confirmation.

---

## 1. Raw note format (real sample lines)

Keep breaks a note into lines. A line is one of:

| Kind | Sample | Meaning |
|------|--------|---------|
| Date header | `8/17` | Starts a new date group; all following entries belong to that date |
| Amount-then-label | `120- vegetables` | Entry: amount `120`, label `vegetables` (trailing `-` and spaces trimmed) |
| Running total | `=250` | Checksum for the date group, NOT an entry (see §1.2) |
| Multi-item concatenated | `50curd+50banana+25somosa` | Several items joined by `+`; each segment is a `amount+label` pair like `50curd` |
| Plus-prefixed | `+1006 sip this to sip investment part` / `+600 printing` | Prefixed with `+`; type (expense vs other) is ambiguous and REQUIRES user confirmation |
| Label-then-sum | `Rakhi` then `50+135+...` | A label line followed by a line of `+`-joined numbers — sum them and import as one entry under that label |
| Scaled thousands | `2k`, `22k` | `k` means ×1000 (`2k` → `2000`, `22k` → `22000`) |

### 1.1 Relative date resolution

A bare form like `8/17` is a month/day. When the note gives no year, use
the current year; if the resolved date is in the future relative to today,
use the previous year (Kept notes typically record the past). The resolved
ISO date is assigned to all entries in that date group.

### 1.2 Running-total lines (`=…`) are checksums, not entries

A line starting with `=` holds the author's running sum for that date.
Treat it as a checksum and **never import it as a row**. After parsing all
entries for a date group, compare the parsed sum of the group against the
checksum:

- Match → fine, mark the group as validated.
- Mismatch → do not fail the import; flag the date group for user review.
  Show the parsed sum vs. the author's total so the user can reconcile the
  entries manually.

### 1.3 Additional real-world patterns

Beyond the canonical samples above, real notes contain these variations.
They are folded into the same parser and review rules:

**(1) The amount/label separator is optional — not just a dash.** The
separator between amount and label can be a dash (`120- vegetables`), a
space (`120 vegetables`), or none at all (`120vegetables`, and the
`50curd` form). The parser must not require a dash; it should recognize an
amount token immediately followed by a label regardless of separator.

**(2) Reversed label-then-amount lines** (`Milk -60`,
`Vegetables -70(...)`). Here the **label comes first**, then the amount
(prefixed with `-`, and possibly with parenthetical text after it). Parse
the label first, then the following amount. Fold any parenthetical text
into the **description** (e.g. `Vegetables -70(market trip)` →
label `Vegetables`, amount `70`, description `(market trip)`).

**(3) Pure arithmetic / balance statements are never transactions.** A
line shaped `number - number = number` (e.g. `3000-1295=1705`) with no
accompanying label is a balance/arithmetic note, not an entry. Never import
it as a row; flag it as **informational-only** in the review screen so the
user can ignore it (optionally delete it from the staging list).

**(4) Trailing non-numeric words after a checksum are stripped.** A running
total may carry a trailing word, e.g. `=22k done`. Strip any trailing
non-numeric text (after the number) before comparing the checksum value —
`=22k done` → checksum `22000` (after `k` scaling). The trailing word is
ignored for validation purposes.

**(5) A trailing qualifier word like `needed` signals a planned, not
actual, expense.** When an amount+label line ends in a qualifier word such
as `needed` (e.g. `120 milk needed`), it records an intent, not a real
spend. Flag these **distinctly** in the review screen (e.g. "planned" vs
"actual") and default them to **unchecked/excluded** rather than
pre-selected for import. The user can still include them deliberately.

## 2. Parsing pipeline

### 2.1 `k` scaling

Any integer token followed by `k`/`K` is multiplied by 1000
(`2k` → 2000, `22k` → 22000). Applies to any amount position (before a
label, in a `+` sum, in a running total, in a `+`-prefixed line).

### 2.2 Amount-then-label lines

`120- vegetables` → amount `120`, label `vegetables`.
The separator is optional — dash, space, or none (see §1.3 part 1). Trim
any trailing `-`/whitespace from the amount side and leading whitespace
from the label. Amount must parse as a number before the label is
accepted.

### 2.3 Multi-item concatenated lines (`+`-joined pairs)

`50curd+50banana+25somosa` → segments `50curd`, `50banana`, `25somosa`.
Each segment is `amount + label`.

- If **every** segment splits cleanly, import each segment as its own
  entry with its own category (per §3).
- If the amounts can't be reliably split (ambiguous segment, missing
  amount, non-numeric head), collapse the whole line into a **single lump
  entry**:
  - amount = sum of the amounts that could be parsed
  - category = `Uncategorized`
  - description = the raw line text verbatim (`50curd+50banana+25somosa`)
  - The user then manually splits it in the review screen.

### 2.4 Plus-prefixed lines (`+…`)

A line already starting with `+` (e.g. `+1006 sip this to sip investment
part`, `+600 printing`) is a single entry whose type is ambiguous. Parse
the leading amount (`1006`, `600`), then label with the rest.

- **Require user confirmation of type before import** (see §4). Default
  suggestions by keyword, but the user must confirm:

| Keyword (case-insensitive) | Suggested type / target |
|---|---|
| `sip`, `investment`, `share`, `ipo`, `buy`, `sell`, `dividend` | Share Portfolio (SIP investment part) |
| `printing` | Personal expense (expense → other category) |
| (param) | `registration fee` → **education** category (see §3) |
| `sessior` → `session` | **utility** category if it exists, else `other` (§3) |
| anything else | Personal expense, category flagged for confirmation |

### 2.5 Label-then-sum lines (`Rakhi` + `50+135+…`)

A label line with no amount, immediately followed by a `+`-joined numeric
line. Sum the expression (`50+135+...`) and import as **one entry under
that label**:
- label `Rakhi`
- amount = sum of the numbers
- category = resolved from the label per §3
- description = the raw sum line verbatim (e.g. `50+135+...`)

If the following line isn't numeric (`+`-joined or a plain number), treat
the bare label as a text line outside the number lines (see §2.6).

### 2.6 Non-numeric lines

Lines that aren't a number, amount+label, date, `+`-prefixed, or running
total are ignored for import (e.g. stray headers/titles). They may still
appear in the review payload as context but produce no row unless the user
adds one.

## 3. Category & module assignment

Each parsed entry is assigned a **target module** (Share / Bank /
Personal bank / Cash expense) and a **category**. Mapping defaults
(case-insensitive substring match):

| Rule | Match | Module | Category |
|------|-------|--------|----------|
| Registration fee | `registration fee` | Personal | Bank / Cash expense → **education** |
| Session / sessior | `sessior`, `session` | Personal | **utility** if the utility category exists, else **other** (ask user to confirm, see §5) |
| SIP / share keywords | `sip`, `share`, `ipo`, `buy`, `sell`, `dividend`, `investment` | Share | Share category |
| Known bank categories | e.g. `interest earned`, charges | Bank | Bank category |
| A named rate context | `50curd` | Personal | treat the leading word as the label/expense name → **curd** expense at amount `50` (`rate name = that amount`) |
| Nothing matched | — | Personal | **Uncategorized** (default editable) |

The mappings above are **defaults only**. In the review screen the user
can change module, category, and amount for every row (see §4).

## 4. Review/edit screen (required gate)

Nothing is written without user confirmation. The commit is a two-step
flow:

1. **Parse → stage.** Parsing populates a staging list, never the database.
2. **Review → confirm commit.** The user reviews and edits, then taps
   commit.

What the user sees is **a list of each parsed item together with the
module/category it was assigned to** — one row per entry, each showing:
- resolved date + label/description
- amount
- target module (Share / Bank / Personal bank / Cash expense)
- category

Per row the user can:
- **Edit** — change date, label, amount, module, category, description.
- **Split** — for lump `Uncategorized` rows (from §2.3), break one row into
  multiple entries and edit each.
- **Delete** — drop the row from the import (see below).

Top-right of the screen: an **Add** button to insert a new manual row into
the staging list (e.g. to capture an entry the parser missed).

The screen also supports **search** — filter the staged list by label,
description, amount, module, or category as the user types.

### 4.1 Conflict flags

Date groups whose parsed sum mismatched the checksum (§1.2), and
ambiguous-type lines (§2.4), are visually flagged. The flag doesn't block
commit — the user reviews and confirms reconciliation. Flagged rows must be
explicitly confirmed (or edited) before that row is allowed to commit.

## 5. Confirmation prompts

- **Ambiguous type** (`+`-prefixed lines): prompt the user to confirm the
  target module and type before the row can commit.
- **Uncategorized / fallback `other`** (e.g. `sessior` → session):
  prompt "is this correct?" with the option to rename/re-categorize, for
  now mirroring desktop or placing into `other`. The user can change the
  category to something else.
- Everything is shown in an editable, changeable format before commit.

## 6. Write path — the same service layer as manual entries

On commit, each confirmed row is written **via the same service layer used
for manual entries** on mobile (e.g. `mobile/services/*` for bank category
totals, share FIFO, personal-finance sync-row computation). This is
required so the write path:

- goes through the identical validation/computation as a manual entry
  (parity, see AGENTS.md §8 and rules.md),
- runs on-device with SQLite as the source of truth,
- **inherits the `Updated Device` and timestamp columns automatically**
  (the service layer stamps `created_timestamp` /
  `last_updated_timestamp` and `updated_device`), consistent with
  schema.md §2.

The import must not bypass the service layer by writing SQL directly. The
staging list is UI state only; the service layer is the only writer.

## 7. Out of scope for v1.0.0

- No bank-flow live sync and no interest engine (deferred, PLAN.md —
  Mobile).
- No reverse export of Keep Notes.
- Drive-sync is its own phase (rules.md — Mobile).
