const { contextBridge, ipcRenderer } = require("electron");

const backendHost = String(process.env.FINLEDGE_BACKEND_HOST || "127.0.0.1").trim() || "127.0.0.1";
const backendPort = String(process.env.FINLEDGE_BACKEND_PORT || "8000").trim() || "8000";

contextBridge.exposeInMainWorld("financialTracker", {
  ping: () => "pong",
  refreshApp: () => ipcRenderer.invoke("app:refresh"),
  checkForUpdates: () => ipcRenderer.invoke("app:check-for-updates"),
  getUpdateStatus: () => ipcRenderer.invoke("app:get-update-status"),
  downloadUpdate: () => ipcRenderer.invoke("app:download-update"),
  installUpdate: () => ipcRenderer.invoke("app:install-update"),
  onUpdateStatus: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, status) => callback(status);
    ipcRenderer.on("app:update-status", listener);
    return () => ipcRenderer.removeListener("app:update-status", listener);
  },
  getBackendBaseUrl: () => `http://${backendHost}:${backendPort}`,
});
