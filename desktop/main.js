"use strict";

const { app, BrowserWindow, Menu, ipcMain, screen } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const zlib = require("zlib");
const { pathToFileURL } = require("url");
const { spawn } = require("child_process");

const LOG_FILE = path.join(os.tmpdir(), "finledge-electron.log");
const WINDOW_TITLE = "Finledge – Financial Tracker";
const IS_ELECTRON_DEV = String(process.env.ELECTRON_DEV || "") === "1";
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ICON_PATH = path.join(__dirname, "assets", "finledge_icon.png");
const BACKEND_READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

function logLine(...parts) {
  const line = `[${new Date().toISOString()}] ${parts
    .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
    .join(" ")}\n`;

  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // ignore
  }

  try {
    console.log(...parts);
  } catch {
    // ignore
  }
}

function getPortFromEnv(envVarName, defaultPort) {
  const rawValue = process.env[envVarName];
  if (rawValue == null || rawValue.trim() === "") {
    return defaultPort;
  }

  const parsedPort = Number(rawValue);
  if (Number.isFinite(parsedPort)) {
    return parsedPort;
  }

  logLine(`[main] Invalid ${envVarName} value, falling back to default port`, {
    rawValue,
    defaultPort,
  });
  return defaultPort;
}

const BACKEND_PORT = getPortFromEnv("FINLEDGE_BACKEND_PORT", 8000);
const FRONTEND_PORT = getPortFromEnv("FINLEDGE_FRONTEND_PORT", 5173);
const BACKEND_HOST = String(process.env.FINLEDGE_BACKEND_HOST || "127.0.0.1").trim() || "127.0.0.1";
const FRONTEND_HOST = String(process.env.FINLEDGE_FRONTEND_HOST || "127.0.0.1").trim() || "127.0.0.1";

function loadDotEnv() {
  const envPath = path.join(PROJECT_ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

function getAppMode() {
  return String(process.env.FINLEDGE_MODE || (IS_ELECTRON_DEV ? "development" : "production"))
    .trim()
    .toLowerCase();
}

function getRuntimeDataDir() {
  return IS_ELECTRON_DEV
    ? path.join(PROJECT_ROOT, ".finledge-dev-data")
    : app.getPath("userData");
}

function getFrontendIndexPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "frontendwebapp", "dist", "index.html");
  }

  return path.join(PROJECT_ROOT, "frontendwebapp", "dist", "index.html");
}

function getPackagedEnginePath() {
  return path.join(process.resourcesPath, "engine", "finledge-engine.exe");
}

function getDevPythonPath() {
  const explicit = String(process.env.FINLEDGE_PYTHON_PATH || "").trim();
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  const candidates = [
    path.join(PROJECT_ROOT, "venv", "Scripts", "python.exe"),
    path.join(PROJECT_ROOT, "venv", "bin", "python"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === "win32" ? "python" : "python3";
}

function getBackendEnv() {
  return {
    ...process.env,
    FINLEDGE_MODE: getAppMode(),
    FINLEDGE_PROJECT_ROOT: PROJECT_ROOT,
    FINLEDGE_BACKEND_HOST: BACKEND_HOST,
    FINLEDGE_BACKEND_PORT: String(BACKEND_PORT),
    FINLEDGE_DATA_DIR: getRuntimeDataDir(),
  };
}

let backendProcess = null;
let frontendProcess = null;
let mainWindow = null;
let devFrontendUrl = null;
let latestUpdateStatus = {
  state: "idle",
  title: "Updates",
  detail: "",
};
let mockUpdateTimer = null;
let showUpdateCheckStatus = false;

process.on("uncaughtException", (err) => {
  logLine("[main] uncaughtException:", String(err && err.stack ? err.stack : err));
});

process.on("unhandledRejection", (reason) => {
  logLine("[main] unhandledRejection:", String(reason && reason.stack ? reason.stack : reason));
});

logLine("[main] Finledge Electron starting...", { logFile: LOG_FILE });
loadDotEnv();
process.env.FINLEDGE_MODE = getAppMode();
const SHOULD_SIMULATE_UPDATES = IS_ELECTRON_DEV && String(process.env.FINLEDGE_SIMULATE_UPDATE || "") === "1";
app.setName("Finledge");
Menu.setApplicationMenu(null);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPlaceholderIconPng(filePath) {
  const width = 256;
  const height = 256;
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * rowSize + 1 + x * 4;
      const t = (x + y) / (width + height);
      raw[i] = Math.round(10 + 20 * t);
      raw[i + 1] = Math.round(90 + 90 * t);
      raw[i + 2] = Math.round(95 + 70 * t);
      raw[i + 3] = 255;
    }
  }

  function fillRect(x0, y0, w, h) {
    const x1 = Math.min(width, x0 + w);
    const y1 = Math.min(height, y0 + h);
    for (let y = Math.max(0, y0); y < y1; y++) {
      for (let x = Math.max(0, x0); x < x1; x++) {
        const i = y * rowSize + 1 + x * 4;
        raw[i] = 255;
        raw[i + 1] = 255;
        raw[i + 2] = 255;
        raw[i + 3] = 255;
      }
    }
  }

  const fx = 76;
  const fy = 62;
  fillRect(fx, fy, 26, 130);
  fillRect(fx, fy, 104, 24);
  fillRect(fx, fy + 54, 84, 22);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filePath, png);
}

