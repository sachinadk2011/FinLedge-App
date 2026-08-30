# Design — Mobile UI (finledge-mobile-design-v3)

Design sources: `finledge-mobile-design-v3.html` (visual reference) plus
the mobile-specific rules in AGENTS.md §8. Tokens and values below are
**pulled directly from the design file** — do not invent new hex values;
reuse these tokens.

## 1. Dark theme tokens

From the `:root` block in finledge-mobile-design-v3.html:

| Token | Value | Notes |
|-------|-------|-------|
| `--bg-app` | `#0a0e14` | App background |
| `--bg-surface` | `#131a23` | Card / surface |
| `--bg-surface-2` | `#1a2330` | Raised surface |
| `--bg-surface-3` | `#212c3b` | Higher surface |
| `--border` | `#242f3d` | Borders / dividers |
| `--brand-teal` | `#14b8a6` | Brand / primary accent |
| `--accent-green` | `#22c55e` | Income / positive |
| `--accent-green-dim` | `rgba(34,197,94,.15)` | Income chip fill |
| `--accent-red` | `#f2555f` | Expense / negative |
| `--accent-red-dim` | `rgba(242,85,95,.15)` | Expense chip fill |
| `--accent-amber` | `#f5a524` | Neutral / cash / warnings |
| `--accent-blue` | `#5b9bf5` | Bank accent |
| `--accent-purple` | `#a684f5` | Investment / share accent |
| `--text-1` | `#f2f5f8` | Primary text |
| `--text-2` | `#94a1b2` | Secondary text |
| `--text-3` | `#5c6b7d` | Tertiary / muted |
| `--radius-lg` | `20px` | Large radius |
| `--radius-md` | `14px` | Medium radius |
| `--radius-sm` | `10px` | Small radius |

Semantics (as used in the design file):
- **Positive / income** → `--accent-green`; **negative / expense** →
  `--accent-red`; **neutral / cash / transfer** → `--accent-amber`.
- **Bank** flows render with `--accent-blue`; **cash** with
  `--accent-amber` (see the split header).
- **Share / investment** charts use `--accent-purple`.
- Primary buttons are `--accent-green` on dark text; "Record transfer"
  uses `--accent-amber`.

## 2. Typeface

Use **Inter**, with the system fallback stack from the design file:

```
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Money must use tabular-nums.** The design file sets
`font-variant-numeric: tabular-nums` on every money value (amounts,
stat values, table cells, summary values). Apply it to all currency figures
so columns and totals align; do not use proportional digits for money.

## 3. Responsive rule — the 390px frame is a preview, not a constraint

The design's fixed `390px × 844px` `.device` frame is a **preview device**
used to present the mockups — it is **not a layout constraint**.

Real app CSS must:

- Use relative / flex layouts (no hard-coded `390px` widths, no fixed
  pixel widths driving layout).
- Be tested across **360px – 430px** (the AGENTS.md §8 range) and remain
  legible and visually consistent at both ends.
- Keep the illustrated surfaces (cards, chips, rows, charts, FAB) scaling
  with available width rather than clipping or overflowing.

The static frame's inset padding (`46px` top, `20px` side) is a mockup
artifact; real screens measure against the device safe-area / viewport
instead.

## 4. Chart number formatting — non-negotiable

Every bar/value on every chart must use the existing `compactMoney()`
from `mobile/src/utils/format.ts` (≥100,000 → `L`, ≥1,000 → `k`) — no chart
may implement its own formatting inline.

## 5. Color legend — fixed everywhere

- `--accent-green` = income/positive only.
- `--accent-red` = expense/loss/negative only.
- `--brand-teal` = net when ≥0.
- `--accent-amber` = net when <0, or cash/transfer/neutral.

No new chart, card, or screen may assign a different meaning to these four
colors or introduce a fifth "net" color.

## 6. Navigation icons vs. brand mark — do not conflate

The brand mark ("FL" monogram / logo image) appears only in the topbar and
drawer header. Each drawer navigation item (Home, Bank Services, Share
Portfolio, Personal Expenses, Financial Summary, Settings) needs its own
distinct pictogram (matching the original desktop iconography: bank/building
for Bank Services, chart/trend for Share Portfolio, card for Personal
Expenses, bar-chart for Financial Summary, gear for Settings) — never a
single letter, and never the brand mark reused as a nav icon.

## 7. Reference-file precedence for every UI task

`finledge-mobile-design-v3.html` is the completed baseline. Any new UI
element must reuse an existing CSS class or design token from
`mobile/src/styles.css` first; a genuinely new element derives its look from
existing tokens (`--bg-surface`, `--accent-*`, `--radius-*`), never a new
invented value. When told to change spacing/padding/margin on a named
element, change only that CSS property on that element's exact selector —
never remove, hide, or restructure an unrelated element to visually achieve
the same effect. If achieving a requested visual change seems to require
removing something, stop and ask first, don't delete it.
