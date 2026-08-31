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

// Plot area height — labels sit directly above each bar, not in a fixed top band
const COL_W   = 72;
const COL_H   = 168;
const PLOT_H  = 104;
const BAR_MAX = PLOT_H - 16;

/**
 * Home chart — 3 grouped bars per period (income green, expense red, net teal/amber).
 * Zero-value bars are NOT rendered (no bar, no label) — cleaner per prototype.
 * chart-scroll + data-scroll-end so today is auto-scrolled to the right by main.ts.
 * Generates enough history so user can scroll left: 90d (week), 400d (month), 48mo (year).
 */
export function homeChart(rows: PersonalFinanceRecord[]): string {
  const buckets = chartBuckets(rows);
  if (typeof buckets === "string") return `<p class="sub range-warning">${buckets}</p>`;
  return `${renderGroupedBars(buckets)}${groupedBarsLegend()}`;
}

/** Three-bar chart (income / expense / net) — shared by Home, Bank, and Expenses dashboards. */
export function renderGroupedBars(buckets: (ChartBucket & { sublabel?: string })[]): string {
  if (!buckets.length) return "<p class='sub'>No data for this period.</p>";

  const maxVal = Math.max(
    ...buckets.flatMap((b) => [b.income, b.expense, Math.abs(b.net)]),
    1,
  );
  const totalW = buckets.length * (COL_W + 4) + 16;
  const cols = buckets.map((b) => groupedBarCol(b, maxVal)).join("");

  return `
    <div class="chart-scroll chart-animate" data-scroll-end style="-webkit-overflow-scrolling:touch;">
      <div class="chart-track grouped-chart-track" style="width:${totalW}px;">
        ${cols}
      </div>
    </div>
  `;
}

export function groupedBarsLegend(): string {
  return `<div class="chart-legend" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;">
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${C_INCOME};margin-right:4px;vertical-align:middle;"></i>Income</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${C_EXPENSE};margin-right:4px;vertical-align:middle;"></i>Expense</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${C_NET_POS};margin-right:4px;vertical-align:middle;"></i>Net ≥0</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${C_NET_NEG};margin-right:4px;vertical-align:middle;"></i>Net &lt;0</span>
    </div>`;
}

function groupedBarCol(b: ChartBucket, maxVal: number): string {
  const netColor = b.net >= 0 ? C_NET_POS : C_NET_NEG;
  const specs = [
    { value: b.income, color: C_INCOME, show: b.income > 0, label: compactMoney(b.income) },
    { value: b.expense, color: C_EXPENSE, show: b.expense > 0, label: compactMoney(b.expense) },
    { value: Math.abs(b.net), color: netColor, show: b.net !== 0, label: compactMoney(b.net) },
  ];

  const sticks = specs.map((spec) => stickHtml(spec, maxVal)).join("");

  return `<div class="grouped-bar-col" style="width:${COL_W}px;">
    <div class="grouped-bar-sticks">${sticks}</div>
    <span class="grouped-bar-x">${b.label}</span>
    <span class="grouped-bar-sub">${b.sublabel ?? ""}</span>
  </div>`;
}

function stickHtml(
  spec: { value: number; color: string; show: boolean; label: string },
  maxVal: number,
): string {
  if (!spec.show || Math.abs(spec.value) < 0.01) {
    return `<div class="grouped-bar-stick grouped-bar-stick-empty"></div>`;
  }
  const barPx = Math.max(4, (Math.abs(spec.value) / maxVal) * BAR_MAX);
  return `<div class="grouped-bar-stick">
    <span class="grouped-bar-val" style="color:${spec.color};" title="${spec.label}">${spec.label}</span>
    <div class="grouped-bar-body" style="height:${barPx}px;background:${spec.color};"></div>
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
