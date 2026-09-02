import { appState } from "../app-state.js";
import type { ChartRange } from "../types.js";
import { addDays, daysBetween, monthKey, parseDateKey, toDateKey, today } from "./date.js";

export type PeriodBucket = {
  /** Primary x-axis label: day number for day buckets ("31"), month abbrev for month buckets ("Aug") */
  label: string;
  /** Secondary label below: month abbrev for day buckets ("Aug"), 2-digit year for month buckets ("'26") */
  sublabel: string;
  /** "YYYY-MM-DD" for day buckets, "YYYY-MM" for month buckets */
  key: string;
  isDay: boolean;
};

/**
 * Returns ALL historical period buckets for the current appState.homeRange.
 * Buckets ordered oldest → newest so today / current month is RIGHTMOST.
 * Generates enough history so the user can scroll left to see past data:
 *   week  → 90 daily buckets  (~13 weeks of history)
 *   month → 400 daily buckets (~13 months of daily data)
 *   year  → 48 monthly buckets (~4 years of monthly data)
 *   custom→ daily ≤60d, monthly >60d
 */
export function getPeriodBuckets(range: ChartRange = appState.homeRange, bankMode = false): PeriodBucket[] {
  const now = today();
  if (bankMode && range === "week") {
    range = "month";
  }

  if (range === "week" && !bankMode) {
    return Array.from({ length: 90 }, (_, i) => {
      const d = addDays(now, i - 89);
      return { label: String(d.getDate()), sublabel: d.toLocaleString("en-US", { month: "short" }), key: toDateKey(d), isDay: true };
    });
  }

  if (range === "month") {
    if (bankMode) {
      return Array.from({ length: 13 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (12 - i), 1);
        const yr = String(d.getFullYear()).slice(2);
        return { label: d.toLocaleString("en-US", { month: "short" }), sublabel: `'${yr}`, key: monthKey(d), isDay: false };
      });
    }
    return Array.from({ length: 400 }, (_, i) => {
      const d = addDays(now, i - 399);
      return { label: String(d.getDate()), sublabel: d.toLocaleString("en-US", { month: "short" }), key: toDateKey(d), isDay: true };
    });
  }

  if (range === "year") {
    return Array.from({ length: 48 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (47 - i), 1);
      const yr = String(d.getFullYear()).slice(2);
      return { label: d.toLocaleString("en-US", { month: "short" }), sublabel: `'${yr}`, key: monthKey(d), isDay: false };
    });
  }

  if (range !== "custom") {
    return [];
  }

  // custom
  const span = daysBetween(appState.customStart, appState.customEnd);
  if (span <= 60) {
    return Array.from({ length: span }, (_, i) => {
      const d = addDays(parseDateKey(appState.customStart), i);
      return { label: String(d.getDate()), sublabel: d.toLocaleString("en-US", { month: "short" }), key: toDateKey(d), isDay: true };
    });
  }
  const buckets: PeriodBucket[] = [];
  let cur = new Date(parseDateKey(appState.customStart));
  cur.setDate(1);
  const endD = parseDateKey(appState.customEnd);
  while (cur <= endD) {
    const yr = String(cur.getFullYear()).slice(2);
    buckets.push({ label: cur.toLocaleString("en-US", { month: "short" }), sublabel: `'${yr}`, key: monthKey(cur), isDay: false });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return buckets;
}

/** True when a record's date falls inside the given period bucket. */
export function matchesPeriod(bucket: PeriodBucket, date: string | number): boolean {
  return bucket.isDay ? String(date) === bucket.key : String(date).startsWith(bucket.key);
}