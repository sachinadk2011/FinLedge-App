import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { isoDayKey, isoMonthKey } from "../src/utils/date.js";
import { filterShareRecordsAsOf } from "../src/utils/shareClosingPosition.js";
import { sortHistoryNewestFirst } from "../src/utils/history.js";
import { filterRecordsByPeriod, getDashboardPeriodBounds } from "../src/utils/dashboardPeriod.js";

const distPath = path.resolve("dist");
if (!fs.existsSync(distPath)) {
  console.error("Smoke test failed: dist folder not found. Run npm run build first.");
  process.exit(1);
}

const indexPath = path.join(distPath, "index.html");
if (!fs.existsSync(indexPath)) {
  console.error("Smoke test failed: dist/index.html not found.");
  process.exit(1);
}

console.log("Smoke test passed: build artifacts exist.");

const publicConfigPath = path.join(distPath, "finledge-public-config.json");
if (!fs.existsSync(publicConfigPath)) {
  console.error("Smoke test failed: public desktop repository config was not emitted.");
  process.exit(1);
}
const publicConfig = JSON.parse(fs.readFileSync(publicConfigPath, "utf8"));
assert.ok(publicConfig.githubOwner && publicConfig.githubRepo, "public repository metadata is missing");
assert.match(publicConfig.releasesUrl || "", /^https:\/\//, "release URL must use HTTPS");
assert.match(publicConfig.updatePolicyUrl || "", /^https:\/\//, "update policy URL must use HTTPS");
console.log("Smoke test passed: packaged public repository config is valid.");

const previousTimezone = process.env.TZ;
process.env.TZ = "America/Los_Angeles";
assert.equal(isoDayKey("2025-01-01"), "2025-01-01");
assert.equal(isoMonthKey("2025-01-01"), "2025-01");
assert.equal(isoDayKey("45658"), "2025-01-01");
assert.equal(isoDayKey("2025-01-01T00:30:00Z"), "2024-12-31");
if (previousTimezone === undefined) delete process.env.TZ;
else process.env.TZ = previousTimezone;
console.log("Smoke test passed: local date keys stay in the intended timezone.");

const orderedHistory = sortHistoryNewestFirst([
  { id: "older-day", date: "2026-10-28", created_timestamp: "2026-10-29T12:00:00" },
  { id: "newer-day", date: "2026-10-29", created_timestamp: "2026-10-28T08:00:00" },
  { id: "same-day-created", date: "2026-10-29", created_timestamp: "2026-10-29T11:00:00", last_updated_timestamp: "2026-10-29T11:00:00" },
  { id: "same-day-updated", date: "2026-10-29", created_timestamp: "2026-10-29T11:00:00", last_updated_timestamp: "2026-10-29T12:00:00" },
]);
assert.deepEqual(orderedHistory.map((record) => record.id), ["same-day-updated", "same-day-created", "newer-day", "older-day"]);
console.log("Smoke test passed: history is ordered by date, created time, then last update.");

const shareClosingRows = filterShareRecordsAsOf([
  { date: "2025-01-01", id: 1, share_name: "CMF2", category: "buy", holding_cost: 6000 },
  { date: "2025-01-15", id: 2, share_name: "CMF2", category: "sell", holding_cost: 4000 },
  { date: "2025-02-01", id: 3, share_name: "CMF2", category: "buy", holding_cost: 7000 },
  { date: "2025-01-15", id: 4, share_name: "FUND", category: "sip", buy_sell: "installment", total_amount: 500 },
  { date: "2025-01-15", id: 5, share_name: "FUND", category: "sip", buy_sell: "redeem", total_amount: 200 },
  { date: "2025-02-01", id: 6, share_name: "FUND", category: "sip", buy_sell: "installment", total_amount: 700 },
], "2025-01-31");
assert.deepEqual(shareClosingRows.map((record) => record.id), [1, 2, 4, 5]);
console.log("Smoke test passed: share closing balances honor the selected period end date.");

process.env.TZ = "UTC";
const periodNow = new Date(2026, 9, 31);
const weekBounds = getDashboardPeriodBounds("week", "", "", { now: periodNow });
const monthBounds = getDashboardPeriodBounds("month", "", "", { now: periodNow });
const yearBounds = getDashboardPeriodBounds("year", "", "", { now: periodNow });
const customBounds = getDashboardPeriodBounds("custom", "2026-10-25", "2026-10-26", { now: periodNow });
assert.equal(weekBounds.start.getDay(), 1, "calendar weeks start on Monday");
assert.equal(weekBounds.start.getDate(), 26);
assert.equal(monthBounds.start.getDate(), 1);
assert.equal(monthBounds.start.getMonth(), 9);
assert.equal(yearBounds.start.getMonth(), 0);
assert.equal(yearBounds.start.getFullYear(), 2026);
assert.deepEqual(filterRecordsByPeriod([{ date: "2026-10-24" }, { date: "2026-10-25" }, { date: "2026-10-26" }, { date: "2026-10-27" }], customBounds).map((row) => row.date), ["2026-10-25", "2026-10-26"]);
assert.equal(getDashboardPeriodBounds("all_time", "", "", { now: periodNow }), null);
const dateRows = ["2026-10-25", "2026-10-26", "2026-10-31", "2026-11-01"].map((date) => ({ date }));
assert.deepEqual(filterRecordsByPeriod(dateRows, weekBounds).map((row) => row.date), ["2026-10-26", "2026-10-31"]);
assert.deepEqual(filterRecordsByPeriod(dateRows, monthBounds).map((row) => row.date), ["2026-10-25", "2026-10-26", "2026-10-31"]);
assert.deepEqual(filterRecordsByPeriod(dateRows, yearBounds).map((row) => row.date), ["2026-10-25", "2026-10-26", "2026-10-31"]);
console.log("Smoke test passed: Week, Month, and Year filter actual rows to calendar boundaries.");

const importReviewSource = fs.readFileSync(path.resolve("src/pages/ImportReview.jsx"), "utf8");
assert.match(importReviewSource, /Confirm import/);
assert.match(importReviewSource, /aria-label=\{`Move row \$\{index \+ 1\} up`\}/);
assert.match(importReviewSource, /aria-label=\{`Move row \$\{index \+ 1\} down`\}/);
assert.doesNotMatch(importReviewSource, /Import steps|Review and continue|confirmStep/);
assert.match(importReviewSource, /import-row-moved/);
assert.doesNotMatch(importReviewSource, /setTimeout\(\(\) => navigate\("\/settings"/);
console.log("Smoke test passed: Excel import review edits and confirms on one page with accessible reorder icons.");
