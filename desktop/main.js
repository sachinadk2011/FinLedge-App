"use strict";

const { app, BrowserWindow, Menu, ipcMain, screen, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const https = require("https");
const zlib = require("zlib");
const { pathToFileURL } = require("url");
const { spawn } = require("child_process");

const LOG_FILE = path.join(os.tmpdir(), "finledge-electron.log");
const WINDOW_TITLE = "FinLedge";
const GITHUB_RELEASES_URL = "https://github.com/sachinadk2011/FinLedge-App/releases";
const DEFAULT_UPDATE_POLICY_URL =
  "https://raw.githubusercontent.com/sachinadk2011/FinLedge-App/main/update-policy.json";
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
const UPDATE_POLICY_URL = String(process.env.FINLEDGE_UPDATE_POLICY_URL || DEFAULT_UPDATE_POLICY_URL).trim();

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
const SIMULATE_UPDATE_VALUE = IS_ELECTRON_DEV
  ? String(process.env.FINLEDGE_SIMULATE_UPDATE || "").trim().toLowerCase()
  : "";
const SHOULD_SIMULATE_UPDATES = SIMULATE_UPDATE_VALUE === "1" || SIMULATE_UPDATE_VALUE === "available" || SIMULATE_UPDATE_VALUE === "required";
const SIMULATE_REQUIRED_UPDATE = SIMULATE_UPDATE_VALUE === "required";
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

  const cx = width / 2;
  const cy = height / 2;
  const radius = width / 2;
  const corner = 110; // ~43% of size — near-circle but corners still visible
  const minCorner = corner;
  const maxCorner = width - 1 - corner;
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * rowSize + 1 + x * 4;
      let inside = true;
      if (x < minCorner && y < minCorner) {
        // top-left corner circle
        const dx = x - minCorner;
        const dy = y - minCorner;
        inside = dx * dx + dy * dy <= corner * corner;
      } else if (x > maxCorner && y < minCorner) {
        // top-right
        const dx = x - maxCorner;
        const dy = y - minCorner;
        inside = dx * dx + dy * dy <= corner * corner;
      } else if (x < minCorner && y > maxCorner) {
        // bottom-left
        const dx = x - minCorner;
        const dy = y - maxCorner;
        inside = dx * dx + dy * dy <= corner * corner;
      } else if (x > maxCorner && y > maxCorner) {
        // bottom-right
        const dx = x - maxCorner;
        const dy = y - maxCorner;
        inside = dx * dx + dy * dy <= corner * corner;
      }
      if (!inside) {
        raw[i + 3] = 0;
        continue;
      }
      const t = (x + y) / (width + height);
      raw[i] = Math.round(11 + 17 * t);
      raw[i + 1] = Math.round(122 + 34 * t);
      raw[i + 2] = Math.round(118 + 30 * t);
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

  // Block "FL" mark (white) on the teal gradient, matching the branded icons.
  // Centered geometry: bbox x 53..203, y 56..200 (both center at 128).
  const fx = 53;
  const fy = 56;
  // F vertical + top bar + middle bar
  fillRect(fx, fy, 28, 144);
  fillRect(fx, fy, 90, 24);
  fillRect(fx, fy + 60, 70, 22);
  // L vertical + bottom bar
  fillRect(fx + 112, fy, 28, 144);
  fillRect(fx + 112, fy + 118, 38, 22);

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
        <div class="sub">Starting FinLedge...</div>
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

function getReleaseUrl(info) {
  const version = getUpdateVersion(info);
  const normalizedVersion = version.replace(/^v/i, "");
  if (normalizedVersion) {
    return `${GITHUB_RELEASES_URL}/tag/v${normalizedVersion}`;
  }

  return GITHUB_RELEASES_URL;
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}


function normalizeReleaseNotes(notes) {
  if (!notes) return [];
  if (Array.isArray(notes)) {
    return notes
      .map((item) => {
        if (typeof item === "string") return stripHtml(item);
        return stripHtml(item?.note || item?.text || item?.message || "");
      })
      .filter(Boolean)
      .slice(0, 8);
  }
  return stripHtml(notes)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseVersionParts(version) {
  return String(version || "")
    .replace(/^v/i, "")
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(a, b) {
  const left = parseVersionParts(a);
  const right = parseVersionParts(b);
  for (let index = 0; index < 3; index += 1) {
    if ((left[index] || 0) > (right[index] || 0)) return 1;
    if ((left[index] || 0) < (right[index] || 0)) return -1;
  }
  return 0;
}

function fetchJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": `Finledge/${app.getVersion()}`,
          Accept: "application/json",
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Policy request failed with ${res.statusCode || "unknown"} status.`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Policy request timed out.")));
  });
}

async function checkUpdatePolicy({ silent = true } = {}) {
  if (!UPDATE_POLICY_URL) {
    return;
  }

  try {
    const policy = await fetchJson(UPDATE_POLICY_URL);
    const currentVersion = app.getVersion();
    const minimumSupportedVersion = String(policy.minimumSupportedVersion || "").trim();
    const latestVersion = String(policy.latestVersion || "").trim();
    const releaseUrl = String(policy.releaseUrl || GITHUB_RELEASES_URL).trim();
    const releaseNotes = normalizeReleaseNotes(policy.releaseNotes || policy.notes);

    if (minimumSupportedVersion && compareVersions(currentVersion, minimumSupportedVersion) < 0) {
      sendUpdateStatus({
        state: "required",
        title: "Update required",
        detail:
          policy.requiredMessage ||
          `This Finledge version is no longer supported. Please install Finledge ${minimumSupportedVersion} or newer from GitHub Releases.`,
        currentVersion,
        version: latestVersion || minimumSupportedVersion,
        minimumSupportedVersion,
        releaseUrl,
        releaseNotes,
        force: true,
        percent: null,
      });
      return;
    }

    if (latestVersion && compareVersions(currentVersion, latestVersion) < 0 && latestUpdateStatus.state !== "required") {
      sendUpdateStatus({
        state: "available",
        title: "Update available",
        detail:
          policy.availableMessage ||
          `Finledge ${latestVersion} is available on GitHub. Review what changed and download it from the official release page.`,
        currentVersion,
        version: latestVersion,
        minimumSupportedVersion,
        releaseUrl,
        releaseNotes,
        force: false,
        percent: null,
      });
      return;
    }

    if (!silent && latestUpdateStatus.state !== "required") {
      sendUpdateStatus({
        state: "not-available",
        title: "Finledge is up to date",
        detail: "You already have the latest supported version.",
        percent: null,
      });
    }
  } catch (err) {
    logLine("[updater] update policy check failed", String(err && err.stack ? err.stack : err));
    if (!silent) {
      sendUpdateStatus({
        state: "error",
        title: "Update check failed",
        detail: "Finledge could not check the update policy. Please check GitHub Releases manually.",
        releaseUrl: GITHUB_RELEASES_URL,
        error: String(err && err.message ? err.message : err),
      });
    }
  }
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

// ── Dev-only simulation helpers ──────────────────────────────────────────
// Set FINLEDGE_SIMULATE_UPDATE=1 (or FINLEDGE_SIMULATE_UPDATE=required) to
// test how the update notice appears on a real client machine.
function simulateUpdateAvailable() {
  const releaseNotes = normalizeReleaseNotes( [
      "<p>Interactive onboarding tour with spotlight and step animations.</p>",
      "Dividend entries: cash adds to total dividend; bonus shares add to portfolio quantity.",
      "Secondary market buy/sell: enter total amount + quantity, app calculates per-unit price.",
      "Refresh button now appears beside the Finledge logo for quick data reload.",
      "Update notice shows version number and expandable 'What's new' section.",
      "Force-update support via update-policy.json — critical versions can block the app.",
      "Summary overall net corrected: Bank net + Share profit/loss.",
    ]);
  sendUpdateStatus({
    state: "available",
    title: "Update available — Finledge 1.2.0",
    detail: "A new version of Finledge is ready. Download it from GitHub Releases to get the latest features and fixes.",
    version: "1.2.0",
    releaseUrl: GITHUB_RELEASES_URL,
    releaseNotes: releaseNotes,
    force: false,
    isSimulation: true,
  });
  
}

function simulateRequiredUpdate() {
  sendUpdateStatus({
    state: "required",
    title: "Critical update required",
    detail: "This version of Finledge is no longer supported. You must install the latest release to continue.",
    version: "1.2.0",
    minimumSupportedVersion: "1.2.0",
    releaseUrl: GITHUB_RELEASES_URL,
    releaseNotes: [
      "Critical data-integrity fix for share transaction calculations.",
      "Security patch for local file handling.",
    ],
    force: true,
    isSimulation: true,
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
      detail: SIMULATE_REQUIRED_UPDATE
        ? "Simulating a force-required update check..."
        : "Running the test update check...",
      percent: null,
      isSimulation: true,
    });
    setTimeout(
      SIMULATE_REQUIRED_UPDATE ? simulateRequiredUpdate : simulateUpdateAvailable,
      900
    );
    return { ok: true, simulated: true };
  }

  await checkUpdatePolicy({ silent: false });
  if (latestUpdateStatus.state === "required" || latestUpdateStatus.state === "available") {
    return { ok: true, policy: true };
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
    
    return { ok: true };
  } catch (err) {
    showUpdateCheckStatus = false;
    logLine("[updater] Manual check failed", String(err && err.stack ? err.stack : err));
    return { ok: false, reason: "update-check-failed" };
  }
});

ipcMain.handle("app:get-update-status", async () => latestUpdateStatus);

ipcMain.handle("app:get-version", () => app.getVersion());

ipcMain.handle("app:open-update-release", async (_event, releaseUrl) => {
  const targetUrl = String(releaseUrl || latestUpdateStatus.releaseUrl || GITHUB_RELEASES_URL).trim();
  const safeUrl = targetUrl.startsWith("https://github.com/sachinadk2011/FinLedge-App/releases")
    ? targetUrl
    : GITHUB_RELEASES_URL;

  try {
    await shell.openExternal(safeUrl);
    return { ok: true, url: safeUrl };
  } catch (err) {
    logLine("[updater] open release failed", String(err && err.stack ? err.stack : err));
    return { ok: false, reason: "open-release-failed" };
  }
});

ipcMain.handle("app:get-data-locations", async () => {
  const dataDir = getRuntimeDataDir();
  return {
    dataDir,
    bankFile: path.join(dataDir, "bank_transactions.xlsx"),
    shareFile: path.join(dataDir, "share_transactions.xlsx"),
    personalFinanceBankFile: path.join(dataDir, "personal_finance_bank_flow.xlsx"),
    personalFinanceCashFile: path.join(dataDir, "personal_finance_cash_flow.xlsx"),
  };
});

ipcMain.handle("app:open-data-location", async (_event, target = "folder") => {
  const dataDir = getRuntimeDataDir();
  const targetMap = {
    folder: dataDir,
    bank: path.join(dataDir, "bank_transactions.xlsx"),
    share: path.join(dataDir, "share_transactions.xlsx"),
    "pf-bank": path.join(dataDir, "personal_finance_bank_flow.xlsx"),
    "pf-cash": path.join(dataDir, "personal_finance_cash_flow.xlsx"),
  };
  const requestedPath = targetMap[String(target)] || dataDir;
  const pathToOpen = fs.existsSync(requestedPath) ? requestedPath : dataDir;

  try {
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(pathToOpen) && fs.statSync(pathToOpen).isFile()) {
      // shell.openPath opens the file in the default app (e.g. Excel).
      // Do NOT fall back to showItemInFolder — that would open the folder instead.
      await shell.openPath(pathToOpen);
    } else {
      await shell.openPath(pathToOpen);
    }
    return { ok: true, path: pathToOpen };
  } catch (err) {
    logLine("[main] open data location failed", String(err && err.stack ? err.stack : err));
    return { ok: false, reason: "open-data-location-failed" };
  }
});

ipcMain.handle("app:save-export-file", async (_event, payload = {}) => {
  const defaultName = String(payload.defaultName || "finledge-export.xlsx").trim() || "finledge-export.xlsx";
  const base64 = String(payload.base64 || "");
  const isZip = defaultName.toLowerCase().endsWith(".zip");

  if (!base64) {
    return { ok: false, reason: "missing-export-data" };
  }

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Export FinLedge data",
    defaultPath: defaultName,
    filters: isZip
      ? [{ name: "Zip archive", extensions: ["zip"] }]
      : [{ name: "Excel workbook", extensions: ["xlsx"] }],
  });

  if (canceled || !filePath) {
    return { ok: false, cancelled: true };
  }

  try {
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
    return { ok: true, path: filePath };
  } catch (err) {
    logLine("[main] save export file failed", String(err && err.stack ? err.stack : err));
    return { ok: false, reason: "save-export-file-failed" };
  }
});

ipcMain.handle("app:download-update", async () => {
  const targetUrl = String(latestUpdateStatus.releaseUrl || GITHUB_RELEASES_URL).trim();
  const safeUrl = targetUrl.startsWith("https://github.com/sachinadk2011/FinLedge-App/releases")
    ? targetUrl
    : GITHUB_RELEASES_URL;

  try {
    await shell.openExternal(safeUrl);
    return { ok: true, url: safeUrl, simulated: SHOULD_SIMULATE_UPDATES };
  } catch (err) {
    logLine("[updater] open release failed", String(err && err.stack ? err.stack : err));
    return { ok: false, reason: "open-release-failed" };
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
        setTimeout(
          SIMULATE_REQUIRED_UPDATE ? simulateRequiredUpdate : simulateUpdateAvailable,
          2500
        );
      }
    } else {
      navigateToFrontend(getFrontendUrl());
      
      setTimeout(() => {
        if (SHOULD_SIMULATE_UPDATES) {
          simulateUpdateAvailable();
          return;
        }

        checkUpdatePolicy({ silent: true });
        
      }, 5000);
      setInterval(() => checkUpdatePolicy({ silent: true }), 6 * 60 * 60 * 1000);
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
