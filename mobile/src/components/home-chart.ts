import { appState } from "../app-state.js";
import type { ChartBucket } from "../types.js";
import { addDays, daysBetween, monthKey, parseDateKey, toDateKey, today } from "../utils/date.js";
import { compactMoney } from "../utils/format.js";
import type { PersonalFinanceRecord } from "../../services/personal-finance-sync-row-computation.js";

// ─────────────────────────────────────────────────────────────────────────────
// Color rules (design.md §5) — fixed everywhere:
//   green  = income / positive
//   red    = expense / negative
//   teal   = net ≥ 0
//   amber  = net < 0
// ─────────────────────────────────────────────────────────────────────────────
const C_INCOME  = "var(--accent-green)";
const C_EXPENSE = "var(--accent-red)";
const C_NET_POS = "var(--brand-teal)";
const C_NET_NEG = "var(--accent-amber)";

// Chart dimensions
const COL_W   = 60;  // px — wider to fit 3 grouped bars
const COL_H   = 148;
const LBL_H   = 14;
const SUB_H   = 12;
const VAL_H   = 13;
const BAR_W   = 12;  // each of 3 mini-bars width
const BAR_GAP = 2;
const BAR_MAX = COL_H - LBL_H - SUB_H - VAL_H - 8; // ≈ 101px usable bar height

/**
 * Home chart — 3 grouped bars per period (income green, expense red, net teal/amber).
 * Zero-value bars are NOT rendered (no bar, no label) — cleaner per prototype.
 * chart-scroll + data-scroll-end so today is auto-scrolled to the right by main.ts.
 * Generates enough history so user can scroll left: 90d (week), 400d (month), 48mo (year).
 */
export function homeChart(rows: PersonalFinanceRecord[]): string {
  const buckets = chartBuckets(rows);
  if (typeof buckets === "string") return `<p class="sub range-warning">${buckets}</p>`;

  const maxVal = Math.max(
    ...buckets.flatMap((b) => [b.income, b.expense, Math.abs(b.net)]),
    1,
  );
  const totalW = buckets.length * (COL_W + 4) + 16;

  const cols = buckets.map((b) => groupedBarCol(b, maxVal)).join("");

  return `
    <div class="chart-scroll" data-scroll-end style="-webkit-overflow-scrolling:touch;">
      <div style="display:flex;align-items:flex-end;gap:4px;padding:0 8px 4px;width:${totalW}px;">
        ${cols}
      </div>
    </div>
    <div class="chart-legend" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;">
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${C_INCOME};margin-right:4px;vertical-align:middle;"></i>Income</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${C_EXPENSE};margin-right:4px;vertical-align:middle;"></i>Expense</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${C_NET_POS};margin-right:4px;vertical-align:middle;"></i>Net ≥0</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${C_NET_NEG};margin-right:4px;vertical-align:middle;"></i>Net &lt;0</span>
    </div>
  `;
}

function groupedBarCol(b: ChartBucket, maxVal: number): string {
  const incBar  = mkBar(b.income,        maxVal, C_INCOME,  b.income  > 0);
  const expBar  = mkBar(b.expense,       maxVal, C_EXPENSE, b.expense > 0);
  const netColor = b.net >= 0 ? C_NET_POS : C_NET_NEG;
  const netBar  = mkBar(Math.abs(b.net), maxVal, netColor,  b.net    !== 0, compactMoney(b.net));

  return `<div style="width:${COL_W}px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;height:${COL_H}px;justify-content:flex-end;gap:1px;">
    <div style="display:flex;align-items:flex-end;gap:${BAR_GAP}px;margin-bottom:2px;">${incBar}${expBar}${netBar}</div>
    <span style="height:${LBL_H}px;font-size:9px;color:var(--text-2);font-weight:500;">${b.label}</span>
    <span style="height:${SUB_H}px;font-size:8px;color:var(--text-3);">${b.sublabel ?? ""}</span>
  </div>`;
}

