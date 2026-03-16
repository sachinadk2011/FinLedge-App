"use strict";

const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const zlib = require("zlib");
const { spawn } = require("child_process");

const LOG_FILE = path.join(os.tmpdir(), "finledge-electron.log");

function logLine(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ")}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // ignore
  }
  // Also log to console if available.
  try {
    console.log(...parts);
  } catch {
    // ignore
  }
}

process.on("uncaughtException", (err) => {
  logLine("[main] uncaughtException:", String(err && err.stack ? err.stack : err));
});

process.on("unhandledRejection", (reason) => {
  logLine("[main] unhandledRejection:", String(reason && reason.stack ? reason.stack : reason));
});

logLine("[main] Finledge Electron starting...", { logFile: LOG_FILE });

const BACKEND_PORT = 8000;
const BACKEND_READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PYTHON = path.join(PROJECT_ROOT, "venv", "Scripts", "python.exe");
const ICON_PATH = path.join(__dirname, "finledge_icon.png");

let backendProcess = null;
let frontendProcess = null;
let mainWindow = null;
let devFrontendUrl = null;

// Ensure the userData folder is named "Finledge" even in dev.
app.setName("Finledge");

// Hide the default Electron menu (File/Edit/View/Help).
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
  // Copyright-safe placeholder icon generated locally: gradient + block "F".
  const width = 256;
  const height = 256;
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const i = y * rowSize + 1 + x * 4;
      const t = (x + y) / (width + height);
      raw[i] = Math.round(10 + 20 * t); // R
      raw[i + 1] = Math.round(90 + 90 * t); // G
      raw[i + 2] = Math.round(95 + 70 * t); // B
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

  // Blocky "F" center-left
  const fx = 76;
  const fy = 62;
  fillRect(fx, fy, 26, 130);
  fillRect(fx, fy, 104, 24);
  fillRect(fx, fy + 54, 84, 22);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
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
  if (fs.existsSync(ICON_PATH)) return;
  try {
    createPlaceholderIconPng(ICON_PATH);
  } catch (err) {
    console.warn("[main] Could not create placeholder icon:", err);
  }
}

function migrateLegacyData(userDataDir) {
  // On first run, copy any existing Excel files from backend/data into userDataDir.
  const legacyDir = path.join(PROJECT_ROOT, "backend", "data");
  if (!fs.existsSync(legacyDir)) return;

  const mappings = [
    { target: "bank_transactions.xlsx", candidates: ["bank_transactions.xlsx", "bank.xlsx"] },
    { target: "share_transactions.xlsx", candidates: ["share_transactions.xlsx", "share.xlsx"] },
  ];

  for (const map of mappings) {
    const targetPath = path.join(userDataDir, map.target);
    if (fs.existsSync(targetPath)) continue;
    for (const name of map.candidates) {
      const candidate = path.join(legacyDir, name);
      if (fs.existsSync(candidate)) {
        fs.copyFileSync(candidate, targetPath);
        break;
      }
    }
  }
}

function startBackend() {
  const userDataDir = app.getPath("userData");
  migrateLegacyData(userDataDir);

  const env = {
    ...process.env,
    // Backend reads this to decide where to store Excel files.
    FINLEDGE_DATA_DIR: userDataDir,
  };

  backendProcess = spawn(
    PYTHON,
    ["-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
    { cwd: PROJECT_ROOT, env, stdio: ["ignore", "pipe", "pipe"] }
  );

  backendProcess.stdout.on("data", (d) => process.stdout.write(`[backend] ${d}`));
  backendProcess.stderr.on("data", (d) => process.stderr.write(`[backend] ${d}`));
  backendProcess.on("exit", (code, signal) => {
    console.log(`[main] Backend exited - code=${code} signal=${signal}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (!backendProcess) return;
  backendProcess.kill();
  backendProcess = null;
}

function startFrontendDevServer() {
  if (frontendProcess) return;

  const frontendDir = path.join(PROJECT_ROOT, "frontendwebapp");

  try {
    if (process.platform === "win32") {
      // Run npm from the frontend directory. This avoids --prefix quoting issues on Windows paths with spaces.
      const comspec = process.env.ComSpec || "cmd.exe";
      frontendProcess = spawn(comspec, ["/d", "/c", "npm.cmd", "run", "dev"], {
        cwd: frontendDir,
        env: process.env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      frontendProcess = spawn("npm", ["run", "dev"], {
        cwd: frontendDir,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
  } catch (err) {
    logLine("[main] Failed to spawn frontend dev server:", String(err && err.stack ? err.stack : err));
    frontendProcess = null;
    return;
  }

  frontendProcess.on("error", (err) => {
    logLine("[main] Frontend dev server process error:", String(err && err.stack ? err.stack : err));
  });

  logLine("[main] Frontend dev server spawned", { pid: frontendProcess.pid, dir: frontendDir });

  frontendProcess.stdout.on("data", (d) => process.stdout.write(`[vite] ${d}`));
  frontendProcess.stderr.on("data", (d) => process.stderr.write(`[vite] ${d}`));
  frontendProcess.on("exit", (code, signal) => {
    logLine(`[main] Frontend dev server exited - code=${code} signal=${signal}`);
    frontendProcess = null;
  });
}

function stopFrontendDevServer() {
  if (!frontendProcess) return;
  frontendProcess.kill();
  frontendProcess = null;
}

function waitForHttpOk(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() >= deadline) reject(new Error(`Timeout waiting for ${url}`));
        else setTimeout(tick, POLL_INTERVAL_MS);
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
      let idx = 0;

      const tryNext = () => {
        if (idx >= ports.length) {
          if (Date.now() >= deadline) {
            reject(new Error("Timeout waiting for frontend dev server"));
          } else {
            setTimeout(tick, POLL_INTERVAL_MS);
          }
          return;
        }

        const port = ports[idx++];
        const req = http.get(`http://127.0.0.1:${port}`, (res) => {
          res.resume();
          resolve(port);
        });
        req.on("error", () => tryNext());
        req.setTimeout(400, () => req.destroy());
      };

      tryNext();
    };

    tick();
  });
}

