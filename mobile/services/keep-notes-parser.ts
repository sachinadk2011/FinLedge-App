import {
  BANK_INCOME_CATEGORIES,
  BANK_CATEGORIES,
  PERSONAL_FINANCE_EXPENSE_CATEGORIES,
  PERSONAL_FINANCE_INCOME_CATEGORIES,
} from "../src/constants/options.js";

/**
 * Keep Notes raw-text parser (docs/keepNotesImport.md §1–§3).
 *
 * Input: lines of raw pasted note text. Output: an ordered array of staged
 * entries, each carrying the resolved date, amount, label/description, target
 * module (share | bank | personal), direction + flow, and a category, plus
 * any review flags and checksum-mismatch notes for the date group.
 *
 * Nothing here writes anything — it only parses into a staging list.
 */

export type ImportModule = "share" | "bank" | "personal";
export type ImportDirection = "income" | "expense";
export type ImportFlow = "bank" | "cash";

export type ImportFlag =
  | { kind: "ambiguous"; message: string }
  | { kind: "checksum"; message: string }
  | { kind: "planned"; message: string }
  | { kind: "info"; message: string }
  | { kind: "lump"; message: string };

export type StagedEntry = {
  id: string;
  /** Resolved ISO date "YYYY-MM-DD". */
  date: string;
  /** Parsed amount (positive number). */
  amount: number;
  /** Entry label/name ("" when only a raw description exists, e.g. lump sums). */
  label: string;
  /** Longer description (parenthetical, raw lump text, qualifiers). */
  description: string;
  module: ImportModule;
  direction: ImportDirection;
  flow: ImportFlow;
  category: string;
  /** Parser-assigned flags that require/encourage user attention. */
  flags: ImportFlag[];
  /** User-editable fields mirrored for review edits. */
  edited: boolean;
  /** When a row was split, both halves share this group id so a single "Undo
   *  split" can merge them back together. Absent on non-split rows. */
  splitGroup?: string;
};

export type ParseResult = {
  entries: StagedEntry[];
  /** Total amount parsed, for an at-a-glance summary. */
  totalAmount: number;
  /** Lines that were intentionally ignored (dates/titles/arithmetic). */
  ignoredLines: string[];
};

type RawDateGroup = { dateKey: string; sum: number; checksum: number | null; label: string };

const MODE_EXPENSES = new Set(PERSONAL_FINANCE_EXPENSE_CATEGORIES.map((c) => c.toLowerCase()));
const MODE_INCOME = new Set(PERSONAL_FINANCE_INCOME_CATEGORIES.map((c) => c.toLowerCase()));

