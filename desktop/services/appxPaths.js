"use strict";

const path = require("path");

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
  if (!packageFamilyName || !targetPath || !userDataPath || !appDataPath || !localAppDataPath) {
    return targetPath;
  }

  if (!isWithinPath(userDataPath, targetPath) || !isWithinPath(appDataPath, userDataPath)) {
    return targetPath;
  }

  const userDataRelativeToAppData = path.relative(path.resolve(appDataPath), path.resolve(userDataPath));
  const fileRelativeToUserData = path.relative(path.resolve(userDataPath), path.resolve(targetPath));
  return path.join(
    localAppDataPath,
    "Packages",
    packageFamilyName,
    "LocalCache",
    "Roaming",
    userDataRelativeToAppData,
    fileRelativeToUserData,
  );
}

module.exports = { getAppxPackageIdentity, isWithinPath, resolveAppxExternalPath };
