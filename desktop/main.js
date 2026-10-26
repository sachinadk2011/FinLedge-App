"use strict";

const { app, BrowserWindow, Menu, ipcMain, screen, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { getAppxPackageIdentity } = require("./services/appxPaths");
const { createRendererPromptManager } = require("./services/rendererPromptManager");
const { createTestUpdatePolicy } = require("./services/testUpdatePolicy");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ICON_PATH = path.join(__dirname, "assets", "finledge_icon.png");
const WINDOW_ICON_PATH = path.join(__dirname, "assets", "finledge_icon.ico");
const GITHUB_RELEASES_URL = "https://github.com/sachinadk2011/FinLedge-App/releases";
const BACKEND_READY_TIMEOUT_MS = 60_000;
const { LOG_FILE, logLine } = require("./services/logger");
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
const HAS_SINGLE_INSTANCE_LOCK = app.requestSingleInstanceLock();
if (!HAS_SINGLE_INSTANCE_LOCK) {
  logLine("[main] another FinLedge instance is already starting or running");
}
const testUpdatePolicy = createTestUpdatePolicy({
  app,
  isTestingBuild: IS_TESTING_BUILD,
  preferredDirectory: TEST_UPDATE_POLICY_DIRECTORY,
});
const IS_STORE_PACKAGE = Boolean(process.windowsStore && IS_STORE_DISTRIBUTION && !IS_TESTING_BUILD);
process.env.FINLEDGE_STORE_DISTRIBUTION = IS_STORE_PACKAGE ? "1" : "0";
const IS_APPX_PACKAGE = Boolean(process.windowsStore && app.isPackaged);
const APPX_PACKAGE_IDENTITY = IS_APPX_PACKAGE
  ? getAppxPackageIdentity(process.execPath, APPX_APPLICATION_ID)
  : null;
const APP_USER_MODEL_ID = IS_APPX_PACKAGE
  ? APPX_PACKAGE_IDENTITY?.applicationUserModelId
  : IS_TESTING_BUILD ? "com.finledge.tracker.testing" : "com.finledge.tracker";
if (APP_USER_MODEL_ID && process.platform === "win32") app.setAppUserModelId(APP_USER_MODEL_ID);
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

const dataRuntime = createDataDirectoryRuntime({
  app,
  projectRoot: PROJECT_ROOT,
  isDevelopment: IS_ELECTRON_DEV,
  isTestingBuild: IS_TESTING_BUILD,
  testBuildType: TEST_BUILD_TYPE,
  isStoreDistribution: IS_STORE_DISTRIBUTION,
  backendHost: BACKEND_HOST,
  backendPort: BACKEND_PORT,
  getPythonExecutable: () => runtimeConfig.pythonExecutable,
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
if (HAS_SINGLE_INSTANCE_LOCK) {
  app.on("second-instance", () => {
    const window = windowManager.getMainWindow();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });
}
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
  releasesUrl: GITHUB_RELEASES_URL,
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
  appxPackageFamilyName: APPX_PACKAGE_IDENTITY?.packageFamilyName,
  isAppxPackage: IS_APPX_PACKAGE,
  processManager,
  getMainWindow,
  logLine,
});
registerUpdateHandlers({
  ipcMain,
  app,
  shell,
  getMainWindow,
  updateService,
  releasesUrl: GITHUB_RELEASES_URL,
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

    if (!dataRuntime.getDataDirError()) {
      let backendReady = false;
      let lastBackendError = null;
      for (let attempt = 0; attempt < 3 && !backendReady; attempt += 1) {
        BACKEND_PORT = await findAvailablePort(BACKEND_HOST);
        process.env.FINLEDGE_BACKEND_PORT = String(BACKEND_PORT);
        setRuntimeBackendPort(BACKEND_PORT);
        setProcessBackendPort(BACKEND_PORT);
        logLine("[main] selected private backend port", BACKEND_PORT);
        startBackend();
        try {
          await waitForBackendReady(BACKEND_READY_TIMEOUT_MS);
          backendReady = true;
          logLine("[main] backend ready and owned by this FinLedge process");
        } catch (error) {
          lastBackendError = error;
          logLine("[main] retrying unavailable backend port", String(error?.message || error));
          await stopBackend();
        }
      }
      if (!backendReady) {
        logLine("[main] could not start an owned backend", String(lastBackendError?.stack || lastBackendError));
        await dialog.showMessageBox({
          type: "error",
          title: "FinLedge could not start",
          message: "FinLedge could not start its data service.",
          detail: "FinLedge did not connect to another app's data service. For startup details, see %TEMP%\\finledge-electron.log.",
          buttons: ["Close"],
          noLink: true,
        });
        app.quit();
        return;
      }
    }

    const hasBuiltFrontend = fs.existsSync(processManager.getFrontendIndexPath());
    logLine("[main] frontend built?", hasBuiltFrontend);

    if (IS_ELECTRON_DEV) {
      let frontendReady = false;
      for (let attempt = 0; attempt < 3 && !frontendReady; attempt += 1) {
        FRONTEND_PORT = await findAvailablePort(FRONTEND_HOST);
        process.env.FINLEDGE_FRONTEND_PORT = String(FRONTEND_PORT);
        setProcessFrontendPort(FRONTEND_PORT);
        startFrontendDevServer();
        try {
          const url = await waitForAnyLocalPortOk([FRONTEND_PORT], 8_000);
          setDevFrontendUrl(url);
          frontendReady = true;
          logLine("[main] owned Vite server ready", url);
        } catch (error) {
          logLine("[main] retrying unavailable Vite port", String(error?.message || error));
          await stopFrontendDevServer();
        }
      }
      if (frontendReady) navigateToFrontend(getDevFrontendUrl());
      else if (hasBuiltFrontend) navigateToFrontend(getFrontendUrl());
      else throw new Error("FinLedge could not start its development interface.");

      if (SHOULD_SIMULATE_UPDATES) {
        startupUpdateTimer = setTimeout(
          SIMULATE_REQUIRED_UPDATE ? simulateRequiredUpdate : simulateUpdateAvailable,
          2500
        );
      }
    } else {
      navigateToFrontend(getFrontendUrl());
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