function getFrontendUrl() {
  const explicit = String(process.env.ELECTRON_START_URL || "").trim();
  if (explicit) return explicit;

  const builtIndex = path.join(PROJECT_ROOT, "frontendwebapp", "dist", "index.html");
  if (fs.existsSync(builtIndex)) return `file://${builtIndex}`;

  return devFrontendUrl || "http://localhost:5173";
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
    <div class="sub">Launching backend and loading the UI. This can take a few seconds on the first run.</div>
    <div class="bar"><div class="fill"></div></div>
  </div>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Finledge \u2013 Financial Tracker",
    icon: ICON_PATH,
    show: false,
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

  // Show an instant loading page, then we'll swap to the real UI URL when ready.
  const url = getLoadingUrl();
  logLine("[main] Loading splash", url.slice(0, 60) + "...");
  mainWindow.loadURL(url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function navigateToFrontend(url) {
  if (!mainWindow) return;
  if (!url) return;
  logLine("[main] Navigating to frontend:", url);
  try {
    mainWindow.loadURL(url);
  } catch (err) {
    logLine("[main] navigateToFrontend error", String(err && err.stack ? err.stack : err));
  }
}

app.whenReady().then(async () => {
  try {
    logLine("[main] whenReady()");
    ensureIconExists();
    logLine("[main] icon", { iconPath: ICON_PATH, iconExists: fs.existsSync(ICON_PATH) });
    logLine("[main] userData", app.getPath("userData"));

    // Create window immediately so the app feels instant.
    logLine("[main] creating window...");
    createWindow();
    logLine("[main] window created");

    // Start backend from Electron main process.
    startBackend();
    waitForHttpOk(`http://127.0.0.1:${BACKEND_PORT}`, BACKEND_READY_TIMEOUT_MS)
      .then(() => logLine("[main] backend ready"))
      .catch((err) => logLine("[main] backend not ready", String(err && err.message ? err.message : err)));

    const hasBuiltFrontend = fs.existsSync(path.join(PROJECT_ROOT, "frontendwebapp", "dist", "index.html"));
    logLine("[main] frontend built?", hasBuiltFrontend);

    if (!hasBuiltFrontend && String(process.env.ELECTRON_DEV || "") === "1") {
      logLine("[main] starting Vite dev server...");
      // If a dev server is already running, use it quickly; otherwise start one and wait in the background.
      waitForHttpOk("http://localhost:5173", 1200)
        .then(() => {
          devFrontendUrl = "http://localhost:5173";
          logLine("[main] Vite already running", devFrontendUrl);
          navigateToFrontend(devFrontendUrl);
        })
        .catch(() => {
          startFrontendDevServer();
          waitForAnyLocalPortOk([5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 5181, 5182, 5183], 30_000)
            .then((port) => {
              devFrontendUrl = `http://localhost:${port}`;
              logLine("[main] Vite ready", devFrontendUrl);
              navigateToFrontend(devFrontendUrl);
            })
            .catch((err2) => {
              logLine("[main] Vite not ready", String(err2 && err2.message ? err2.message : err2));
            });
        });
    } else {
      // Built frontend: load it immediately (no need to wait on Vite).
      navigateToFrontend(getFrontendUrl());
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (err) {
    logLine("[main] fatal during startup", String(err && err.stack ? err.stack : err));
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  stopFrontendDevServer();
  stopBackend();
});
