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

  if (data.packages?.[""]) {
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

setPackageVersion("package.json", nextVersion);
setPackageVersion("frontendwebapp/package.json", nextVersion);
setPackageVersion("desktop/package.json", nextVersion);

setLockVersion("package-lock.json", nextVersion);
setLockVersion("frontendwebapp/package-lock.json", nextVersion, [".."]);
setLockVersion("desktop/package-lock.json", nextVersion);

console.log(`Synced FinLedge version to ${nextVersion}.`);
