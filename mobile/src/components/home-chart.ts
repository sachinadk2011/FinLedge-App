import { appState } from "../app-state.js";
import type { ChartBucket } from "../types.js";
import { addDays, daysBetween, parseDateKey, toDateKey, today } from "../utils/date.js";
import { compactMoney } from "../utils/format.js";
import type { PersonalFinanceRecord } from "../../services/personal-finance-sync-row-computation.js";

export function homeChart(rows: PersonalFinanceRecord[]): string {
  const buckets = chartBuckets(rows);
  if (typeof buckets === "string") {
    return `<p class="sub range-warning">${buckets}</p>`;
  }
  const max = Math.max(...buckets.flatMap((bucket) => [bucket.income, bucket.expense, Math.abs(bucket.net)]), 1);
  const minWidth = Math.max(320, buckets.length * 78);
  return `
    <div class="chart-scroll">
      <div class="period-bars" style="grid-template-columns:repeat(${buckets.length}, 68px);min-width:${minWidth}px;">
        ${buckets.map((bucket) => groupedBar(bucket, max)).join("")}
      </div>
    </div>
    <div class="chart-legend"><span><i class="legend-income"></i>Income</span><span><i class="legend-expense"></i>Expense</span><span><i class="legend-net"></i>Net balance</span></div>
  `;
}

export function categoryBars(rows: PersonalFinanceRecord[]): string {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const category = String(row.category ?? "Other");
    totals.set(category, (totals.get(category) ?? 0) + Number(row.amount ?? 0));
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!sorted.length) {
    return `<p class="sub">Nothing to show for the selected ${appState.homeMode} categories yet.</p>`;
  }
  const max = Math.max(...sorted.map(([, amount]) => amount), 1);
  const tone = appState.homeMode === "income" ? "pos" : "neg";
  const color = appState.homeMode === "income" ? "var(--accent-green)" : "var(--accent-red)";
  return sorted.map(([category, amount]) => `<div class="history-row"><b>${category}</b><span class="money ${tone}">${compactMoney(amount)}</span></div><div class="category-meter"><i style="width:${Math.max(8, (amount / max) * 100)}%;background:${color};"></i></div>`).join("");
}

function groupedBar(bucket: ChartBucket, max: number): string {
  const netTone = bucket.net >= 0 ? "pos" : "neg";
  return `
    <div class="period-group">
      <div class="period-sticks">
        ${miniBar(bucket.income, max, "income")}
        ${miniBar(bucket.expense, max, "expense")}
        ${miniBar(Math.abs(bucket.net), max, bucket.net >= 0 ? "net-pos" : "net-neg", compactMoney(bucket.net), netTone)}
      </div>
      <span>${bucket.label}</span>
    </div>
  `;
}

function miniBar(value: number, max: number, tone: string, label = compactMoney(value), labelTone = value >= 0 ? "pos" : "neg"): string {
  return `<div class="mini-bar ${tone}"><em class="${labelTone}">${label}</em><i style="height:${Math.max(10, (value / max) * 78)}%;"></i></div>`;
}

function chartBuckets(rows: PersonalFinanceRecord[]): ChartBucket[] | string {
  const now = today();
  if (appState.homeRange === "week") {
    return dailyBuckets(rows, addDays(now, -6), now);
  }
  if (appState.homeRange === "month") {
    return dailyBuckets(rows, new Date(now.getFullYear(), now.getMonth(), 1), now);
  }
  if (appState.homeRange === "year") {
    const buckets = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), index, 1);
      return createChartBucket(date.toLocaleString("en-US", { month: "short" }), `${now.getFullYear()}-${String(index + 1).padStart(2, "0")}`);
    });
    for (const row of rows) {
      const bucket = buckets.find((item) => item.key === String(row.date).slice(0, 7));
      if (bucket) addRowToChartBucket(bucket, row);
    }
    return buckets;
  }

  const span = daysBetween(appState.customStart, appState.customEnd);
  if (span < 1) return "Choose an end date after the start date.";
  if (span > 120) return "Custom graph range supports up to 120 days.";
  return dailyBuckets(rows, parseDateKey(appState.customStart), parseDateKey(appState.customEnd));
}

function dailyBuckets(rows: PersonalFinanceRecord[], start: Date, end: Date): ChartBucket[] {
  const buckets: ChartBucket[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const key = toDateKey(cursor);
    buckets.push(createChartBucket(String(cursor.getDate()), key));
  }
  for (const row of rows) {
    const bucket = buckets.find((item) => item.key === String(row.date));
    if (bucket) addRowToChartBucket(bucket, row);
  }
  return buckets;
}

function createChartBucket(label: string, key: string): ChartBucket {
  return { label, key, income: 0, expense: 0, net: 0 };
}

function addRowToChartBucket(bucket: ChartBucket, row: PersonalFinanceRecord): void {
  const amount = Number(row.amount || 0);
  if (row.direction === "income") {
    bucket.income += amount;
    bucket.net += amount;
  } else {
    bucket.expense += amount;
    bucket.net -= amount;
  }
}