/** Renders a single mini-bar. If show=false (value is 0), renders empty spacer. */
function mkBar(value: number, maxVal: number, color: string, show: boolean, valueLabel?: string): string {
  if (!show || Math.abs(value) < 0.01) {
    // Empty spacer so columns stay aligned
    return `<div style="width:${BAR_W}px;display:flex;flex-direction:column;align-items:center;"></div>`;
  }
  const barPx = Math.max(6, (Math.abs(value) / maxVal) * BAR_MAX);
  const lbl = valueLabel ?? compactMoney(value);
  return `<div style="width:${BAR_W}px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:1px;">
    <span style="font-size:8px;font-weight:700;color:${color};font-variant-numeric:tabular-nums;white-space:nowrap;transform:rotate(-55deg);transform-origin:center bottom;display:block;margin-bottom:2px;">${lbl}</span>
    <div style="height:${barPx}px;width:${BAR_W}px;background:${color};border-radius:3px 3px 1px 1px;"></div>
  </div>`;
}

export function categoryBars(rows: PersonalFinanceRecord[]): string {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const category = String(row.category ?? "Other");
    totals.set(category, (totals.get(category) ?? 0) + Number(row.amount ?? 0));
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!sorted.length) return `<p class="sub">Nothing to show for the selected ${appState.homeMode} categories yet.</p>`;
  const max = Math.max(...sorted.map(([, amount]) => amount), 1);
  const tone  = appState.homeMode === "income" ? "pos" : "neg";
  const color = appState.homeMode === "income" ? C_INCOME : C_EXPENSE;
  return sorted.map(([cat, amount]) =>
    `<div class="history-row"><b>${cat}</b><span class="money ${tone}">${compactMoney(amount)}</span></div>
     <div class="category-meter"><i style="width:${Math.max(8, (amount / max) * 100)}%;background:${color};"></i></div>`
  ).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucket generation — extended history so scrolling shows past data
// ─────────────────────────────────────────────────────────────────────────────

function chartBuckets(rows: PersonalFinanceRecord[]): (ChartBucket & { sublabel: string })[] | string {
  const now = today();

  if (appState.homeRange === "week") {
    // 90 daily buckets = ~13 weeks of history. Today is last (rightmost).
    return buildDailyBuckets(rows, addDays(now, -89), now);
  }
  if (appState.homeRange === "month") {
    // 400 daily buckets = ~13 months of daily history. Today is last.
    return buildDailyBuckets(rows, addDays(now, -399), now);
  }
  if (appState.homeRange === "year") {
    // 48 monthly buckets = 4 years of monthly history. Current month is last.
    return buildMonthlyBuckets(rows, 48);
  }

  // custom
  const span = daysBetween(appState.customStart, appState.customEnd);
  if (span < 1)   return "Choose an end date after the start date.";
  if (span > 365) return "Custom range supports up to 365 days.";
  return buildDailyBuckets(rows, parseDateKey(appState.customStart), parseDateKey(appState.customEnd));
}

function buildDailyBuckets(
  rows: PersonalFinanceRecord[],
  start: Date,
  end: Date,
): (ChartBucket & { sublabel: string })[] {
  const map = new Map<string, ChartBucket & { sublabel: string }>();
  for (let cur = new Date(start); cur <= end; cur = addDays(cur, 1)) {
    const key = toDateKey(cur);
    const sublabel = cur.toLocaleString("en-US", { month: "short" });
    map.set(key, { label: String(cur.getDate()), sublabel, key, income: 0, expense: 0, net: 0 });
  }
  for (const row of rows) {
    const bucket = map.get(String(row.date));
    if (bucket) addToBucket(bucket, row);
  }
  return [...map.values()];
}

function buildMonthlyBuckets(
  rows: PersonalFinanceRecord[],
  count: number,
): (ChartBucket & { sublabel: string })[] {
  const now = today();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    const key = monthKey(d);
    const yr = String(d.getFullYear()).slice(2);
    const bucket: ChartBucket & { sublabel: string } = {
      label: d.toLocaleString("en-US", { month: "short" }),
      sublabel: `'${yr}`,
      key,
      income: 0,
      expense: 0,
      net: 0,
    };
    for (const row of rows) {
      if (String(row.date).startsWith(key)) addToBucket(bucket, row);
    }
    return bucket;
  });
}

function addToBucket(bucket: ChartBucket, row: PersonalFinanceRecord): void {
  const amount = Number(row.amount || 0);
  if (row.direction === "income") {
    bucket.income += amount;
    bucket.net    += amount;
  } else {
    bucket.expense += amount;
    bucket.net     -= amount;
  }
}