function ensureIconExists() {
  if (fs.existsSync(ICON_PATH)) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(ICON_PATH), { recursive: true });
    createPlaceholderIconPng(ICON_PATH);
  } catch (err) {
    logLine("[main] Could not create placeholder icon", String(err));
  }
}

function startBackend() {
  const env = getBackendEnv();
  let command;
  let args;
  let cwd;

  if (app.isPackaged && !IS_ELECTRON_DEV) {
    command = getPackagedEnginePath();
    args = [];
    cwd = path.dirname(command);

    if (!fs.existsSync(command)) {
      throw new Error(`Packaged backend sidecar not found at ${command}`);
    }
  } else {
    command = getDevPythonPath();
    args = ["-m", "backend.engine_main"];
    cwd = PROJECT_ROOT;
  }

  backendProcess = spawn(command, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => process.stdout.write(`[backend] ${data}`));
  backendProcess.stderr.on("data", (data) => process.stderr.write(`[backend] ${data}`));
  backendProcess.on("exit", (code, signal) => {
    logLine("[main] Backend exited", { code, signal });
    backendProcess = null;
  });
}

function stopBackend() {
  if (!backendProcess) {
    return;
  }

  backendProcess.kill();
  backendProcess = null;
}

function startFrontendDevServer() {
  if (frontendProcess) {
    return;
  }

  const frontendDir = path.join(PROJECT_ROOT, "frontendwebapp");
  const viteDevArgs = ["run", "dev", "--", "--host", FRONTEND_HOST, "--port", String(FRONTEND_PORT)];
  const env = {
    ...process.env,
    VITE_API_BASE_URL: `http://${BACKEND_HOST}:${BACKEND_PORT}`,
  };

  try {
    if (process.platform === "win32") {
      const comspec = process.env.ComSpec || "cmd.exe";
      frontendProcess = spawn(comspec, ["/d", "/c", "npm.cmd", ...viteDevArgs], {
        cwd: frontendDir,
        env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      frontendProcess = spawn("npm", viteDevArgs, {
        cwd: frontendDir,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
  } catch (err) {
    logLine("[main] Failed to spawn frontend dev server", String(err && err.stack ? err.stack : err));
    frontendProcess = null;
    return;
  }

  frontendProcess.stdout.on("data", (data) => process.stdout.write(`[vite] ${data}`));
  frontendProcess.stderr.on("data", (data) => process.stderr.write(`[vite] ${data}`));
  frontendProcess.on("exit", (code, signal) => {
    logLine("[main] Frontend dev server exited", { code, signal });
    frontendProcess = null;
  });
}

function stopFrontendDevServer() {
  if (!frontendProcess) {
    return;
  }

  frontendProcess.kill();
  frontendProcess = null;
}

function waitForHttpOk(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
          return;
        }

        if (Date.now() >= deadline) {
          reject(new Error(`Timeout waiting for ${url}`));
        } else {
          setTimeout(tick, POLL_INTERVAL_MS);
        }
      });

      req.on("error", () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Timeout waiting for ${url}`));
        } else {
          setTimeout(tick, POLL_INTERVAL_MS);
        }
      });

      req.setTimeout(400, () => req.destroy());
    };

    tick();
  });
}

function waitForAnyLocalPortOk(ports, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const tick = () => {
      let portIndex = 0;

      const tryNextPort = () => {
        if (portIndex >= ports.length) {
          if (Date.now() >= deadline) {
            reject(new Error("Timeout waiting for frontend dev server"));
          } else {
            setTimeout(tick, POLL_INTERVAL_MS);
          }
          return;
        }

        const port = ports[portIndex++];
        const urls = [`http://${FRONTEND_HOST}:${port}`, `http://localhost:${port}`];
        let urlIndex = 0;

        const tryNextUrl = () => {
          if (urlIndex >= urls.length) {
            tryNextPort();
            return;
          }

          const url = urls[urlIndex++];
          const req = http.get(url, (res) => {
            res.resume();
            resolve(url);
          });

          req.on("error", () => tryNextUrl());
          req.setTimeout(400, () => req.destroy());
        };

        tryNextUrl();
      };

      tryNextPort();
    };

    tick();
  });
}

