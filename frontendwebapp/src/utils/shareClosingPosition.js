import { getTodayInputValue, isoDayKey } from "./date.js";

export function filterShareRecordsAsOf(records, closingEndDate = getTodayInputValue()) {
  return records.filter((record) => {
    const recordDate = isoDayKey(record.date);
    return recordDate && recordDate <= closingEndDate;
  });
}
