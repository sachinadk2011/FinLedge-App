const { contextBridge, ipcRenderer } = require("electron");

const backendHost = String(process.env.FINLEDGE_BACKEND_HOST || "127.0.0.1").trim() || "127.0.0.1";
const backendPort = String(process.env.FINLEDGE_BACKEND_PORT || "8000").trim() || "8000";

contextBridge.exposeInMainWorld("financialTracker", {
  ping: () => "pong",
  refreshApp: () => ipcRenderer.invoke("app:refresh"),
  getBackendBaseUrl: () => `http://${backendHost}:${backendPort}`,
});
