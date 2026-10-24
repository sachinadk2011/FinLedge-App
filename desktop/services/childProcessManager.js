"use strict";

const { spawn } = require("child_process");
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
    const packaged = app.isPackaged && !isDevelopment;
    const command = packaged ? getPackagedEnginePath() : getPythonExecutable();
    const args = packaged ? [] : ["-m", "backend.engine_main"];
    const cwd = packaged ? path.dirname(command) : projectRoot;

    if (packaged && !fs.existsSync(command)) {
      throw new Error(`Packaged backend sidecar not found at ${command}`);
    }

    backendProcess = spawn(command, args, {
      cwd,
      env: getBackendEnv(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    backendProcess.on("error", (error) => {
      logLine("[main] Backend launch failed", String(error && error.stack ? error.stack : error));
      backendProcess = null;
    });
    backendProcess.stdout.on("data", (data) => process.stdout.write(`[backend] ${data}`));
    backendProcess.stderr.on("data", (data) => process.stderr.write(`[backend] ${data}`));
    backendProcess.on("exit", (code, signal) => {
      logLine("[main] Backend exited", { code, signal });
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

    const frontendDir = path.join(projectRoot, "frontendwebapp");
    const viteDevArgs = ["run", "dev", "--", "--host", frontendHost, "--port", String(frontendPort)];
    const env = {
      ...process.env,
      VITE_API_BASE_URL: `http://${backendHost}:${backendPort}`,
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

    frontendProcess.stdout.on("data", (data) => process.stdout.write(`[vite] ${data}`));
    frontendProcess.stderr.on("data", (data) => process.stderr.write(`[vite] ${data}`));
    frontendProcess.on("exit", (code, signal) => {
      logLine("[main] Frontend dev server exited", { code, signal });
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

  function waitForAnyLocalPortOk(ports, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const tick = () => {
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
    return devFrontendUrl || `http://${frontendHost}:${frontendPort}`;
  }

  function setDevFrontendUrl(value) {
    devFrontendUrl = value;
  }

  return {
    getFrontendIndexPath,
    startBackend,
    stopBackend,
    startFrontendDevServer,
    stopFrontendDevServer,
    waitForHttpOk,
    waitForAnyLocalPortOk,
    getFrontendUrl,
    getDevFrontendUrl: () => devFrontendUrl,
    setDevFrontendUrl,
  };
}

module.exports = { createChildProcessManager };
