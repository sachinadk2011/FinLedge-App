"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_UPDATE_POLICY_URL =
  "https://raw.githubusercontent.com/sachinadk2011/FinLedge-App/main/desktop-update-policy.json";

function readBuildChannel(resourcesPath) {
  if (!resourcesPath) return null;
  const markerPaths = [
    path.join(resourcesPath, "finledge-build-channel.json"),
    path.join(resourcesPath, "finledge-test-mode.json"),
    path.join(resourcesPath, "appx-test-mode.json"),
  ];
  for (const markerPath of markerPaths) {
    try {
      const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
      const buildType = String(marker.buildType || (markerPath.endsWith("appx-test-mode.json") ? "appx" : ""))
        .trim()
        .toLowerCase();
      if (["appx", "exe"].includes(buildType)) return { isTestingBuild: true, buildType };
      if (marker.kind === "testing") return {
        isTestingBuild: true,
        buildType: "",
        appxBuildNumber: String(marker.appxBuildNumber || "").trim(),
        appxApplicationId: String(marker.appxApplicationId || "").trim(),
      };
      const distributionChannel = String(marker.distributionChannel || "").trim().toLowerCase();
      if (distributionChannel === "microsoft-store") return {
        isTestingBuild: false,
        buildType: "",
        distributionChannel,
        appxApplicationId: String(marker.appxApplicationId || "").trim(),
      };
      return null;
    } catch {
      // Missing or invalid package markers mean this is not a test build.
    }
  }
  return null;
}

function loadDotEnv(projectRoot, env = process.env) {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !Object.prototype.hasOwnProperty.call(env, key)) env[key] = value;
  }
}

function getPortFromEnv(env, envVarName, defaultPort, logLine) {
  const rawValue = env[envVarName];
  if (rawValue == null || String(rawValue).trim() === "") return defaultPort;
  const parsedPort = Number(rawValue);
  if (Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535) return parsedPort;
  logLine(`[main] Invalid ${envVarName} value, falling back to default port`, { rawValue, defaultPort });
  return defaultPort;
}

function resolvePythonExecutable(projectRoot, env = process.env) {
  const explicit = String(env.FINLEDGE_PYTHON_PATH || "").trim();
  if (explicit && fs.existsSync(explicit)) return explicit;
  const candidates = [
    path.join(projectRoot, "venv", "Scripts", "python.exe"),
    path.join(projectRoot, "venv", "bin", "python"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate))
    || (process.platform === "win32" ? "python" : "python3");
}

function loadRuntimeConfig({ app, projectRoot, resourcesPath, isStoreBuild = false, logLine, env = process.env }) {
  loadDotEnv(projectRoot, env);
  const isDevelopment = String(env.ELECTRON_DEV || "") === "1";
  const buildChannel = app.isPackaged ? readBuildChannel(resourcesPath) : null;
  const isTestingBuild = Boolean(buildChannel?.isTestingBuild);
  env.FINLEDGE_MODE = isTestingBuild
    ? "testing"
    : String(env.FINLEDGE_MODE || (isDevelopment ? "development" : "production"))
    .trim()
    .toLowerCase();

  return {
    projectRoot,
    isDevelopment,
    isTestingBuild,
    testBuildType: buildChannel?.buildType || (isTestingBuild ? (isStoreBuild ? "appx" : "exe") : ""),
    appxBuildNumber: buildChannel?.appxBuildNumber || "",
    appxApplicationId: buildChannel?.appxApplicationId || "",
    isStoreDistribution: buildChannel?.distributionChannel === "microsoft-store",
    backendPort: getPortFromEnv(env, "FINLEDGE_BACKEND_PORT", 8000, logLine),
    frontendPort: getPortFromEnv(env, "FINLEDGE_FRONTEND_PORT", 5173, logLine),
    backendHost: String(env.FINLEDGE_BACKEND_HOST || "127.0.0.1").trim() || "127.0.0.1",
    frontendHost: String(env.FINLEDGE_FRONTEND_HOST || "127.0.0.1").trim() || "127.0.0.1",
    updatePolicyUrl: String(env.FINLEDGE_UPDATE_POLICY_URL || DEFAULT_UPDATE_POLICY_URL).trim(),
    simulateUpdateValue: isDevelopment
      ? String(env.FINLEDGE_SIMULATE_UPDATE || "").trim().toLowerCase()
      : "",
    pythonExecutable: resolvePythonExecutable(projectRoot, env),
  };
}

module.exports = { getPortFromEnv, loadDotEnv, loadRuntimeConfig, resolvePythonExecutable };
