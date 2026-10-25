"use strict";

const fs = require("fs");
const path = require("path");
const { getAppxPackageIdentity, resolveAppxExternalPath } = require("./appxPaths");

const STATE_FILE = "desktop-shortcut-preference.json";

function getAppxApplicationUserModelId({ processExecPath, applicationId }) {
  return getAppxPackageIdentity(processExecPath, applicationId)?.applicationUserModelId || null;
}

function readState(statePath) {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}

function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { flag: "w" });
  fs.renameSync(temporaryPath, statePath);
}

function createShortcutDetails({
  processExecPath,
  applicationId,
  iconPath,
  userDataPath,
  appDataPath,
  localAppDataPath,
  displayName,
}) {
  const packageIdentity = getAppxPackageIdentity(processExecPath, applicationId);
  if (!packageIdentity) {
    throw new Error("Windows did not provide an AppX application identity.");
  }

  const cachedIconPath = path.join(userDataPath, "desktop-shortcut-icon.ico");
  if (iconPath && fs.existsSync(iconPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.copyFileSync(iconPath, cachedIconPath);
  }
  const shellIconPath = resolveAppxExternalPath({
    targetPath: cachedIconPath,
    packageFamilyName: packageIdentity.packageFamilyName,
    userDataPath,
    appDataPath,
    localAppDataPath,
  });

  return {
    target: path.join(process.env.WINDIR || "C:\\Windows", "explorer.exe"),
    args: `shell:AppsFolder\\${packageIdentity.applicationUserModelId}`,
    description: `Launch ${displayName}`,
    icon: fs.existsSync(shellIconPath) ? shellIconPath : processExecPath,
    iconIndex: 0,
    cwd: userDataPath,
  };
}

function createDesktopShortcutManager({ app, shell, requestChoice, applicationId, logLine }) {
  async function offerShortcut({ enabled, displayName, packageVersion, iconPath }) {
    if (!enabled || process.platform !== "win32") return { status: "not-applicable" };

    const desktopPath = app.getPath("desktop");
    const shortcutPath = path.join(desktopPath, `${displayName}.lnk`);
    const statePath = path.join(app.getPath("userData"), STATE_FILE);
    const state = readState(statePath);
    const shortcutExists = fs.existsSync(shortcutPath);
    let shortcutOptions;
    try {
      shortcutOptions = createShortcutDetails({
        processExecPath: process.execPath,
        applicationId,
        iconPath,
        userDataPath: app.getPath("userData"),
        appDataPath: app.getPath("appData"),
        localAppDataPath: path.resolve(app.getPath("appData"), "..", "Local"),
        displayName,
      });
    } catch (error) {
      logLine("[shortcut] AppX application identity unavailable", String(error?.stack || error));
      return { status: "unavailable", shortcutPath };
    }

    if (shortcutExists) {
      if (state.createdByFinLedge) {
        try {
          shell.writeShortcutLink(shortcutPath, "replace", shortcutOptions);
        } catch (error) {
          logLine("[shortcut] could not refresh existing AppX shortcut", String(error?.stack || error));
        }
      }
      if (state.handledPackageVersion !== packageVersion) {
        saveState(statePath, {
          handledPackageVersion: packageVersion,
          createdByFinLedge: Boolean(state.createdByFinLedge),
        });
      }
      return { status: "already-exists", shortcutPath };
    }

    if (state.handledPackageVersion === packageVersion) {
      return { status: "already-answered", shortcutPath };
    }

    const choice = await requestChoice?.({ displayName });
    if (choice === null || choice === undefined) {
      return { status: "prompt-unavailable", shortcutPath };
    }

    let created = false;
    let errorMessage = "";
    if (choice === true) {
      try {
        created = shell.writeShortcutLink(shortcutPath, "create", shortcutOptions);
        if (!created) errorMessage = "Windows could not create the desktop shortcut.";
      } catch (error) {
        errorMessage = String(error?.message || "Windows could not create the desktop shortcut.");
      }
    }

    if (!errorMessage) {
      saveState(statePath, {
        handledPackageVersion: packageVersion,
        createdByFinLedge: created || Boolean(state.createdByFinLedge),
      });
    }

    if (errorMessage) {
      logLine("[shortcut] AppX desktop shortcut creation failed", errorMessage);
      return { status: "failed", shortcutPath, error: errorMessage };
    }

    return { status: created ? "created" : "declined", shortcutPath };
  }

  return { offerShortcut };
}

module.exports = {
  STATE_FILE,
  createDesktopShortcutManager,
  createShortcutDetails,
  getAppxApplicationUserModelId,
};
