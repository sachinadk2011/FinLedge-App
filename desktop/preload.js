const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("financialTracker", {
  ping: () => "pong"
});

