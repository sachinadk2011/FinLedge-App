"use strict";

const { app, BrowserWindow, Menu, ipcMain, screen, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { getAppxPackageIdentity } = require("./services/appxPaths");
const { createRendererPromptManager } = require("./services/rendererPromptManager");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ICON_PATH = path.join(__dirname, "assets", "finledge_icon.png");
const WINDOW_ICON_PATH = path.join(__dirname, "assets", "finledge_icon.ico");
const GITHUB_RELEASES_URL = "https://github.com/sachinadk2011/FinLedge-App/releases";
const BACKEND_READY_TIMEOUT_MS = 30_000;
const { LOG_FILE, logLine } = require("./services/logger");
const { loadRuntimeConfig } = require("./services/runtimeConfig");
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
  backendPort: BACKEND_PORT,
  frontendPort: FRONTEND_PORT,
  backendHost: BACKEND_HOST,
  frontendHost: FRONTEND_HOST,
  updatePolicyUrl: UPDATE_POLICY_URL,
  simulateUpdateValue: SIMULATE_UPDATE_VALUE,
} = runtimeConfig;
const APPX_APPLICATION_ID = runtimeConfig.appxApplicationId || (IS_TESTING_BUILD ? "FinledgeTesting" : "Finledge");
const APPLICATION_NAME = IS_TESTING_BUILD
  ? `Finledge Testing ${TEST_BUILD_TYPE === "appx" ? "AppX" : "EXE"}`
  : IS_ELECTRON_DEV
    ? "Finledge Development"
    : "Finledge";
app.setName(APPLICATION_NAME);
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
    waitForHttpOk(`http://${BACKEND_HOST}:${BACKEND_PORT}/health`, BACKEND_READY_TIMEOUT_MS)
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
  releasesUrl: GITHUB_RELEASES_URL,
  compareVersions,
  normalizeReleaseNotes,
  getMainWindow: windowManager.getMainWindow,
  logLine,
});
const {
  getRuntimeDataDir,
  initializeDataDirectory,
} = dataRuntime;
const {
  startBackend,
  stopBackend,
  startFrontendDevServer,
  stopFrontendDevServer,
  waitForHttpOk,
  waitForAnyLocalPortOk,
  getFrontendUrl,
  getDevFrontendUrl,
  setDevFrontendUrl,
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
  updatesManagedByPackage: IS_APPX_PACKAGE,
  isStorePackage: IS_STORE_PACKAGE,
  simulateUpdates: SHOULD_SIMULATE_UPDATES,
  simulateRequiredUpdate: SIMULATE_REQUIRED_UPDATE,
  logLine,
});
Menu.setApplicationMenu(null);

app.whenReady().then(async () => {
  try {
    iconAssets.ensureIconExists();
    logLine("[main] whenReady()");
    logLine("[main] mode", process.env.FINLEDGE_MODE);
    logLine("[main] backendPort", BACKEND_PORT);
    logLine("[main] frontendPort", FRONTEND_PORT);
    logLine("[main] icon", { iconPath: ICON_PATH, iconExists: fs.existsSync(ICON_PATH) });
    logLine("[main] userData", app.getPath("userData"));
    logLine("[main] dataDir", getRuntimeDataDir());

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

    createWindow();
    if (!dataRuntime.getDataDirError()) startBackend();

    waitForHttpOk(`http://${BACKEND_HOST}:${BACKEND_PORT}/health`, BACKEND_READY_TIMEOUT_MS)
      .then(() => logLine("[main] backend ready"))
      .catch((err) => logLine("[main] backend not ready", String(err && err.message ? err.message : err)));

    const hasBuiltFrontend = fs.existsSync(processManager.getFrontendIndexPath());
    logLine("[main] frontend built?", hasBuiltFrontend);

    if (IS_ELECTRON_DEV) {
      
      const preferredDevUrl = `http://${FRONTEND_HOST}:${FRONTEND_PORT}`;
      const preferredLocalhostDevUrl = `http://localhost:${FRONTEND_PORT}`;

      waitForHttpOk(preferredLocalhostDevUrl, 1200)
        .then(() => {
          setDevFrontendUrl(preferredLocalhostDevUrl);
          logLine("[main] Vite already running", getDevFrontendUrl());
          navigateToFrontend(getDevFrontendUrl());
        })
        .catch(() => waitForHttpOk(preferredDevUrl, 1200))
        .then(() => {
          if (getDevFrontendUrl()) {
            return;
          }
          setDevFrontendUrl(preferredDevUrl);
          logLine("[main] Vite already running", getDevFrontendUrl());
          navigateToFrontend(getDevFrontendUrl());
        })
        .catch(() => {
          startFrontendDevServer();
          waitForAnyLocalPortOk([FRONTEND_PORT], 30_000)
            .then((url) => {
              setDevFrontendUrl(url);
              logLine("[main] Vite ready", getDevFrontendUrl());
              navigateToFrontend(getDevFrontendUrl());
            })
            .catch((err) => {
              logLine("[main] Vite not ready", String(err && err.message ? err.message : err));
              if (hasBuiltFrontend) {
                logLine("[main] Falling back to built frontend");
                navigateToFrontend(getFrontendUrl());
              }
            });
        });

      if (SHOULD_SIMULATE_UPDATES) {
        setTimeout(
          SIMULATE_REQUIRED_UPDATE ? simulateRequiredUpdate : simulateUpdateAvailable,
          2500
        );
      }
    } else {
      navigateToFrontend(getFrontendUrl());
      if (IS_STORE_PACKAGE) {
        setTimeout(() => checkStoreUpdatePolicy({ silent: true }), 5000);
        setInterval(() => checkStoreUpdatePolicy({ silent: true }), 6 * 60 * 60 * 1000);
      } else if (!IS_APPX_PACKAGE) {
        setTimeout(() => {
          if (SHOULD_SIMULATE_UPDATES) {
            simulateUpdateAvailable();
            return;
          }

          checkUpdatePolicy({ silent: true });
        }, 5000);
        setInterval(() => checkUpdatePolicy({ silent: true }), 6 * 60 * 60 * 1000);
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

app.on("will-quit", () => {
  stopFrontendDevServer();
  stopBackend();
  dataRuntime.releaseLock();
});
