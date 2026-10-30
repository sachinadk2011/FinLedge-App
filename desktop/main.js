"use strict";

const { app, BrowserWindow, Menu, ipcMain, screen, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { getAppxPackageIdentity } = require("./services/appxPaths");
const { acquireClientInstanceLock } = require("./services/clientInstanceLock");
const { createRendererPromptManager } = require("./services/rendererPromptManager");
const { createTestUpdatePolicy } = require("./services/testUpdatePolicy");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ICON_PATH = path.join(__dirname, "assets", "finledge_icon.png");
const WINDOW_ICON_PATH = path.join(__dirname, "assets", "finledge_icon.ico");
const BACKEND_READY_TIMEOUT_MS = 60_000;
const { LOG_FILE, logLine } = require("./services/logger");
const startupStartedAt = Date.now();
function logStartupPhase(phase, details = {}) {
  logLine("[startup]", { phase, elapsedMs: Date.now() - startupStartedAt, ...details });
}
const { loadRuntimeConfig } = require("./services/runtimeConfig");
const { findAvailablePort } = require("./services/runtimeConfig");
const runtimeConfig = loadRuntimeConfig({
  app,
  projectRoot: PROJECT_ROOT,
  resourcesPath: process.resourcesPath,
  isStoreBuild: Boolean(process.windowsStore),
  logLine,
});
const {
  isDevelopment: IS_ELECTRON_DEV,
  isTestingBuild: IS_TESTING_BUILD,
  testBuildType: TEST_BUILD_TYPE,
  isStoreDistribution: IS_STORE_DISTRIBUTION,
  backendHost: BACKEND_HOST,
  frontendHost: FRONTEND_HOST,
  updatePolicyUrl: UPDATE_POLICY_URL,
  testUpdatePolicyDirectory: TEST_UPDATE_POLICY_DIRECTORY,
  simulateUpdateValue: SIMULATE_UPDATE_VALUE,
  releasesUrl: RELEASES_URL,
} = runtimeConfig;
let BACKEND_PORT = runtimeConfig.backendPort;
let FRONTEND_PORT = runtimeConfig.frontendPort;
// Make the selected build-specific endpoint visible to the preload process too.
process.env.FINLEDGE_BACKEND_PORT = String(BACKEND_PORT);
process.env.FINLEDGE_FRONTEND_PORT = String(FRONTEND_PORT);
process.env.FINLEDGE_TESTING_BUILD = IS_TESTING_BUILD ? "1" : "0";
const APPX_APPLICATION_ID = runtimeConfig.appxApplicationId || (IS_TESTING_BUILD ? "FinledgeTesting" : "Finledge");
const APPLICATION_NAME = IS_TESTING_BUILD
  ? `Finledge Testing ${TEST_BUILD_TYPE === "appx" ? "AppX" : "EXE"}`
  : IS_ELECTRON_DEV
    ? "Finledge Development"
    : "Finledge";
app.setName(APPLICATION_NAME);
const IS_STORE_PACKAGE = Boolean(process.windowsStore && IS_STORE_DISTRIBUTION && !IS_TESTING_BUILD);
const IS_APPX_PACKAGE = Boolean(process.windowsStore && app.isPackaged);
const APPX_PACKAGE_IDENTITY = IS_APPX_PACKAGE
  ? getAppxPackageIdentity(process.execPath, APPX_APPLICATION_ID)
  : null;
const APP_USER_MODEL_ID = IS_APPX_PACKAGE
  ? APPX_PACKAGE_IDENTITY?.applicationUserModelId
  : IS_TESTING_BUILD ? "com.finledge.tracker.testing" : "com.finledge.tracker";
// Keep Windows shell identity specific to this client before app readiness.
if (APP_USER_MODEL_ID && process.platform === "win32") app.setAppUserModelId(APP_USER_MODEL_ID);
const clientInstanceLock = acquireClientInstanceLock({
  directory: app.getPath("userData"),
  pid: process.pid,
});
const HAS_SINGLE_INSTANCE_LOCK = clientInstanceLock.acquired;
if (!HAS_SINGLE_INSTANCE_LOCK) {
  logLine("[main] this FinLedge client is already starting or running", {
    userData: app.getPath("userData"),
  });
}
const testUpdatePolicy = createTestUpdatePolicy({
  app,
  isTestingBuild: IS_TESTING_BUILD,
  preferredDirectory: TEST_UPDATE_POLICY_DIRECTORY,
});
process.env.FINLEDGE_STORE_DISTRIBUTION = IS_STORE_PACKAGE ? "1" : "0";
process.env.FINLEDGE_DEVICE_ID = IS_TESTING_BUILD
  ? "desktop-test"
  : IS_ELECTRON_DEV
    ? "desktop-dev"
    : IS_APPX_PACKAGE
      ? "desktop-appx"
      : "desktop-exe";
const APPX_PACKAGE_VERSION = runtimeConfig.appxBuildNumber
  ? `${app.getVersion()}.${runtimeConfig.appxBuildNumber}`
  : app.getVersion();
const SHOULD_SIMULATE_UPDATES = ["1", "available", "required"].includes(SIMULATE_UPDATE_VALUE);
const SIMULATE_REQUIRED_UPDATE = SIMULATE_UPDATE_VALUE === "required";
const { createDataDirectoryRuntime } = require("./services/dataDirectoryRuntime");
const { createChildProcessManager } = require("./services/childProcessManager");
const { createIconAssets } = require("./services/iconAssets");
const { createWindowManager } = require("./services/windowManager");
const { createUpdatePolicyService } = require("./services/updatePolicyService");
const { createDesktopShortcutManager } = require("./services/desktopShortcutManager");
const { registerDataHandlers } = require("./ipc/dataHandlers");
const { registerUpdateHandlers } = require("./ipc/updateHandlers");
const { compareVersions, normalizeReleaseNotes } = require("./utils/updateMetadata");

process.on("uncaughtException", (err) => {
  logLine("[main] uncaughtException:", String(err && err.stack ? err.stack : err));
});

process.on("unhandledRejection", (reason) => {
  logLine("[main] unhandledRejection:", String(reason && reason.stack ? reason.stack : reason));
});

logLine("[main] Finledge Electron starting...", { logFile: LOG_FILE });
logStartupPhase("launch");

const dataRuntime = createDataDirectoryRuntime({
  app,
  projectRoot: PROJECT_ROOT,
  isDevelopment: IS_ELECTRON_DEV,
  isTestingBuild: IS_TESTING_BUILD,
  testBuildType: TEST_BUILD_TYPE,
  isStoreDistribution: IS_STORE_DISTRIBUTION,
  isAppxPackage: IS_APPX_PACKAGE,
  appxPackageFamilyName: APPX_PACKAGE_IDENTITY?.packageFamilyName,
  localAppDataPath: process.env.LOCALAPPDATA || path.resolve(app.getPath("appData"), "..", "Local"),
  backendHost: BACKEND_HOST,
  backendPort: BACKEND_PORT,
  logLine,
});
const processManager = createChildProcessManager({
  app,
  projectRoot: PROJECT_ROOT,
  backendHost: BACKEND_HOST,
  backendPort: BACKEND_PORT,
  frontendHost: FRONTEND_HOST,
  frontendPort: FRONTEND_PORT,
  isDevelopment: IS_ELECTRON_DEV,
  getBackendEnv: dataRuntime.getBackendEnv,
  getPythonExecutable: () => runtimeConfig.pythonExecutable,
  logLine,
});
const iconAssets = createIconAssets(ICON_PATH, logLine);
const windowManager = createWindowManager({
  BrowserWindow,
  screen,
  app,
  projectRoot: PROJECT_ROOT,
  preloadPath: path.join(__dirname, "preload.js"),
  iconPath: ICON_PATH,
  windowIconPath: WINDOW_ICON_PATH,
  applicationName: APPLICATION_NAME,
  logLine,
  onFrontendReady: () => {
    const dataDirError = dataRuntime.getDataDirError();
    logLine("[shortcut] renderer ready", {
      isAppxPackage: IS_APPX_PACKAGE,
      packaged: app.isPackaged,
      windowsStore: Boolean(process.windowsStore),
      applicationId: APPX_APPLICATION_ID,
      packageVersion: APPX_PACKAGE_VERSION,
      dataDirAvailable: !dataDirError,
    });
    if (!IS_APPX_PACKAGE || dataDirError) return;
    waitForBackendReady(BACKEND_READY_TIMEOUT_MS)
      .then(() => desktopShortcutManager.offerShortcut({
          enabled: true,
          displayName: APPLICATION_NAME,
          packageVersion: APPX_PACKAGE_VERSION,
          iconPath: WINDOW_ICON_PATH,
        }))
      .then((result) => logLine("[shortcut] first-run offer result", result))
      .catch((error) => logLine("[shortcut] AppX first-run prompt skipped", String(error?.stack || error)));
  },
});
app.on("will-quit", () => clientInstanceLock.release());
const rendererPromptManager = createRendererPromptManager({
  ipcMain,
  getMainWindow: windowManager.getMainWindow,
  logLine,
});
const desktopShortcutManager = createDesktopShortcutManager({
  app,
  shell,
  requestChoice: rendererPromptManager.requestShortcutChoice,
  applicationId: APPX_APPLICATION_ID,
  logLine,
});
const updateService = createUpdatePolicyService({
  app,
  http: require("http"),
  https: require("https"),
  updatePolicyUrl: UPDATE_POLICY_URL,
  localPolicyPath: testUpdatePolicy?.policyPath,
  releasesUrl: RELEASES_URL,
  compareVersions,
  normalizeReleaseNotes,
  getMainWindow: windowManager.getMainWindow,
  logLine,
});
const {
  getRuntimeDataDir,
  initializeDataDirectory,
  setBackendPort: setRuntimeBackendPort,
} = dataRuntime;
const {
  startBackend,
  stopBackend,
  startFrontendDevServer,
  stopFrontendDevServer,
  waitForBackendReady,
  waitForAnyLocalPortOk,
  getFrontendUrl,
  getDevFrontendUrl,
  setDevFrontendUrl,
  setBackendPort: setProcessBackendPort,
  setFrontendPort: setProcessFrontendPort,
} = processManager;
const {
  createWindow,
  navigateToFrontend,
  notifyBackendReady,
  getMainWindow,
} = windowManager;
const {
  checkUpdatePolicy,
  checkStoreUpdatePolicy,
  simulateUpdateAvailable,
  simulateRequiredUpdate,
} = updateService;
registerDataHandlers({
  ipcMain,
  app,
  dialog,
  shell,
  dataRuntime,
  processManager,
  getMainWindow,
  logLine,
  isAppxPackage: IS_APPX_PACKAGE,
  appxPackageFamilyName: APPX_PACKAGE_IDENTITY?.packageFamilyName,
  localAppDataPath: process.env.LOCALAPPDATA || path.resolve(app.getPath("appData"), "..", "Local"),
});
ipcMain.handle("app:get-backend-port", () => String(BACKEND_PORT));
let firstPaintLogged = false;
ipcMain.on("app:startup-first-paint", () => {
  if (firstPaintLogged) return;
  firstPaintLogged = true;
  logStartupPhase("first paint");
});
registerUpdateHandlers({
  ipcMain,
  app,
  shell,
  getMainWindow,
  updateService,
  releasesUrl: RELEASES_URL,
  isDevelopment: IS_ELECTRON_DEV || IS_TESTING_BUILD || IS_STORE_PACKAGE,
  isTestingBuild: IS_TESTING_BUILD,
  testUpdatePolicyDirectory: testUpdatePolicy?.directory,
  updatesManagedByPackage: IS_APPX_PACKAGE && !IS_TESTING_BUILD,
  isStorePackage: IS_STORE_PACKAGE,
  simulateUpdates: SHOULD_SIMULATE_UPDATES,
  simulateRequiredUpdate: SIMULATE_REQUIRED_UPDATE,
  logLine,
});
Menu.setApplicationMenu(null);

let startupUpdateTimer = null;
let periodicUpdateTimer = null;

async function startDevelopmentFrontend(hasBuiltFrontend) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    FRONTEND_PORT = await findAvailablePort(FRONTEND_HOST);
    process.env.FINLEDGE_FRONTEND_PORT = String(FRONTEND_PORT);
    setProcessFrontendPort(FRONTEND_PORT);
    startFrontendDevServer();
    try {
      const url = await waitForAnyLocalPortOk([FRONTEND_PORT], 8_000);
      setDevFrontendUrl(url);
      logLine("[main] owned Vite server ready", url);
      navigateToFrontend(url);
      return true;
    } catch (error) {
      logLine("[main] retrying unavailable Vite port", String(error?.message || error));
      await stopFrontendDevServer();
    }
  }
  if (hasBuiltFrontend) {
    navigateToFrontend(getFrontendUrl());
    return true;
  }
  return false;
}

