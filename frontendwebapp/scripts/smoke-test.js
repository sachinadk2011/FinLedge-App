import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { isoDayKey, isoMonthKey } from "../src/utils/date.js";
import { sortHistoryNewestFirst } from "../src/utils/history.js";

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
