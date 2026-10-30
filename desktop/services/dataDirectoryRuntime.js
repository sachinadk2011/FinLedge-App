"use strict";

const fs = require("fs");
const path = require("path");
const { findAppxLegacyDirs, findAppxPackageRoamingRoot, isWithinPath } = require("./appxPaths");
const {
  acquireDataDirectoryLock,
  ensureWritableDirectory,
  expandDataDirectoryPath,
  getBuildType,
  persistDataDirectory,
  resolveDataDirectory,
} = require("./dataDirectory");
const {
  DATA_FOLDER_NAME,
  getBackupDirectoryForDataFolder,
  getSharedDataDirectory,
  hasKnownWorkbooks,
} = require("./dataFolderMigration");

function createDataDirectoryRuntime({
  app,
  projectRoot,
  isDevelopment,
  isTestingBuild,
  testBuildType,
  isStoreDistribution,
  isAppxPackage,
  appxPackageFamilyName,
  localAppDataPath,
  backendHost,
  backendPort,
  logLine,
}) {
  let runtimeDataDir = null;
  let activeBackendPort = backendPort;
  let dataDirError = "";
  let canChooseDataFolder = false;
  let dataDirectoryLock = null;
  let dataSetupStatus = "unknown";
  let legacyFallbackAllowed = false;

  function getBuildTypeLabel() {
    return getBuildType({
      isStoreBuild: Boolean(process.windowsStore),
      isPackaged: app.isPackaged,
      isDevelopment,
      isTestingBuild,
      isStoreDistribution,
    });
  }

  function getDocumentsPath() {
    const isolatedTestDocuments = isTestingBuild
      ? expandDataDirectoryPath(process.env.FINLEDGE_TEST_DOCUMENTS_DIR || "", { homeDir: app.getPath("home") })
      : "";
    return isolatedTestDocuments ? path.resolve(isolatedTestDocuments) : app.getPath("documents");
  }

  function getRoamingPath() {
    const home = app.getPath("home");
    if (process.platform === "win32" && home) return path.join(home, "AppData", "Roaming");
    return app.getPath("appData");
  }

  function getSharedStorageRoot() {
    if (isDevelopment) return path.join(projectRoot, ".finledge-dev-data");
    return path.join(getRoamingPath(), isTestingBuild ? "Finledge Testing EXE" : "Finledge");
  }

  function getSharedSyncDir() {
    const testOverride = isTestingBuild
      ? expandDataDirectoryPath(process.env.FINLEDGE_TEST_SHARED_SYNC_DIR || "", { homeDir: app.getPath("home") })
      : "";
    if (testOverride) return path.resolve(testOverride);
    return path.join(getSharedStorageRoot(), "FinLedge Data Shared");
  }

  function getOtherChannelProtectedRoots() {
    const localRoot = localAppDataPath || process.env.LOCALAPPDATA || path.resolve(app.getPath("appData"), "..", "Local");
    const packageRoots = findAppxPackageRoamingRoot({
      localAppDataPath: localRoot,
      isTestingBuild: !isTestingBuild,
    });
    const roamingNames = isTestingBuild
      ? ["Finledge", "Finledge EXE", "Finledge AppX", "FinancialTracker"]
      : ["Finledge Testing", "Finledge Testing EXE", "Finledge Testing AppX"];
    return [
      ...packageRoots,
      ...roamingNames.map((name) => path.join(getRoamingPath(), name)),
    ];
  }

  function restrictToBuildChannel(paths) {
    const protectedRoots = getOtherChannelProtectedRoots();
    return paths.filter((candidate) =>
      typeof candidate === "string"
      && !protectedRoots.some((root) => isWithinPath(root, path.resolve(candidate)))
    );
  }

  function getCleanupLegacyRoots() {
    if (!isTestingBuild || process.env.FINLEDGE_TEST_ISOLATED === "1") return [];
    const testOverride = String(process.env.FINLEDGE_TEST_CLEANUP_LEGACY_ROOTS || "").trim();
    if (testOverride) {
      let roots;
      try { roots = JSON.parse(testOverride); } catch { throw new Error("FINLEDGE_TEST_CLEANUP_LEGACY_ROOTS must be a JSON array of folder paths."); }
      if (!Array.isArray(roots) || roots.some(value => typeof value !== "string" || !value.trim())) {
        throw new Error("FINLEDGE_TEST_CLEANUP_LEGACY_ROOTS must be a JSON array of folder paths.");
      }
      return restrictToBuildChannel(roots.map(value =>
        path.resolve(expandDataDirectoryPath(value, { homeDir: app.getPath("home") }))
      ));
    }
    return restrictToBuildChannel([path.join(getRoamingPath(), "Finledge Testing EXE")]);
  }

  function getRuntimeDataDir() {
    if (runtimeDataDir) return runtimeDataDir;
    const configuredPath = expandDataDirectoryPath(process.env.FINLEDGE_DATA_DIR || "", { homeDir: app.getPath("home") });
    const explicitPath = configuredPath.toLowerCase() === "auto" ? "" : configuredPath;
    if (explicitPath) return path.resolve(explicitPath);
    if (isDevelopment) {
      return resolveDataDirectory({
        isDevelopment,
        projectRoot,
        documentsDir: getDocumentsPath(),
        userDataDir: app.getPath("userData"),
      });
    }
    const dataRoot = isAppxPackage
      ? app.getPath("userData")
      : getSharedStorageRoot();
    return getSharedDataDirectory(dataRoot);
  }

  function getRuntimeBackupDir() {
    return path.join(getSharedSyncDir(), "Backups");
  }

  function getSafetyCopyDir() {
    return path.join(getRuntimeBackupDir(), "safety-copy");
  }

  function ensureRuntimeSupportDirectories() {
    const targets = [
      ["safety-copy", getSafetyCopyDir()],
      ["backup", getRuntimeBackupDir()],
      // Python creates timestamped folders beneath this directory before its
      // first migration snapshot. Pre-create it in Electron so packaged builds
      // fail here with a clear recovery-folder error if the nested path is not writable.
      ["migration-backup", path.join(getRuntimeBackupDir(), "migration")],
    ];
    for (const [kind, target] of targets) {
      try {
        fs.mkdirSync(target, { recursive: true });
        fs.accessSync(target, fs.constants.R_OK | fs.constants.W_OK);
      } catch (error) {
        logLine(`[main] could not prepare ${kind} directory`, {
          path: target,
          error: String(error?.stack || error),
        });
        throw Object.assign(
          new Error("FinLedge could not prepare its shared recovery folders."),
          { code: "FINLEDGE_SHARED_STORAGE_UNAVAILABLE", cause: error },
        );
      }
    }
    return targets.map(([, target]) => target);
  }

  function usesManagedDataDirectory() {
    const configured = expandDataDirectoryPath(process.env.FINLEDGE_DATA_DIR || "", { homeDir: app.getPath("home") });
    if (configured && configured.toLowerCase() !== "auto") return false;
    if (isDevelopment || isTestingBuild) return true;
    return isDefaultRuntimeDataDir(getRuntimeDataDir());
  }

  function getBackendEnv() {
    const localRoot = localAppDataPath || process.env.LOCALAPPDATA || path.resolve(app.getPath("appData"), "..", "Local");
    const channelScopedSources = (serialized) => {
      if (isDevelopment) return serialized;
      try {
        const candidates = JSON.parse(serialized);
        if (!Array.isArray(candidates)) return serialized;
        return JSON.stringify(candidates.filter((candidate) =>
          typeof candidate === "string"
          && !getOtherChannelProtectedRoots().some((root) => isWithinPath(root, path.resolve(candidate)))
        ));
      } catch {
        return serialized;
      }
    };
    const configuredLegacyDataDirs = isTestingBuild
      ? ""
      : String(process.env.FINLEDGE_LEGACY_DATA_DIRS || "").trim();
    let legacyDataDirs;
    if (isTestingBuild && process.env.FINLEDGE_TEST_ISOLATED === "1") {
      legacyDataDirs = [];
    } else if (isTestingBuild && String(process.env.FINLEDGE_TEST_LEGACY_DATA_DIRS || "").trim()) {
      let testSources;
      try {
        testSources = JSON.parse(process.env.FINLEDGE_TEST_LEGACY_DATA_DIRS);
      } catch {
        throw new Error("FINLEDGE_TEST_LEGACY_DATA_DIRS must be a JSON array of folder paths.");
      }
      if (!Array.isArray(testSources) || testSources.some(value => typeof value !== "string" || !value.trim())) {
        throw new Error("FINLEDGE_TEST_LEGACY_DATA_DIRS must be a JSON array of folder paths.");
      }
      legacyDataDirs = JSON.parse(channelScopedSources(JSON.stringify(testSources.map(source => path.resolve(source)))));
    } else if (isTestingBuild) {
      const buildLegacyDirs = [
        path.join(getRoamingPath(), "Finledge Testing EXE"),
        path.join(getRoamingPath(), "Finledge Testing EXE", DATA_FOLDER_NAME),
        path.join(getRoamingPath(), "Finledge Testing AppX"),
        path.join(getRoamingPath(), "Finledge Testing AppX", DATA_FOLDER_NAME),
        path.join(localRoot, "Finledge Testing AppX Test"),
        ...findAppxLegacyDirs({ localAppDataPath: localRoot, isTestingBuild: true }),
      ];
      legacyDataDirs = JSON.parse(channelScopedSources(JSON.stringify([
        path.dirname(getRuntimeDataDir()),
        app.getPath("userData"),
        ...buildLegacyDirs,
      ])));
    } else {
      const previousRoamingRoot = path.join(getRoamingPath(), "financial-tracker-desktop");
      legacyDataDirs = isDevelopment
        ? [path.dirname(getRuntimeDataDir()), app.getPath("userData"), previousRoamingRoot]
        : [
            path.dirname(getRuntimeDataDir()),
            app.getPath("userData"),
            previousRoamingRoot,
            path.join(app.getPath("documents"), "FinLedge"),
            path.join(app.getPath("documents"), "FinLedge", "FinLedge Data"),
            path.join(getRoamingPath(), "Finledge"),
            path.join(getRoamingPath(), "Finledge", DATA_FOLDER_NAME),
            path.join(getRoamingPath(), "Finledge AppX"),
            path.join(getRoamingPath(), "Finledge AppX", DATA_FOLDER_NAME),
            path.join(getRoamingPath(), "FinancialTracker"),
            ...findAppxLegacyDirs({
              localAppDataPath: process.env.LOCALAPPDATA || path.resolve(app.getPath("appData"), "..", "Local"),
            }),
          ];
    }

    const serializedLegacyDataDirs = configuredLegacyDataDirs || JSON.stringify([...new Set(legacyDataDirs)]);
    return {
      ...process.env,
      FINLEDGE_MODE: isTestingBuild
        ? "testing"
        : String(process.env.FINLEDGE_MODE || (isDevelopment ? "development" : "production"))
        .trim()
        .toLowerCase(),
      FINLEDGE_PROJECT_ROOT: projectRoot,
      FINLEDGE_BACKEND_HOST: backendHost,
      FINLEDGE_BACKEND_PORT: String(activeBackendPort),
      FINLEDGE_PARENT_PID: String(process.pid),
      FINLEDGE_DATA_DIR: getRuntimeDataDir(),
      FINLEDGE_SHARED_SYNC_DIR: getSharedSyncDir(),
      FINLEDGE_CHANNEL_DATA_ROOT: getSharedStorageRoot(),
      FINLEDGE_CLEANUP_LEGACY_ROOTS: JSON.stringify(isTestingBuild
        ? getCleanupLegacyRoots()
        : (isDevelopment ? [] : [path.join(getRoamingPath(), "Finledge")])),
      FINLEDGE_DATA_DIR_IS_MANAGED: usesManagedDataDirectory() ? "1" : "0",
      FINLEDGE_BACKUP_DIR: getRuntimeBackupDir(),
      FINLEDGE_SAFETY_COPY_DIR: getSafetyCopyDir(),
      FINLEDGE_LEGACY_DATA_DIRS:
        channelScopedSources(serializedLegacyDataDirs),
    };
  }

  function getLegacyFallbackDataDir() {
    // If preparation failed, do not silently serve a second workbook copy.
    // Settings and every dashboard must continue to refer to the same shared folder.
    return hasKnownWorkbooks(getRuntimeDataDir()) ? getRuntimeDataDir() : null;
  }

  function isDefaultRuntimeDataDir(dataDir) {
    const configuredPath = expandDataDirectoryPath(process.env.FINLEDGE_DATA_DIR || "", { homeDir: app.getPath("home") });
    if (isTestingBuild || (configuredPath && configuredPath.toLowerCase() !== "auto")) return false;
    const defaultRoot = isAppxPackage ? app.getPath("userData") : getSharedStorageRoot();
    const defaultDataDir = path.resolve(path.join(defaultRoot, DATA_FOLDER_NAME));
    return path.resolve(dataDir) === defaultDataDir;
  }

  function initializeDataDirectory(dataDir, { allowLegacyFallback = false } = {}) {
    legacyFallbackAllowed = allowLegacyFallback;
    ensureRuntimeSupportDirectories();
    try {
      runtimeDataDir = ensureWritableDirectory(dataDir);
      canChooseDataFolder = false;
    } catch (error) {
      canChooseDataFolder = true;
      throw error;
    }
    const lock = acquireDataDirectoryLock(runtimeDataDir, { buildType: getBuildTypeLabel() });
    if (!lock.acquired) {
      const ownerType = lock.owner?.buildType;
      const message = ownerType && ownerType !== getBuildTypeLabel()
        ? "FinLedge is already open in the other version."
        : "FinLedge is already open. Close the other window and try again.";
      throw Object.assign(new Error(message), { code: "FINLEDGE_ALREADY_RUNNING" });
    }
    dataDirectoryLock = lock;
    dataSetupStatus = "preparing";
    dataDirError = "";
    canChooseDataFolder = false;
  }

  function switchToLegacyFallback(error) {
    if (!legacyFallbackAllowed || !isDefaultRuntimeDataDir(runtimeDataDir)) return false;
    const fallbackDir = getLegacyFallbackDataDir();
    if (!fallbackDir || path.resolve(fallbackDir) === path.resolve(runtimeDataDir)) return false;

    dataDirectoryLock?.release();
    dataDirectoryLock = null;
    runtimeDataDir = ensureWritableDirectory(fallbackDir);
    const fallbackLock = acquireDataDirectoryLock(runtimeDataDir, { buildType: getBuildTypeLabel() });
    if (!fallbackLock.acquired) {
      runtimeDataDir = null;
      const ownerType = fallbackLock.owner?.buildType;
      const message = ownerType && ownerType !== getBuildTypeLabel()
        ? "FinLedge is already open in the other version."
        : "FinLedge is already open. Close the other window and try again.";
      throw Object.assign(new Error(message), { code: "FINLEDGE_ALREADY_RUNNING" });
    }
    dataDirectoryLock = fallbackLock;
    dataSetupStatus = "legacy_fallback";
    dataDirError = "";
    logLine("[main] migration failed; using previous data folder", {
      dataDir: runtimeDataDir,
      error: String(error && error.stack ? error.stack : error),
    });
    return true;
  }

  function releaseLock() {
    dataDirectoryLock?.release();
    dataDirectoryLock = null;
  }

  return {
    setBackendPort: (port) => { activeBackendPort = Number(port); },
    getBuildTypeLabel,
    getRuntimeDataDir,
    getSharedStorageRoot,
    getSharedSyncDir,
    getBackupDirectory: getRuntimeBackupDir,
    ensureRuntimeSupportDirectories,
    getBackendEnv,
    initializeDataDirectory,
    switchToLegacyFallback,
    setDataSetupStatus: (value) => { dataSetupStatus = String(value || "unknown"); },
    releaseLock,
    getDataDirError: () => dataDirError,
    getCanChooseDataFolder: () => canChooseDataFolder,
    setDataDirError: (value, options = {}) => {
      dataDirError = value;
      canChooseDataFolder = Boolean(value) && Boolean(options.canChooseDataFolder);
    },
    getDataSetupStatus: () => dataSetupStatus,
    resetRuntimeDataDir: () => { runtimeDataDir = null; },
    persistDataDirectory: (dataDir) => persistDataDirectory(dataDir, {
      documentsDir: getDocumentsPath(),
      userDataDir: app.getPath("userData"),
    }),
  };
}

module.exports = { createDataDirectoryRuntime };
