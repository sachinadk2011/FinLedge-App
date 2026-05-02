import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const versionArg = process.argv[2];
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

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
