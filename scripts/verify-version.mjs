import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const expectedVersion = process.argv[2];
const packageFiles = [
  "package.json",
  "package-lock.json",
  "frontendwebapp/package.json",
  "frontendwebapp/package-lock.json",
  "desktop/package.json",
  "desktop/package-lock.json",
];

if (!expectedVersion) {
  throw new Error("Usage: node ./scripts/verify-version.mjs <version>");
}

for (const relativePath of packageFiles) {
  const filePath = path.join(projectRoot, relativePath);
  const actualVersion = JSON.parse(fs.readFileSync(filePath, "utf8")).version;

  if (actualVersion !== expectedVersion) {
    throw new Error(`${relativePath} is ${actualVersion}, expected ${expectedVersion}.`);
  }
}

// Check desktop-update-policy.json latestVersion = "desktop-v{version}"
const desktopPolicyPath = path.join(projectRoot, "desktop-update-policy.json");
const desktopPolicy = JSON.parse(fs.readFileSync(desktopPolicyPath, "utf8"));
const expectedDesktopTag = `desktop-v${expectedVersion}`;
if (desktopPolicy.latestVersion !== expectedDesktopTag) {
  throw new Error(
    `desktop-update-policy.json latestVersion is "${desktopPolicy.latestVersion}", expected "${expectedDesktopTag}".`
  );
}

// Check update-policy.json latestVersion = "{version}" (plain semver, for old clients)
const legacyPolicyPath = path.join(projectRoot, "update-policy.json");
const legacyPolicy = JSON.parse(fs.readFileSync(legacyPolicyPath, "utf8"));
if (legacyPolicy.latestVersion !== expectedVersion) {
  throw new Error(
    `update-policy.json latestVersion is "${legacyPolicy.latestVersion}", expected "${expectedVersion}" (plain semver for old clients).`
  );
}

console.log(`Version files match ${expectedVersion}.`);
console.log(`  desktop-update-policy.json latestVersion = "${expectedDesktopTag}" ✓`);
console.log(`  update-policy.json latestVersion = "${expectedVersion}" (compat shim) ✓`);

