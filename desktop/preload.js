const { contextBridge, ipcRenderer } = require("electron");

const backendHost = String(process.env.FINLEDGE_BACKEND_HOST || "127.0.0.1").trim() || "127.0.0.1";
let resolvedBackendPort = null;
let backendPortResolution = null;

if (typeof ipcRenderer.on === "function") {
  ipcRenderer.on("app:backend-port-changed", (_event, port) => {
    const updatedPort = String(port || "").trim();
    if (!updatedPort) return;
    resolvedBackendPort = updatedPort;
    backendPortResolution = Promise.resolve(updatedPort);
  });
}

async function getBackendBaseUrl() {
  if (resolvedBackendPort === null) {
    if (!backendPortResolution) {
      backendPortResolution = ipcRenderer.invoke("app:get-backend-port")
        .then((port) => {
          resolvedBackendPort = String(port || process.env.FINLEDGE_BACKEND_PORT || "8000").trim() || "8000";
          return resolvedBackendPort;
        })
        .catch(() => {
          resolvedBackendPort = String(process.env.FINLEDGE_BACKEND_PORT || "8000").trim() || "8000";
          return resolvedBackendPort;
        });
    }
    await backendPortResolution;
  }
  return `http://${backendHost}:${resolvedBackendPort}`;
}

contextBridge.exposeInMainWorld("financialTracker", {
  updatesManagedByWindows: Boolean(process.windowsStore),
  storeAppxUpdates: process.env.FINLEDGE_STORE_DISTRIBUTION === "1",
  testUpdateNotices: process.env.FINLEDGE_TESTING_BUILD === "1",
  isTestBuild: process.env.FINLEDGE_TESTING_BUILD === "1",
  ping: () => "pong",
  refreshApp: () => ipcRenderer.invoke("app:refresh"),
  checkForUpdates: () => ipcRenderer.invoke("app:check-for-updates"),
  openTestUpdatePolicyFolder: () => ipcRenderer.invoke("app:open-test-update-policy"),
  getUpdateStatus: () => ipcRenderer.invoke("app:get-update-status"),
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  openUpdateRelease: (releaseUrl) => ipcRenderer.invoke("app:open-update-release", releaseUrl),
  downloadUpdate: () => ipcRenderer.invoke("app:download-update"),
  installUpdate: () => ipcRenderer.invoke("app:install-update"),
  getDataLocations: () => ipcRenderer.invoke("app:get-data-locations"),
  openDataLocation: (target) => ipcRenderer.invoke("app:open-data-location", target),
  chooseDataFolder: () => ipcRenderer.invoke("app:choose-data-folder"),
  onShortcutPrompt: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("app:shortcut-prompt", listener);
    return () => ipcRenderer.removeListener("app:shortcut-prompt", listener);
  },
  respondToShortcutPrompt: (payload) => ipcRenderer.invoke("app:shortcut-prompt-response", payload),
  saveExportFile: (payload) => ipcRenderer.invoke("app:save-export-file", payload),
  onUpdateStatus: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, status) => callback(status);
    ipcRenderer.on("app:update-status", listener);
    return () => ipcRenderer.removeListener("app:update-status", listener);
  },
  getBackendBaseUrl,
  reportStartupFirstPaint: () => ipcRenderer.send("app:startup-first-paint"),
});
