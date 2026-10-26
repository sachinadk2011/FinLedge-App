"use strict";

const { spawn } = require("child_process");
const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

function createChildProcessManager({
  app,
  projectRoot,
  backendHost,
  backendPort,
  frontendHost,
  frontendPort,
  isDevelopment,
  iconPath,
  getBackendEnv,
  getPythonExecutable,
  logLine,
}) {
  let backendProcess = null;
  let frontendProcess = null;
  let activeBackendPort = backendPort;
  let activeFrontendPort = frontendPort;
  let backendInstanceToken = "";
  let backendStopPromise = null;
  let frontendStopPromise = null;
  let devFrontendUrl = null;

  function getFrontendIndexPath() {
    return app.isPackaged
      ? path.join(process.resourcesPath, "frontendwebapp", "dist", "index.html")
      : path.join(projectRoot, "frontendwebapp", "dist", "index.html");
  }

  function getPackagedEnginePath() {
    return path.join(process.resourcesPath, "engine", "finledge-engine.exe");
  }

  function startBackend() {
    if (backendProcess) return;
    const packaged = app.isPackaged && !isDevelopment;
    const command = packaged ? getPackagedEnginePath() : getPythonExecutable();
    const args = packaged ? [] : ["-m", "backend.engine_main"];
    const cwd = packaged ? path.dirname(command) : projectRoot;

    if (packaged && !fs.existsSync(command)) {
      throw new Error(`Packaged backend sidecar not found at ${command}`);
    }

    backendInstanceToken = crypto.randomUUID();
    backendProcess = spawn(command, args, {
      cwd,
      env: {
        ...getBackendEnv(),
        FINLEDGE_BACKEND_INSTANCE_TOKEN: backendInstanceToken,
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    backendProcess.on("error", (error) => {
      logLine("[main] Backend launch failed", String(error && error.stack ? error.stack : error));
      backendProcess = null;
    });
    backendProcess.stdout.on("data", (data) => {
      logLine("[backend] stdout", String(data).trimEnd());
      process.stdout.write(`[backend] ${data}`);
    });
    backendProcess.stderr.on("data", (data) => {
      logLine("[backend] stderr", String(data).trimEnd());
      process.stderr.write(`[backend] ${data}`);
    });
    backendProcess.on("exit", (code, signal) => {
      logLine("[main] Backend exited", { code, signal });
      backendProcess = null;
    });
  }

  function stopBackend() {
    if (backendStopPromise) return backendStopPromise;
    const child = backendProcess;
    if (!child) return Promise.resolve();
    backendStopPromise = stopChildTree(child, "backend").finally(() => {
      if (backendProcess === child) backendProcess = null;
      backendStopPromise = null;
    });
    return backendStopPromise;
  }

  function startFrontendDevServer() {
    if (frontendProcess) return;

    const frontendDir = path.join(projectRoot, "frontendwebapp");
    const viteDevArgs = ["run", "dev", "--", "--host", frontendHost, "--port", String(activeFrontendPort), "--strictPort"];
    const env = {
      ...process.env,
      FINLEDGE_FRONTEND_PORT: String(activeFrontendPort),
      FINLEDGE_BACKEND_PORT: String(activeBackendPort),
      VITE_API_BASE_URL: `http://${backendHost}:${activeBackendPort}`,
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
    } catch (error) {
      logLine("[main] Failed to spawn frontend dev server", String(error && error.stack ? error.stack : error));
      frontendProcess = null;
      return;
    }

    frontendProcess.on("error", (error) => {
      logLine("[main] Development server launch failed", String(error?.stack || error));
      frontendProcess = null;
    });
    frontendProcess.stdout.on("data", (data) => process.stdout.write(`[vite] ${data}`));
    frontendProcess.stderr.on("data", (data) => process.stderr.write(`[vite] ${data}`));
    frontendProcess.on("exit", (code, signal) => {
      logLine("[main] Frontend dev server exited", { code, signal });
      frontendProcess = null;
    });
  }

  function stopFrontendDevServer() {
    if (frontendStopPromise) return frontendStopPromise;
    const child = frontendProcess;
    if (!child) return Promise.resolve();
    frontendStopPromise = stopChildTree(child, "Vite").finally(() => {
      if (frontendProcess === child) frontendProcess = null;
      frontendStopPromise = null;
    });
    return frontendStopPromise;
  }

  function stopChildTree(child, label) {
    return new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(forceTimer);
        child.removeListener("close", finish);
        child.removeListener("error", finish);
        logLine(`[main] ${label} process stopped`);
        resolve();
      };
      const forceTimer = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch { /* already exited */ }
        finish();
      }, 5000);
      child.once("close", finish);
      child.once("error", finish);

      if (process.platform === "win32" && child.pid) {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
        killer.once("error", () => {
          try { child.kill(); } catch { /* already exited */ }
        });
        killer.once("close", (code) => {
          if (code !== 0) {
            try { child.kill(); } catch { /* already exited */ }
          }
        });
      } else {
        try { child.kill(); } catch { finish(); }
      }
    });
  }

  function waitForHttpOk(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const tick = () => {
        const request = http.get(url, (response) => {
          response.resume();
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
            resolve();
            return;
          }
          if (Date.now() >= deadline) reject(new Error(`Timeout waiting for ${url}`));
          else setTimeout(tick, 500);
        });
        request.on("error", () => {
          if (Date.now() >= deadline) reject(new Error(`Timeout waiting for ${url}`));
          else setTimeout(tick, 500);
        });
        request.setTimeout(400, () => request.destroy());
      };
      tick();
    });
  }

  function waitForBackendReady(timeoutMs) {
    const child = backendProcess;
    if (!child?.pid) return Promise.reject(new Error("FinLedge backend is not running."));
    const url = `http://${backendHost}:${activeBackendPort}/health`;
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const tick = () => {
        if (child.exitCode !== null || child.signalCode !== null || backendProcess !== child) {
          reject(new Error("FinLedge backend stopped before it became ready."));
          return;
        }
        const request = http.get(url, (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => { body += chunk; });
          response.on("end", () => {
            try {
              const health = JSON.parse(body);
              if (response.statusCode === 200 && health.instance === backendInstanceToken) {
                resolve();
                return;
              }
              if (response.statusCode === 200) {
                logLine("[main] backend health response did not match this launch", {
                  pid: health.pid,
                  hasInstanceToken: Boolean(health.instance),
                });
              }
            } catch { /* A different service answered this port. */ }
            retry();
          });
        });
        request.on("error", retry);
        request.setTimeout(500, () => request.destroy());
      };
      const retry = () => {
        if (Date.now() >= deadline) {
          reject(new Error("Timed out waiting for the FinLedge backend on its assigned port."));
        } else {
          setTimeout(tick, 250);
        }
      };
      tick();
    });
  }

  function waitForAnyLocalPortOk(ports, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const tick = () => {
        if (!frontendProcess || frontendProcess.exitCode !== null || frontendProcess.signalCode !== null) {
          reject(new Error("FinLedge's development server exited before becoming ready."));
          return;
        }
        let portIndex = 0;
        const tryNextPort = () => {
          if (portIndex >= ports.length) {
            if (Date.now() >= deadline) reject(new Error("Timeout waiting for frontend dev server"));
            else setTimeout(tick, 500);
            return;
          }
          const port = ports[portIndex++];
          const urls = [`http://${frontendHost}:${port}`, `http://localhost:${port}`];
          let urlIndex = 0;
          const tryNextUrl = () => {
            if (urlIndex >= urls.length) {
              tryNextPort();
              return;
            }
            const url = urls[urlIndex++];
            const request = http.get(url, (response) => {
              response.resume();
              if (!frontendProcess || frontendProcess.exitCode !== null || frontendProcess.signalCode !== null) {
                reject(new Error("FinLedge's development server stopped during startup."));
                return;
              }
              resolve(url);
            });
            request.on("error", tryNextUrl);
            request.setTimeout(400, () => request.destroy());
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
    if (explicit) return explicit;
    const builtIndex = getFrontendIndexPath();
    if (fs.existsSync(builtIndex)) return pathToFileURL(builtIndex).toString();
    return devFrontendUrl || `http://${frontendHost}:${activeFrontendPort}`;
  }

  function setBackendPort(port) {
    activeBackendPort = Number(port);
  }

  function setFrontendPort(port) {
    activeFrontendPort = Number(port);
  }

  function setDevFrontendUrl(value) {
    devFrontendUrl = value;
  }

  return {
    getFrontendIndexPath,
    setBackendPort,
    setFrontendPort,
    startBackend,
    stopBackend,
    startFrontendDevServer,
    stopFrontendDevServer,
    waitForHttpOk,
    waitForBackendReady,
    waitForAnyLocalPortOk,
    getFrontendUrl,
    getDevFrontendUrl: () => devFrontendUrl,
    setDevFrontendUrl,
  };
}

module.exports = { createChildProcessManager };
