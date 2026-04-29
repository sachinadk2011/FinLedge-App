const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("financialTracker", {
  ping: () => "pong",
  refreshApp: () => ipcRenderer.invoke("app:refresh"),
  getBackendBaseUrl: () => `http://127.0.0.1:${process.env.FINLEDGE_BACKEND_PORT || "8000"}`,
});
