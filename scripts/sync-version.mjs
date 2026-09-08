import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const versionArg = process.argv[2];
// SemVer-compliant regex (semver.org): MAJOR.MINOR.PATCH[-pre-release][+build]
// Rejects leading zeros (e.g. 01.2.3) and accepts build metadata (e.g. 1.2.3+build.4).
const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function readJson(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(relativePath, data) {
  const filePath = path.join(projectRoot, relativePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function setPackageVersion(relativePath, version) {
  const data = readJson(relativePath);
  data.version = version;
  writeJson(relativePath, data);
}

function setLockVersion(relativePath, version, linkedRootKeys = []) {
  const data = readJson(relativePath);
  data.version = version;

  if (data.packages?.[""] ) {
    data.packages[""].version = version;
  }

  for (const key of linkedRootKeys) {
    if (data.packages?.[key]) {
      data.packages[key].version = version;
    }
  }

  writeJson(relativePath, data);
}

const rootPackage = readJson("package.json");
const nextVersion = versionArg || rootPackage.version;

if (!versionPattern.test(nextVersion)) {
  throw new Error(`Invalid version "${nextVersion}". Use a semver value like 1.0.4.`);
}

// ── Package / lock files ────────────────────────────────────────────────────
setPackageVersion("package.json", nextVersion);
setPackageVersion("frontendwebapp/package.json", nextVersion);
setPackageVersion("desktop/package.json", nextVersion);

setLockVersion("package-lock.json", nextVersion);
setLockVersion("frontendwebapp/package-lock.json", nextVersion, [".."]);
setLockVersion("desktop/package-lock.json", nextVersion);

// ── desktop-update-policy.json (PRIMARY — read by new clients v1.3.1+) ─────
// latestVersion uses the full "desktop-vX.Y.Z" tag so the new update checker
// can parse it AND construct the correct GitHub release URL.
const desktopPolicyPath = "desktop-update-policy.json";
const desktopPolicy = readJson(desktopPolicyPath);
desktopPolicy.latestVersion = `desktop-v${nextVersion}`;
desktopPolicy.releaseUrl = `https://github.com/sachinadk2011/FinLedge-App/releases/tag/desktop-v${nextVersion}`;
writeJson(desktopPolicyPath, desktopPolicy);

// ── update-policy.json (BACKWARD-COMPAT SHIM — read by old clients v1.1.0-v1.2.0) ──
// Old parseVersionParts() only strips a leading "v", so latestVersion must be
// plain semver (e.g. "1.3.1") — NOT "desktop-v1.3.1" — so old apps can compare.
// releaseUrl is updated so the update dialog links to the right release.
const legacyPolicyPath = "update-policy.json";
const legacyPolicy = readJson(legacyPolicyPath);
legacyPolicy.latestVersion = nextVersion;          // plain semver — old clients can parse this
legacyPolicy.releaseUrl = `https://github.com/sachinadk2011/FinLedge-App/releases/tag/desktop-v${nextVersion}`;
writeJson(legacyPolicyPath, legacyPolicy);

console.log(`Synced FinLedge version to ${nextVersion}.`);
console.log(`  • package.json`);
console.log(`  • frontendwebapp/package.json`);
console.log(`  • desktop/package.json`);
console.log(`  • desktop-update-policy.json  (latestVersion → desktop-v${nextVersion})`);
console.log(`  • update-policy.json           (latestVersion → ${nextVersion}, compat shim for old clients)`);

