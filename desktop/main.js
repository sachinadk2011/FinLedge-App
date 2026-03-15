const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

function getStartUrl() {
  const explicit = (process.env.ELECTRON_START_URL || "").trim();
  if (explicit) return explicit;

  const projectRoot = path.resolve(__dirname, "..");
  const builtIndex = path.join(projectRoot, "frontendwebapp", "dist", "index.html");
  if (fs.existsSync(builtIndex)) {
    return `file://${builtIndex}`;
  }

  return "http://localhost:5173";
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadURL(getStartUrl());
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

