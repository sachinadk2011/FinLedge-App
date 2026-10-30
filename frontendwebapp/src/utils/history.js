import { parseDate } from "./date.js";

function firstValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return null;
}

function timestampValue(value) {
  const parsed = parseDate(value);
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.getTime() : Number.NEGATIVE_INFINITY;
}

export function sortHistoryNewestFirst(records = []) {
  return records
    .map((record, index) => ({
      record,
      index,
      date: timestampValue(firstValue(record, ["date", "Date"])),
      created: timestampValue(firstValue(record, ["created_timestamp", "createdTimestamp", "created timestamp", "timestamp"])),
      updated: timestampValue(firstValue(record, ["last_updated_timestamp", "lastUpdatedTimestamp", "last updated timestamp", "updated_timestamp"])),
    }))
    .sort((left, right) =>
      right.date - left.date
      || right.created - left.created
      || right.updated - left.updated
      || left.index - right.index)
    .map(({ record }) => record);
}
