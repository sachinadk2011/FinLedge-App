"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  acquireDataDirectoryLock,
  ensureWritableDirectory,
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
  backendHost,
  backendPort,
  getPythonExecutable,
  logLine,
}) {
  let runtimeDataDir = null;
  let dataDirError = "";
  let canChooseDataFolder = false;
  let dataDirectoryLock = null;
  let dataSetupStatus = "unknown";

  function getBuildTypeLabel() {
    return getBuildType({
      isStoreBuild: Boolean(process.windowsStore),
      isPackaged: app.isPackaged,
      isDevelopment,
      isTestingBuild,
      isStoreDistribution,
    });
  }

  function getRuntimeDataDir() {
    if (runtimeDataDir) return runtimeDataDir;
    const explicitPath = String(process.env.FINLEDGE_DATA_DIR || "").trim();
    const resolved = isTestingBuild
      ? path.resolve(app.getPath("userData"))
      : resolveDataDirectory({
          explicitPath: process.env.FINLEDGE_DATA_DIR,
          isDevelopment,
          projectRoot,
          documentsDir: app.getPath("documents"),
          userDataDir: app.getPath("userData"),
        });
    const defaultRoot = (isTestingBuild || isDevelopment)
      ? path.resolve(app.getPath("userData"))
      : path.resolve(app.getPath("documents"), "FinLedge");
    if (!explicitPath && path.resolve(resolved) === defaultRoot) {
      return getSharedDataDirectory(defaultRoot);
    }
    return resolved;
  }

  function getBackendEnv() {
    const configuredLegacyDataDirs = isTestingBuild
      ? ""
      : String(process.env.FINLEDGE_LEGACY_DATA_DIRS || "").trim();
    let legacyDataDirs;
    if (isTestingBuild) {
      legacyDataDirs = [
        path.dirname(getRuntimeDataDir()),
        app.getPath("userData"),
        ...(testBuildType === "appx"
          ? [path.resolve(app.getPath("appData"), "..", "Local", "Finledge Testing AppX Test")]
          : []),
      ];
    } else {
      legacyDataDirs = isDevelopment
        ? [path.dirname(getRuntimeDataDir()), path.join(projectRoot, ".finledge-dev-data")]
        : [
            path.dirname(getRuntimeDataDir()),
            app.getPath("userData"),
            path.join(app.getPath("appData"), "Finledge"),
            path.join(app.getPath("appData"), "FinancialTracker"),
            path.join(path.dirname(projectRoot), "FinancialTrackerData"),
          ];
    }

    return {
      ...process.env,
      FINLEDGE_MODE: isTestingBuild
        ? "testing"
        : String(process.env.FINLEDGE_MODE || (isDevelopment ? "development" : "production"))
        .trim()
        .toLowerCase(),
      FINLEDGE_PROJECT_ROOT: projectRoot,
      FINLEDGE_BACKEND_HOST: backendHost,
      FINLEDGE_BACKEND_PORT: String(backendPort),
      FINLEDGE_DATA_DIR: getRuntimeDataDir(),
      FINLEDGE_BACKUP_DIR: getBackupDirectoryForDataFolder(getRuntimeDataDir()),
      FINLEDGE_LEGACY_DATA_DIRS:
        configuredLegacyDataDirs || JSON.stringify([...new Set(legacyDataDirs)]),
    };
  }

  function prepareDataDirectory(dataDir) {
    const env = { ...getBackendEnv(), FINLEDGE_DATA_DIR: dataDir };
    const packaged = app.isPackaged && !isDevelopment;
    const command = packaged
      ? path.join(process.resourcesPath, "engine", "finledge-engine.exe")
      : getPythonExecutable();
    const args = packaged
      ? ["--prepare-data"]
      : ["-m", "backend.engine_main", "--prepare-data"];
    const cwd = packaged ? path.dirname(command) : projectRoot;
    const result = spawnSync(command, args, {
      cwd,
      env,
      windowsHide: true,
      encoding: "utf8",
      timeout: 30_000,
    });

    if (result.error || result.status !== 0) {
      const details = String(result.stderr || result.error?.message || "Data folder preparation failed").trim();
      throw new Error(details.split(/\r?\n/).slice(-1)[0] || "Data folder preparation failed");
    }

    const output = String(result.stdout || "").trim().split(/\r?\n/).filter(Boolean);
    if (!output.length) return null;
    try {
      return JSON.parse(output[output.length - 1]);
    } catch {
      throw new Error("FinLedge could not read the data migration report.");
    }
  }

  function getLegacyFallbackDataDir() {
    const candidates = isDevelopment
      ? [path.join(projectRoot, ".finledge-dev-data"), app.getPath("userData")]
      : [
          path.join(app.getPath("documents"), "FinLedge"),
          path.join(app.getPath("appData"), "Finledge"),
          app.getPath("userData"),
        ];
    return candidates.find(candidate => hasKnownWorkbooks(candidate)) || null;
  }

  function isDefaultRuntimeDataDir(dataDir) {
    if (isTestingBuild || String(process.env.FINLEDGE_DATA_DIR || "").trim()) return false;
    const defaultDataDir = path.resolve(isDevelopment
      ? app.getPath("userData")
      : path.join(app.getPath("documents"), "FinLedge"));
    return [defaultDataDir, path.join(defaultDataDir, DATA_FOLDER_NAME)]
      .some(candidate => path.resolve(dataDir) === path.resolve(candidate));
  }

  function initializeDataDirectory(dataDir, { allowLegacyFallback = false } = {}) {
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

    try {
      const migration = prepareDataDirectory(runtimeDataDir);
      dataSetupStatus = migration?.status || "unknown";
      dataDirError = "";
      canChooseDataFolder = false;
    } catch (error) {
      dataDirectoryLock.release();
      dataDirectoryLock = null;
      canChooseDataFolder = false;
      const fallbackDir = getLegacyFallbackDataDir();
      if (!allowLegacyFallback || !isDefaultRuntimeDataDir(dataDir) || !fallbackDir) {
        throw error;
      }

      try {
        runtimeDataDir = ensureWritableDirectory(fallbackDir);
      } catch (fallbackError) {
        canChooseDataFolder = true;
        throw fallbackError;
      }
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
    }
  }

  function releaseLock() {
    dataDirectoryLock?.release();
    dataDirectoryLock = null;
  }

  return {
    getBuildTypeLabel,
    getRuntimeDataDir,
    getBackupDirectory: () => getBackupDirectoryForDataFolder(getRuntimeDataDir()),
    getBackendEnv,
    initializeDataDirectory,
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
      documentsDir: app.getPath("documents"),
      userDataDir: app.getPath("userData"),
    }),
  };
}

module.exports = { createDataDirectoryRuntime };
