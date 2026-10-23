import { parseDate } from "./date";

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDefaultCustomRange(now = new Date()) {
  return {
    start: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: dateKey(now),
  };
}

export function getDashboardPeriodBounds(range, customStart, customEnd, { bankMode = false, now = new Date() } = {}) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start;
  if (range === "all_time") return null;
  if (range === "custom") {
    start = parseDate(customStart);
    const selectedEnd = parseDate(customEnd);
    if (!start || !selectedEnd || selectedEnd < start) return null;
    return { start: new Date(start.getFullYear(), start.getMonth(), start.getDate()), end: new Date(selectedEnd.getFullYear(), selectedEnd.getMonth(), selectedEnd.getDate()) };
  }
  if (range === "week") {
    start = new Date(end);
    start.setDate(start.getDate() - 89);
  } else if (range === "month" && bankMode) {
    start = new Date(end.getFullYear(), end.getMonth() - 12, 1);
  } else if (range === "month") {
    start = new Date(end);
    start.setDate(start.getDate() - 399);
  } else {
    start = new Date(end.getFullYear(), end.getMonth() - 47, 1);
  }
  return { start, end };
}

export function getRecordDateBounds(records, now = new Date()) {
  const dates = records.map((record) => parseDate(record.date)).filter(Boolean);
  if (!dates.length) return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
  const earliest = dates.reduce((min, date) => date < min ? date : min, dates[0]);
  return {
    start: new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate()),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  };
}

export function filterRecordsByPeriod(records, bounds) {
  if (!bounds) return [];
  return records.filter((record) => {
    const date = parseDate(record.date);
    if (!date) return false;
    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return localDate >= bounds.start && localDate <= bounds.end;
  });
}

export function buildDashboardBuckets(records, bounds, { monthly = null } = {}) {
  if (!bounds) return [];
  const useMonths = monthly ?? (bounds.end - bounds.start) / 86400000 > 60;
  const buckets = new Map();
  const cursor = new Date(bounds.start);
  if (useMonths) cursor.setDate(1);
  const last = new Date(bounds.end);
  if (useMonths) last.setDate(1);

  while (cursor <= last) {
    const key = useMonths ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}` : dateKey(cursor);
    buckets.set(key, {
      label: useMonths
        ? `${new Intl.DateTimeFormat("en-US", { month: "short" }).format(cursor)} '${String(cursor.getFullYear()).slice(-2)}`
        : `${String(cursor.getDate()).padStart(2, "0")} ${new Intl.DateTimeFormat("en-US", { month: "short" }).format(cursor)}`,
      sublabel: useMonths
        ? `'${String(cursor.getFullYear()).slice(-2)}`
        : new Intl.DateTimeFormat("en-US", { month: "short" }).format(cursor),
      key,
    });
    cursor.setDate(useMonths ? 1 : cursor.getDate() + 1);
    if (useMonths) cursor.setMonth(cursor.getMonth() + 1);
  }
  return [...buckets.values()];
}
