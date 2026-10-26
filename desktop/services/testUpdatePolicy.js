"use strict";

const fs = require("fs");
const path = require("path");

const POLICY_FILE_NAME = "desktop-update-policy.json";

function createTestUpdatePolicy({
  app,
  isTestingBuild,
  preferredDirectory,
  templatePath = path.join(__dirname, "test-update-policy.example.json"),
}) {
  if (!isTestingBuild) return null;

  // On the build machine, use the Git-ignored desktop/test-update-policy folder
  // so an installed test build can read edits made after installation. On other
  // machines that build-time path will not exist, so use persistent app data.
  const preferred = String(preferredDirectory || "").trim();
  const fallback = path.join(app.getPath("userData"), "test-update-policy");
  const candidates = preferred && fs.existsSync(preferred)
    ? [path.resolve(preferred), fallback]
    : [fallback];
  let lastError;

  for (const directory of [...new Set(candidates)]) {
    try {
      const policyPath = path.join(directory, POLICY_FILE_NAME);
      fs.mkdirSync(directory, { recursive: true });
      if (!fs.existsSync(policyPath)) fs.copyFileSync(templatePath, policyPath);
      return { directory, policyPath };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Could not prepare the local test update policy: ${lastError?.message || "unknown error"}`);
}

module.exports = { POLICY_FILE_NAME, createTestUpdatePolicy };