function getFrontendUrl() {
  const explicit = String(process.env.ELECTRON_START_URL || "").trim();
  if (explicit) {
    return explicit;
  }

  const builtIndex = getFrontendIndexPath();
  if (fs.existsSync(builtIndex)) {
    return pathToFileURL(builtIndex).toString();
  }

  return devFrontendUrl || `http://${FRONTEND_HOST}:${FRONTEND_PORT}`;
}

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
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Finledge</title>
  <style>
    html,body{height:100%;margin:0;font-family:Segoe UI,Arial,sans-serif;}
    body{display:grid;place-items:center;background:linear-gradient(180deg,#f8fafc,#eef2f7);color:#0f172a;}
    .card{background:rgba(255,255,255,.8);border:1px solid rgba(226,232,240,.9);border-radius:16px;padding:18px 20px;box-shadow:0 18px 45px rgba(15,23,42,.10);width:min(520px,92vw);}
    .brand{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
    .logo{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#0f766e,#2dd4bf);display:grid;place-items:center;color:#fff;font-weight:900;}
    .title{font-size:18px;font-weight:800;letter-spacing:-.01em;}
    .sub{font-size:13px;color:#475569;line-height:1.45;}
    .bar{height:10px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin-top:14px;}
    .fill{height:100%;width:35%;background:linear-gradient(90deg,#0f766e,#3b82f6);animation:move 1.2s ease-in-out infinite alternate;border-radius:999px;}
    @keyframes move{from{transform:translateX(-15%);}to{transform:translateX(140%);}}
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="logo">F</div>
      <div>
        <div class="title">Finledge</div>
        <div class="sub">Starting Financial Tracker...</div>
      </div>
    </div>
    <div class="sub">Launching the backend engine and loading the UI. This can take a few seconds on the first run.</div>
    <div class="bar"><div class="fill"></div></div>
  </div>
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
    title: WINDOW_TITLE,
    icon: ICON_PATH,
    show: false,
    backgroundColor: "#f8fafc",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    try {
      mainWindow.show();
      mainWindow.focus();
    } catch {
      // ignore
    }
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    logLine("[main] did-fail-load", { errorCode, errorDescription, validatedURL });
  });

  const url = getLoadingUrl();
  logLine("[main] Loading splash", url.slice(0, 60) + "...");
  mainWindow.loadURL(url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function navigateToFrontend(url) {
  if (!mainWindow || !url) {
    return;
  }

  logLine("[main] Navigating to frontend", url);
  mainWindow.loadURL(url).catch((err) => {
    logLine("[main] navigateToFrontend error", String(err && err.stack ? err.stack : err));
  });
}

function getUpdateVersion(info) {
  return String(info?.version || info?.releaseName || "").trim();
}

function sendUpdateStatus(status) {
  latestUpdateStatus = {
    ...latestUpdateStatus,
    ...status,
    updatedAt: new Date().toISOString(),
  };

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("app:update-status", latestUpdateStatus);
}

function clearMockUpdateTimer() {
  if (mockUpdateTimer) {
    clearInterval(mockUpdateTimer);
    mockUpdateTimer = null;
  }
}

function simulateUpdateAvailable() {
  sendUpdateStatus({
    state: "available",
    title: "Update available",
    detail: "Finledge test update is ready to download.",
    version: `${app.getVersion()}-test`,
    isSimulation: true,
  });
}

function simulateUpdateDownload() {
  clearMockUpdateTimer();

  let percent = 0;
  sendUpdateStatus({
    state: "downloading",
    title: "Downloading update",
    detail: "Starting the test update download...",
    percent,
    transferred: 0,
    total: 100,
    isSimulation: true,
  });

  mockUpdateTimer = setInterval(() => {
    percent = Math.min(100, percent + 8 + Math.round(Math.random() * 10));

    sendUpdateStatus({
      state: percent >= 100 ? "downloaded" : "downloading",
      title: percent >= 100 ? "Update ready" : "Downloading update",
      detail:
        percent >= 100
          ? "Test update downloaded. Restart would install it in a real release."
          : `Downloaded ${percent}% of the test update.`,
      percent,
      transferred: percent,
      total: 100,
      isSimulation: true,
    });

    if (percent >= 100) {
      clearMockUpdateTimer();
    }
  }, 450);
}

function configureAutoUpdater() {
  if (SHOULD_SIMULATE_UPDATES) {
    logLine("[updater] Running with simulated update flow");
    return;
  }

  if (IS_ELECTRON_DEV || !app.isPackaged) {
    logLine("[updater] Skipping auto-updater outside packaged production mode");
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    logLine("[updater] Checking for updates");
    if (!showUpdateCheckStatus) {
      return;
    }

    sendUpdateStatus({
      state: "checking",
      title: "Checking for updates",
      detail: "Looking for the latest Finledge release...",
      percent: null,
    });
  });

  autoUpdater.on("update-available", (info) => {
    logLine("[updater] Update available", info);
    showUpdateCheckStatus = false;
    const version = getUpdateVersion(info);
    sendUpdateStatus({
      state: "available",
      title: "Update available",
      detail: version
        ? `Finledge ${version} is available. Download it in the background and keep working.`
        : "A new Finledge update is available. Download it in the background and keep working.",
      version,
      percent: null,
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    logLine("[updater] No update available", info);
    if (!showUpdateCheckStatus) {
      return;
    }

    showUpdateCheckStatus = false;
    sendUpdateStatus({
      state: "not-available",
      title: "Finledge is up to date",
      detail: "You already have the latest available version.",
      percent: null,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    logLine("[updater] Download progress", {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
    sendUpdateStatus({
      state: "downloading",
      title: "Downloading update",
      detail: "Finledge is downloading the update in the background.",
      percent: Number(progress.percent) || 0,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    logLine("[updater] Update downloaded", info);
    const version = getUpdateVersion(info);
    sendUpdateStatus({
      state: "downloaded",
      title: "Update ready",
      detail: version
        ? `Finledge ${version} is ready. Restart the app to finish updating.`
        : "The update is ready. Restart the app to finish updating.",
      version,
      percent: 100,
    });
  });

  autoUpdater.on("error", (err) => {
    logLine("[updater] Error", String(err && err.stack ? err.stack : err));
    const wasVisibleUpdateFlow = ["available", "checking", "downloading", "downloaded"].includes(
      latestUpdateStatus.state
    );
    if (!showUpdateCheckStatus && !wasVisibleUpdateFlow) {
      return;
    }

    showUpdateCheckStatus = false;
    sendUpdateStatus({
      state: "error",
      title: "Update failed",
      detail: "Finledge could not complete the update check or download. Please try again later.",
      error: String(err && err.message ? err.message : err),
    });
  });
}

ipcMain.handle("app:refresh", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  try {
    mainWindow.webContents.reloadIgnoringCache();
    return true;
  } catch (err) {
    logLine("[main] refresh failed", String(err && err.stack ? err.stack : err));
    return false;
  }
});

ipcMain.handle("app:check-for-updates", async () => {
  if (SHOULD_SIMULATE_UPDATES) {
    sendUpdateStatus({
      state: "checking",
      title: "Checking for updates",
      detail: "Running the test update check...",
      percent: null,
      isSimulation: true,
    });
    setTimeout(simulateUpdateAvailable, 900);
    return { ok: true, simulated: true };
  }

  if (IS_ELECTRON_DEV || !app.isPackaged) {
    sendUpdateStatus({
      state: "not-available",
      title: "Updates disabled in development",
      detail: "Auto-updates run only from the installed production app.",
      percent: null,
    });
    return { ok: false, reason: "updates-disabled-in-dev" };
  }

  try {
    showUpdateCheckStatus = true;
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    showUpdateCheckStatus = false;
    logLine("[updater] Manual check failed", String(err && err.stack ? err.stack : err));
    return { ok: false, reason: "update-check-failed" };
  }
});

ipcMain.handle("app:get-update-status", async () => latestUpdateStatus);

ipcMain.handle("app:download-update", async () => {
  if (SHOULD_SIMULATE_UPDATES) {
    simulateUpdateDownload();
    return { ok: true, simulated: true };
  }

  if (IS_ELECTRON_DEV || !app.isPackaged) {
    return { ok: false, reason: "updates-disabled-in-dev" };
  }

  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    logLine("[updater] downloadUpdate failed", String(err && err.stack ? err.stack : err));
    sendUpdateStatus({
      state: "error",
      title: "Update download failed",
      detail: "Finledge could not download the update. Please try again later.",
      error: String(err && err.message ? err.message : err),
    });
    return { ok: false, reason: "update-download-failed" };
  }
});

ipcMain.handle("app:install-update", async () => {
  if (SHOULD_SIMULATE_UPDATES) {
    sendUpdateStatus({
      state: "installing",
      title: "Restart simulated",
      detail: "The test update flow is complete. A real release would restart now.",
      percent: 100,
      isSimulation: true,
    });
    return { ok: true, simulated: true };
  }

  if (IS_ELECTRON_DEV || !app.isPackaged) {
    return { ok: false, reason: "updates-disabled-in-dev" };
  }

  setImmediate(() => autoUpdater.quitAndInstall());
  return { ok: true };
});

app.whenReady().then(async () => {
  try {
    ensureIconExists();
    logLine("[main] whenReady()");
    logLine("[main] mode", process.env.FINLEDGE_MODE);
    logLine("[main] backendPort", BACKEND_PORT);
    logLine("[main] frontendPort", FRONTEND_PORT);
    logLine("[main] icon", { iconPath: ICON_PATH, iconExists: fs.existsSync(ICON_PATH) });
    logLine("[main] userData", app.getPath("userData"));
    logLine("[main] dataDir", getRuntimeDataDir());

    createWindow();
    startBackend();

    waitForHttpOk(`http://${BACKEND_HOST}:${BACKEND_PORT}/health`, BACKEND_READY_TIMEOUT_MS)
      .then(() => logLine("[main] backend ready"))
      .catch((err) => logLine("[main] backend not ready", String(err && err.message ? err.message : err)));

    const hasBuiltFrontend = fs.existsSync(getFrontendIndexPath());
    logLine("[main] frontend built?", hasBuiltFrontend);

    if (IS_ELECTRON_DEV) {
      configureAutoUpdater();
      const preferredDevUrl = `http://${FRONTEND_HOST}:${FRONTEND_PORT}`;
      const preferredLocalhostDevUrl = `http://localhost:${FRONTEND_PORT}`;

      waitForHttpOk(preferredLocalhostDevUrl, 1200)
        .then(() => {
          devFrontendUrl = preferredLocalhostDevUrl;
          logLine("[main] Vite already running", devFrontendUrl);
          navigateToFrontend(devFrontendUrl);
        })
        .catch(() => waitForHttpOk(preferredDevUrl, 1200))
        .then(() => {
          if (devFrontendUrl) {
            return;
          }
          devFrontendUrl = preferredDevUrl;
          logLine("[main] Vite already running", devFrontendUrl);
          navigateToFrontend(devFrontendUrl);
        })
        .catch(() => {
          startFrontendDevServer();
          waitForAnyLocalPortOk([FRONTEND_PORT], 30_000)
            .then((url) => {
              devFrontendUrl = url;
              logLine("[main] Vite ready", devFrontendUrl);
              navigateToFrontend(devFrontendUrl);
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
        setTimeout(simulateUpdateAvailable, 2500);
      }
    } else {
      navigateToFrontend(getFrontendUrl());
      configureAutoUpdater();
      setTimeout(() => {
        if (SHOULD_SIMULATE_UPDATES) {
          simulateUpdateAvailable();
          return;
        }

        autoUpdater.checkForUpdates().catch((err) => {
          logLine("[updater] Initial update check failed", String(err && err.stack ? err.stack : err));
        });
      }, 5000);
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
});