app.whenReady().then(async () => {
  if (!HAS_SINGLE_INSTANCE_LOCK) {
    app.quit();
    return;
  }
  try {
    iconAssets.ensureIconExists();
    logLine("[main] whenReady()");
    logLine("[main] mode", process.env.FINLEDGE_MODE);
    logLine("[main] backendPort", BACKEND_PORT);
    logLine("[main] frontendPort", FRONTEND_PORT);
    logLine("[main] icon", { iconPath: ICON_PATH, iconExists: fs.existsSync(ICON_PATH) });
    logLine("[main] userData", app.getPath("userData"));
    logLine("[main] dataDir", getRuntimeDataDir());
    // Show a splash immediately so the user can see a single startup in progress.
    createWindow();

    try {
      initializeDataDirectory(getRuntimeDataDir(), { allowLegacyFallback: true });
    } catch (error) {
      if (error.code === "FINLEDGE_ALREADY_RUNNING") {
        await dialog.showMessageBox({ type: "info", message: error.message });
        app.quit();
        return;
      }
      if (error.code === "FINLEDGE_SHARED_STORAGE_UNAVAILABLE") {
        logLine("[main] shared recovery storage is unavailable", String(error?.stack || error));
        await dialog.showMessageBox({
          type: "error",
          title: "FinLedge could not access its shared folder",
          message: "FinLedge could not create its shared recovery folders.",
          detail: "FinLedge needs write access to its shared folder to keep recovery copies. Check that the shared folder is available and writable, then reopen FinLedge.",
          buttons: ["Close"],
          noLink: true,
        });
        app.quit();
        return;
      }
      const canChooseDataFolder = dataRuntime.getCanChooseDataFolder();
      const userMessage = canChooseDataFolder
        ? "FinLedge cannot access this data folder."
        : "FinLedge could not prepare your existing data. Your records were left untouched. Restart FinLedge to try again.";
      dataRuntime.setDataDirError(userMessage, { canChooseDataFolder });
      logLine("[main] data folder unavailable", String(error && error.stack ? error.stack : error));
      await dialog.showMessageBox({
        type: "error",
        title: "FinLedge could not prepare its data folder",
        message: canChooseDataFolder ? "FinLedge could not access its data folder." : "FinLedge could not finish preparing your existing data.",
        detail: canChooseDataFolder
          ? "Your existing records were left untouched. Choose a writable folder in Settings → General, then try again."
          : "Your existing records were left untouched. Restart FinLedge to try again.",
        buttons: ["Continue"],
        noLink: true,
      });
    }

    const hasBuiltFrontend = fs.existsSync(processManager.getFrontendIndexPath());
    logLine("[main] frontend built?", hasBuiltFrontend);

    if (!dataRuntime.getDataDirError()) {
      BACKEND_PORT = await findAvailablePort(BACKEND_HOST);
      process.env.FINLEDGE_BACKEND_PORT = String(BACKEND_PORT);
      setRuntimeBackendPort(BACKEND_PORT);
      setProcessBackendPort(BACKEND_PORT);
      logLine("[main] selected private backend port", BACKEND_PORT);
    }

    // Load the renderer while the single backend process prepares the workbooks.
    const frontendStartupPromise = IS_ELECTRON_DEV
      ? startDevelopmentFrontend(hasBuiltFrontend)
      : Promise.resolve(navigateToFrontend(getFrontendUrl()));

    if (!dataRuntime.getDataDirError()) {
      let backendReady = false;
      let lastBackendError = null;
      let usingLegacyFallback = false;
      for (let attempt = 0; attempt < 3 && !backendReady; attempt += 1) {
        if (attempt > 0) {
          BACKEND_PORT = await findAvailablePort(BACKEND_HOST);
          process.env.FINLEDGE_BACKEND_PORT = String(BACKEND_PORT);
          setRuntimeBackendPort(BACKEND_PORT);
          setProcessBackendPort(BACKEND_PORT);
          getMainWindow()?.webContents.send("app:backend-port-changed", String(BACKEND_PORT));
          logLine("[main] selected private backend port", BACKEND_PORT);
        }
        logStartupPhase("backend spawn", { attempt: attempt + 1 });
        startBackend();
        try {
          await waitForBackendReady(BACKEND_READY_TIMEOUT_MS);
          backendReady = true;
          if (dataRuntime.getDataSetupStatus() !== "legacy_fallback") dataRuntime.setDataSetupStatus("ready");
          logStartupPhase("health ok", { attempt: attempt + 1 });
          notifyBackendReady();
          logLine("[main] backend ready and owned by this FinLedge process");
        } catch (error) {
          lastBackendError = error;
          logLine("[main] retrying unavailable backend port", String(error?.message || error));
          await stopBackend();
          if (error.code === "FINLEDGE_DATA_PREP_FAILED" && !usingLegacyFallback) {
            usingLegacyFallback = dataRuntime.switchToLegacyFallback(error);
            if (usingLegacyFallback) continue;
            break;
          }
        }
      }
      if (!backendReady) {
        logLine("[main] could not start an owned backend", String(lastBackendError?.stack || lastBackendError));
        await dialog.showMessageBox({
          type: "error",
          title: "FinLedge could not start",
          message: lastBackendError?.code === "FINLEDGE_DATA_PREP_FAILED"
            ? "FinLedge could not prepare its data folders."
            : "FinLedge could not start its data service.",
          detail: lastBackendError?.code === "FINLEDGE_DATA_PREP_FAILED"
            ? "Your original workbook files were left in place. Check that the shared folder is available, then reopen FinLedge. See the FinLedge startup log in your temporary files folder for details."
            : "FinLedge did not start its own data service. See the FinLedge startup log in your temporary files folder for details.",
          buttons: ["Close"],
          noLink: true,
        });
        app.quit();
        return;
      }
    }

    if (IS_ELECTRON_DEV) {
      const frontendReady = await frontendStartupPromise;
      if (!frontendReady) throw new Error("FinLedge could not start its development interface.");

      if (SHOULD_SIMULATE_UPDATES) {
        startupUpdateTimer = setTimeout(
          SIMULATE_REQUIRED_UPDATE ? simulateRequiredUpdate : simulateUpdateAvailable,
          2500
        );
      }
    } else {
      if (IS_STORE_PACKAGE) {
        startupUpdateTimer = setTimeout(() => checkStoreUpdatePolicy({ silent: true }), 5000);
        periodicUpdateTimer = setInterval(() => checkStoreUpdatePolicy({ silent: true }), 6 * 60 * 60 * 1000);
      } else if (IS_TESTING_BUILD || !IS_APPX_PACKAGE) {
        startupUpdateTimer = setTimeout(() => {
          if (SHOULD_SIMULATE_UPDATES) {
            simulateUpdateAvailable();
            return;
          }

          checkUpdatePolicy({ silent: true });
        }, 5000);
        periodicUpdateTimer = setInterval(() => checkUpdatePolicy({ silent: true }), 6 * 60 * 60 * 1000);
      }
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (err) {
    logLine("[main] fatal during startup", String(err && err.stack ? err.stack : err));
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

let shutdownStarted = false;
app.on("before-quit", (event) => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  event.preventDefault();
  if (startupUpdateTimer) clearTimeout(startupUpdateTimer);
  if (periodicUpdateTimer) clearInterval(periodicUpdateTimer);
  Promise.allSettled([stopFrontendDevServer(), stopBackend()]).finally(() => {
    dataRuntime.releaseLock();
    app.quit();
  });
});

app.on("will-quit", () => dataRuntime.releaseLock());
