"use strict";

const fs = require("fs");
const path = require("path");

function createWindowManager({ BrowserWindow, screen, app, projectRoot, preloadPath, iconPath, windowIconPath, applicationName, logLine, onFrontendReady }) {
  let mainWindow = null;

  function clampNumber(value, min, max) {
    const lowerBound = Math.min(min, max);
    const upperBound = Math.max(min, max);
    return Math.min(Math.max(value, lowerBound), upperBound);
  }

  function getInitialWindowBounds() {
    const display = screen.getPrimaryDisplay();
    const workArea = display?.workAreaSize || { width: 1280, height: 800 };
    const usableWidth = Math.max(640, Number(workArea.width) || 1280);
    const usableHeight = Math.max(480, Number(workArea.height) || 800);
    const width = clampNumber(
      Math.round(usableWidth * 0.8),
      Math.min(960, usableWidth - 32),
      Math.min(1600, usableWidth - 32)
    );
    const height = clampNumber(
      Math.round(usableHeight * 0.8),
      Math.min(600, usableHeight - 32),
      Math.min(900, usableHeight - 32)
    );
    return { width, height };
  }

  function getLoadingUrl() {
    let iconSrc = "";
    try {
      iconSrc = `data:image/png;base64,${fs.readFileSync(iconPath).toString("base64")}`;
    } catch {
      // Fall back to the text mark when the icon asset is unavailable.
    }

    const logoHtml = iconSrc
      ? `<img src="${iconSrc}" alt="FinLedge" style="width:100px;height:100px;object-fit:contain;" />`
      : '<div class="fallback-logo">F</div>';
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${applicationName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{height:100%;width:100%;overflow:hidden;background:#f8fafc;}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;font-family:Segoe UI,Arial,sans-serif;}
    .logo-wrap{animation:pulse 1.6s ease-in-out infinite;}
    .fallback-logo{width:100px;height:100px;border-radius:22px;background:linear-gradient(135deg,#0f766e,#2dd4bf);display:grid;place-items:center;color:#fff;font-size:42px;font-weight:900;letter-spacing:-.03em;box-shadow:0 8px 32px rgba(15,118,110,.25);}
    @keyframes pulse{0%{opacity:1;transform:scale(1);}50%{opacity:.35;transform:scale(.92);}100%{opacity:1;transform:scale(1);}}
    .app-name{font-size:22px;font-weight:800;letter-spacing:-.02em;color:#0f172a;opacity:.85;}
    .hint{font-size:13px;color:#64748b;font-weight:500;}
  </style>
</head>
<body>
  <div class="logo-wrap">${logoHtml}</div>
  <div><div class="app-name">${applicationName}</div></div>
  <div class="hint">Starting up&hellip;</div>
</body>
</html>`;
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }

  function createWindow() {
    const initialBounds = getInitialWindowBounds();
    logLine("[main] Initial window bounds", initialBounds);
    mainWindow = new BrowserWindow({
      width: initialBounds.width,
      height: initialBounds.height,
      minWidth: Math.min(900, initialBounds.width),
      minHeight: Math.min(560, initialBounds.height),
      center: true,
      title: applicationName,
      icon: windowIconPath || iconPath,
      show: false,
      backgroundColor: "#f8fafc",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: preloadPath,
      },
    });

    mainWindow.once("ready-to-show", () => {
      try {
        mainWindow.show();
        mainWindow.focus();
      } catch {
        // The window can close while its ready event is queued.
      }
    });
    mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      logLine("[main] did-fail-load", { errorCode, errorDescription, validatedURL });
    });
    const splashUrl = getLoadingUrl();
    logLine("[main] Loading splash", splashUrl.slice(0, 60) + "...");
    mainWindow.loadURL(splashUrl);
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  function navigateToFrontend(url) {
    if (!mainWindow || !url) return;
    logLine("[main] Navigating to frontend", url);
    mainWindow.webContents.once("did-finish-load", () => {
      if (mainWindow) onFrontendReady?.(mainWindow);
    });
    mainWindow.loadURL(url).catch((error) => {
      logLine("[main] navigateToFrontend error", String(error && error.stack ? error.stack : error));
    });
  }

  return {
    createWindow,
    navigateToFrontend,
    getMainWindow: () => mainWindow,
  };
}

module.exports = { createWindowManager };
