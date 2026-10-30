"use strict";

const path = require("path");
const fs = require("fs");

function findAppxPackageRoamingRoot({
  localAppDataPath = process.env.LOCALAPPDATA,
  packageFamilyName = "",
  isTestingBuild = false,
  fileSystem = fs,
} = {}) {
  if (!localAppDataPath) return [];
  const packagesPath = path.join(localAppDataPath, "Packages");
  let packageNames = [];
  try {
    packageNames = fileSystem.readdirSync(packagesPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^SachinAdhikari\.Finledge(?:\.Testing)?_/i.test(entry.name))
      .map(entry => entry.name);
  } catch {
    packageNames = [];
  }

  const requestedFamily = String(packageFamilyName || "").trim();
  if (requestedFamily) packageNames = [requestedFamily];
  packageNames = packageNames.filter(name => isTestingBuild
    ? /^SachinAdhikari\.Finledge\.Testing_/i.test(name)
    : /^SachinAdhikari\.Finledge_/i.test(name) && !/^SachinAdhikari\.Finledge\.Testing_/i.test(name));

  return [...new Set(packageNames.map(name => path.resolve(packagesPath, name, "LocalCache", "Roaming")))];
}

function findAppxLegacyDirs({
  localAppDataPath = process.env.LOCALAPPDATA,
  fileSystem = fs,
  isTestingBuild = false,
} = {}) {
  // A package scans only roots from its own build channel. In particular, a
  // Testing build must never treat a production package's redirected roaming
  // folder as an import source.
  const roamingRoots = findAppxPackageRoamingRoot({ localAppDataPath, isTestingBuild, fileSystem });
  const legacyNames = isTestingBuild
    ? ["Finledge Testing", "Finledge Testing EXE", "Finledge Testing AppX"]
    : ["Finledge", "FinLedge", "FinancialTracker", "Finledge AppX"];
  const candidates = [];
  for (const roamingRoot of roamingRoots) {
    for (const name of legacyNames) {
      const root = path.join(roamingRoot, name);
      candidates.push(root, path.join(root, "FinLedge Data"));
    }
  }
  return [...new Set(candidates.map(candidate => path.resolve(candidate)))];
}

function getAppxPackageIdentity(processExecPath, applicationId) {
  const appId = String(applicationId || "").trim();
  if (!appId) return null;

  const segments = String(processExecPath || "").split(/[\\/]/);
  for (const segment of segments) {
    const match = segment.match(/^(.+)_\d+\.\d+\.\d+\.\d+_(?:x86|x64|arm|arm64)_[^_]*_([a-z0-9]+)$/i);
    if (match) {
      const packageFamilyName = `${match[1]}_${match[2]}`;
      return { packageFamilyName, applicationUserModelId: `${packageFamilyName}!${appId}` };
    }
  }
  return null;
}

function isWithinPath(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function resolveAppxExternalPath({
  targetPath,
  packageFamilyName,
  userDataPath,
  appDataPath,
  localAppDataPath,
}) {
  if (!packageFamilyName || !targetPath || !appDataPath || !localAppDataPath) {
    return targetPath;
  }

  if (!isWithinPath(appDataPath, targetPath)) {
    return targetPath;
  }

  const fileRelativeToAppData = path.relative(path.resolve(appDataPath), path.resolve(targetPath));
  return path.join(
    localAppDataPath,
    "Packages",
    packageFamilyName,
    "LocalCache",
    "Roaming",
    fileRelativeToAppData,
  );
}

module.exports = {
  findAppxLegacyDirs,
  findAppxPackageRoamingRoot,
  getAppxPackageIdentity,
  isWithinPath,
  resolveAppxExternalPath,
};