/** Parse a raw Keep Notes blob into a staging list. */
export function parseKeepNotes(raw: string): ParseResult {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const entries: StagedEntry[] = [];
  const ignoredLines: string[] = [];

  // Track the active date group and its running-total checksum.
  let currentGroup: RawDateGroup = { dateKey: toDateKey(new Date()), sum: 0, checksum: null, label: "" };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Date header (month/day, optional year).
    const dateMatch = line.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (dateMatch) {
      finishGroup(currentGroup, entries);
      currentGroup = {
        dateKey: resolveRelativeDate(+dateMatch[1], +dateMatch[2], dateMatch[3] ? +dateMatch[3] : undefined),
        sum: 0,
        checksum: null,
        label: "",
      };
      ignoredLines.push(line);
      i += 1;
      continue;
    }

    // Running total / checksum: `=NNN` (optionally scaled, optional trailing word).
    if (line.startsWith("=")) {
      const scaled = scaleToken(line.slice(1).trim());
      if (scaled != null) {
        currentGroup.checksum = scaled;
        ignoredLines.push(line);
        i += 1;
        continue;
      }
    }

    // Pure arithmetic / balance line: `3000-1295=1705` (no label) → informational.
    const arithmetic = line.match(/^[\d\s]+(?:\s*[-+]\s*[\d\s]+)+\s*=\s*\d+$/);
    if (arithmetic) {
      entries.push({
        id: nextId(),
        date: currentGroup.dateKey,
        amount: 0,
        label: "",
        description: line,
        module: "personal",
        direction: "expense",
        flow: "cash",
        category: "Other",
        flags: [{ kind: "info", message: "Arithmetic/balance note — informational only, not imported." }],
        edited: false,
      });
      ignoredLines.push(line);
      i += 1;
      continue;
    }

    // Leading-label with amount / `+`-chain on the SAME line. Handles loose,
    // label-first notes: `travel 25 + 25 +20+20`, `gift 100 dx lai`,
    // `aama le 505 earn`, `janaki dd 250 + 100`. A line beginning with a digit
    // or a `+` is handled by the amount-first / plus-prefixed branches below.
    const leadingLabelMatch = /^([A-Za-z][\w\s.'-]*?)\s+(\d[\d,]*\.?\d*k?)((?:\s*\+\s*\d[\d,]*\.?\d*k?)*)\s*(.*)$/.exec(line);
    if (leadingLabelMatch && !line.startsWith("+")) {
      const leadingLabel = leadingLabelMatch[1].trim();
      const first = parseAmountToken(leadingLabelMatch[2]);
      const chainTokens = leadingLabelMatch[3].trim() === ""
        ? []
        : leadingLabelMatch[3].split("+").map((t) => parseAmountToken(t.trim()));
      const values = [first, ...chainTokens].filter((v): v is number => v != null && Number.isFinite(v));
      if (values.length > 0) {
        const amount = values.reduce((a, b) => a + b, 0);
        const trailing = (leadingLabelMatch[4] ?? "").trim();
        const { module, direction, flow, category } = classifyLabel([leadingLabel, trailing].filter(Boolean).join(" "));
        entries.push(makeEntry(currentGroup, amount, leadingLabel, leadingLabel, module, direction, flow, category, []));
        currentGroup.sum += amount;
        ignoredLines.push(line);
        i += 1;
        continue;
      }
    }

    // Multi-item `+`-joined segment pair(s). A leading `+` is a plus-prefixed
    // single line (see below), never a multi-item split.
    if (line.includes("+") && !line.startsWith("+")) {
      const split = splitPlusPairs(line);
      if (split.every((p) => p.amount != null)) {
        for (const pair of split) {
          entries.push(makeEntry(currentGroup, pair.amount!, pair.label, "", "personal", "expense", "cash", pair.label, []));
        }
      } else {
        // Lump: sum the parseable amounts, keep the raw line verbatim.
        const lumpAmount = split.reduce((acc, p) => acc + (p.amount ?? 0), 0);
        entries.push(makeLump(currentGroup, line, lumpAmount));
      }
      ignoredLines.push(line);
      i += 1;
      continue;
    }

    // Plus-prefixed line: `+1006 sip ...` → amount + label, type ambiguous.
    if (line.startsWith("+")) {
      const { amount, rest } = splitAmountLabel(line.replace(/^\+/, ""));
      if (amount != null) {
        const suggestion = classifyAmbiguous(rest);
        entries.push(makeEntry(currentGroup, amount, rest, "", suggestion.module, suggestion.direction, suggestion.flow, suggestion.category, [
          { kind: "ambiguous", message: "Type is ambiguous — confirm the target module/type before import." },
        ]));
        ignoredLines.push(line);
        i += 1;
        continue;
      }
    }

    // Amount-then-label (separator optional): `120- vegetables`, `120 vegetables`, `120vegetables`.
    const { amount: amountFirst, rest: labelAfter } = splitAmountLabel(line);
    if (amountFirst != null) {
      // Trailing qualifier "planned" → flag as planned/excluded by default.
      const planned = /(?:^|\s)(needed|planned|to\s+buy|to\s+pay)$/i.test(labelAfter);
      const cleanLabel = labelAfter.replace(/\s*(needed|planned|to\s+buy|to\s+pay)\s*$/i, "").trim();
      const { module, direction, flow, category } = classifyLabel(cleanLabel);
      const flags: ImportFlag[] = planned
        ? [{ kind: "planned", message: "Ends with a planned/needed qualifier — intent, not actual spend." }]
        : [];
      entries.push(makeEntry(currentGroup, amountFirst, cleanLabel, cleanLabel, module, direction, flow, category, flags));
      currentGroup.sum += amountFirst;
      ignoredLines.push(line);
      i += 1;
      continue;
    }

    // Reversed label-then-amount: `Milk -60`, `Vegetables -70(market trip)`.
    const reversed = line.match(/^([A-Za-z][\w\s.'-]*?)\s+-\s*(\d[\d.,]*k?)(?:\(([^)]*)\))?$/i);
    if (reversed) {
      const label = reversed[1].trim();
      const amount = parseAmountToken(reversed[2]) ?? 0;
      const parenthetical = reversed[3] ?? "";
      const { module, direction, flow, category } = classifyLabel(label);
      entries.push(makeEntry(currentGroup, amount, label, parenthetical, module, direction, flow, category, []));
      currentGroup.sum += amount;
      ignoredLines.push(line);
      i += 1;
      continue;
    }

    // A bare label line that the NEXT line is a `+`-joined (or single) sum → label-then-sum.
    const looksLikeLabel = /^[A-Za-z][\w\s.'-]*$/.test(line);
    const next = lines[i + 1];
    const nextIsSum = next && (next.includes("+") ? next.split("+").every((t) => parseAmountToken(t.trim()) != null) : /^\d/.test(next));
    if (looksLikeLabel && nextIsSum) {
      const label = line;
      const sumValues = next!.split("+").map((t) => parseAmountToken(t.trim())!);
      const sum = sumValues.reduce((a, b) => a + b, 0);
      const { module, direction, flow, category } = classifyLabel(label);
      entries.push(makeEntry(currentGroup, sum, label, next!, module, direction, flow, category, []));
      currentGroup.sum += sum;
      ignoredLines.push(line, next!);
      i += 2;
      continue;
    }

    // Non-numeric / unparseable line → ignore (context only).
    ignoredLines.push(line);
    i += 1;
  }

  finishGroup(currentGroup, entries);

  return {
    entries,
    totalAmount: entries.reduce((acc, e) => acc + e.amount, 0),
    ignoredLines,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function nextId(): string {
  return `keep-${Date.now().toString(36)}-${(nextIdCounter += 1)}`;
}
let nextIdCounter = 0;

function makeEntry(
  group: RawDateGroup,
  amount: number,
  label: string,
  description: string,
  module: ImportModule,
  direction: ImportDirection,
  flow: ImportFlow,
  category: string,
  flags: ImportFlag[],
): StagedEntry {
  return { id: nextId(), date: group.dateKey, amount, label, description, module, direction, flow, category, flags, edited: false };
}

function makeLump(group: RawDateGroup, raw: string, lumpAmount: number): StagedEntry {
  const entry = makeEntry(group, lumpAmount, "", raw, "personal", "expense", "cash", "Uncategorized", []);
  entry.flags.push({ kind: "lump", message: "Couldn't reliably split this line — verify/split manually." });
  return entry;
}

/** Close a date group: if a checksum exists and mismatches, flag all group entries. */
function finishGroup(group: RawDateGroup, entries: StagedEntry[]): void {
  if (group.checksum != null && group.checksum !== group.sum) {
    const message = `Checksum mismatch: parsed ₹${group.sum} vs note total ₹${group.checksum}.`;
    for (const e of entries) {
      if (e.date === group.dateKey) e.flags.push({ kind: "checksum", message });
    }
  }
}

/** `8/17` or `8/17/25` → YYYY-MM-DD. Same month/day in the past relative to today. */
function resolveRelativeDate(month: number, day: number, year?: number): string {
  const now = new Date();
  const y = year != null ? (year < 100 ? 2000 + year : year) : now.getFullYear();
  const d = new Date(y, month - 1, day);
  // If in the future, clamp to previous year (notes record the past).
  if (year == null && d.getTime() > now.getTime()) {
    d.setFullYear(y - 1);
  }
  return toDateKey(d);
}

function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "2k" → 2000; returns number or null if not parseable. */
function parseAmountToken(token: string): number | null {
  const t = token.trim().toLowerCase();
  const k = t.endsWith("k");
  const numStr = k ? t.slice(0, -1) : t;
  const n = Number(numStr.replace(/[,\s]/g, ""));
  if (!Number.isFinite(n)) return null;
  return k ? n * 1000 : n;
}

function scaleToken(token: string): number | null {
  // Strip trailing non-numeric words, then scale (e.g. `22k done` → 22000).
  const cleaned = token.replace(/\s*[A-Za-z]+.*$/, "").trim();
  return parseAmountToken(cleaned);
}

/** Split an amount-then-label line, optional separator. Returns amount | null. */
function splitAmountLabel(line: string): { amount: number | null; rest: string } {
  // Leading digits (with optional k / commas / decimal).
  const m = line.match(/^(\d[\d,]*\.?\d*k?)\s*[-]?\s*(.*)$/i);
  if (!m) return { amount: null, rest: line };
  const amount = parseAmountToken(m[1]);
  if (amount == null) return { amount: null, rest: line };
  return { amount, rest: String(m[2] ?? "").trim() };
}

/** Split `50curd+50banana+25somosa` into segments; each `amount+label`. */
function splitPlusPairs(line: string): Array<{ amount: number | null; label: string }> {
  return line.split("+").map((seg) => {
    const { amount, rest } = splitAmountLabel(seg);
    return { amount, label: rest };
  });
}

/** Classify an ambiguous `+`-prefixed label's target module/direction/flow/category. */
function classifyAmbiguous(label: string): { module: ImportModule; direction: ImportDirection; flow: ImportFlow; category: string } {
  const l = label.toLowerCase();
  if (/\bsip\b|\binvestment\b|\bshare\b|\bipo\b|\bbuy\b|\bsell\b|\bdividend\b/.test(l)) {
    return { module: "share", direction: "expense", flow: "cash", category: shareCategoryFor(label) };
  }
  if (/print(ing)?/.test(l)) return { module: "personal", direction: "expense", flow: "cash", category: "Other" };
  if (/registration\s*fee/.test(l)) return { module: "personal", direction: "expense", flow: "cash", category: "Education" };
  if (/\bsession\b|\bsessior\b/.test(l)) return { module: "personal", direction: "expense", flow: "cash", category: "Other" };
  return { module: "personal", direction: "expense", flow: "cash", category: "Other" };
}

function shareCategoryFor(label: string): string {
  const l = label.toLowerCase();
  if (/sip/.test(l)) return "sip";
  if (/sell/.test(l)) return "sell";
  if (/dividend/.test(l)) return "dividend";
  if (/buy/.test(l)) return "buy";
  return "ipo";
}

/** Default module/direction/flow/category for a parsed label (keepNotesImport.md §3). */
function classifyLabel(label: string): { module: ImportModule; direction: ImportDirection; flow: ImportFlow; category: string } {
  const l = label.toLowerCase();

  if (/registration\s*fee/.test(l)) return { module: "personal", direction: "expense", flow: "cash", category: "Education" };
  if (/\bsession\b|\bsessior\b/.test(l)) return { module: "personal", direction: "expense", flow: "cash", category: "Other" };
  if (/\bsip\b|\bshare\b|\bipo\b|\bbuy\b|\bsell\b|\bdividend\b|\binvestment\b/.test(l)) {
    return { module: "share", direction: "expense", flow: "cash", category: shareCategoryFor(label) };
  }
  if (BANK_CATEGORIES.some((c) => l.includes(c.toLowerCase()))) {
    return { module: "bank", direction: "expense", flow: "bank", category: bankCategoryFor(l) };
  }
  if (BANK_INCOME_CATEGORIES.has(l) || /interest\s*earned/i.test(l)) {
    return { module: "bank", direction: "income", flow: "bank", category: "Interest Earned" };
  }

  // Loose-word category mapping (loose/pasted notes, docs/keepNotesImport.md §3).
  // Runs before the exact-opts so travel maps to Transportation (not the "Travel"
  // option) and common food/items get sensible defaults.
  if (/\b(travel|transport|ride|petrol|fuel|trip|vehicle)\b/.test(l)) {
    return { module: "personal", direction: "expense", flow: "cash", category: "Transportation" };
  }
  if (/\bsalary\b/.test(l)) return { module: "personal", direction: "income", flow: "bank", category: "Salary" };
  if (/earn(ed|ing)?|\bincome\b|\bbonus\b/.test(l)) return { module: "personal", direction: "income", flow: "bank", category: "Other Income" };
  // Gift → "Gift" category. Income by default (the app models Gift as income),
  // but an explicit recipient ("to <name>", dative "lai"/"tina"/"tendsi") means
  // the giver is paying out → expense.
  if (/\bgift\b/.test(l)) {
    if (/\bgift\b[\s\S]*(?:lai\b|\btina\b|\btendsi\b|\bto\s+\w|\btimarau\b)/i.test(l)) {
      return { module: "personal", direction: "expense", flow: "cash", category: "Gift" };
    }
    return { module: "personal", direction: "income", flow: "bank", category: "Gift" };
  }
  // Food: English + common Nepali terms (dahi = curd). "fruit dai" still lands
  // here because "fruit" is food; the description keeps the full label.
  if (/\b(dahi|curd|fruit|milk|dudh|vegetable|veggies|sabji|tarkari|rice|bhat|chamal|dal|daal|roti|snack|cola|cake|pizza|juice|tea|coffee|egg|anda|masu|chicken|machha|noodles|biscuit|samosa|momo|paneer|puri|kheer|halwa|achaar|lassi|mithai)\b/.test(l)) {
    return { module: "personal", direction: "expense", flow: "cash", category: "Food" };
  }

  if (MODE_INCOME.has(l)) return { module: "personal", direction: "income", flow: "bank", category: incomeCategoryFor(l) };
  if (MODE_EXPENSES.has(l)) return { module: "personal", direction: "expense", flow: "cash", category: expenseCategoryFor(l) };

  // No known match → treat label as a cash expense (default category "Other", editable).
  return { module: "personal", direction: "expense", flow: "cash", category: "Other" };
}

function bankCategoryFor(l: string): string {
  return BANK_CATEGORIES.find((c) => l.includes(c.toLowerCase())) ?? "Other Charges";
}

function expenseCategoryFor(l: string): string {
  return MODE_EXPENSES.has(l) ? PERSONAL_FINANCE_EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === l)! : "Other";
}

function incomeCategoryFor(l: string): string {
  return MODE_INCOME.has(l) ? PERSONAL_FINANCE_INCOME_CATEGORIES.find((c) => c.toLowerCase() === l)! : "Other Income";
}