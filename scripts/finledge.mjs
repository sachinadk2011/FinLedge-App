import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
const command = process.argv[2];

function loadEnvFile() {
  const env = {};

  if (!fs.existsSync(envPath)) {
    return env;
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

    env[key] = value;
  }

  return env;
}

function runProcess(commandName, args, extraEnv = {}, cwd = projectRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, {
      cwd,
      stdio: "inherit",
      shell: false,
      env: {
        ...loadEnvFile(),
        ...process.env,
        ...extraEnv,
      },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${commandName} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function runNpmWithEnv(extraEnv, ...args) {
  const npmExecPath = process.env.npm_execpath;
  const commandName = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmExecPath ? [npmExecPath, ...args] : args;
  await runProcess(commandName, commandArgs, extraEnv);
}

function resolvePythonExecutable(env) {
  const explicit = env.FINLEDGE_PYTHON_PATH;
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  const candidates = [
    path.join(projectRoot, "venv", "Scripts", "python.exe"),
    path.join(projectRoot, "venv", "bin", "python"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === "win32" ? "python" : "python3";
}

function getConfig() {
  const env = { ...loadEnvFile(), ...process.env };
  const backendHost = env.FINLEDGE_BACKEND_HOST || "127.0.0.1";
  const frontendHost = env.FINLEDGE_FRONTEND_HOST || "127.0.0.1";
  const backendPort = env.FINLEDGE_BACKEND_PORT || "8000";
  const desktopDevBackendPort = env.FINLEDGE_DESKTOP_DEV_BACKEND_PORT || "8001";
  const desktopDevFrontendPort = env.FINLEDGE_DESKTOP_DEV_FRONTEND_PORT || "5174";
  const desktopProdBackendPort = env.FINLEDGE_DESKTOP_PROD_BACKEND_PORT || "8000";

  return {
    backendHost,
    frontendHost,
    backendPort,
    desktopDevBackendPort,
    desktopDevFrontendPort,
    desktopProdBackendPort,
    pythonExe: resolvePythonExecutable(env),
  };
}

function cleanDesktopArtifacts() {
  const targets = [
    path.join(projectRoot, "desktop", "dist"),
    path.join(projectRoot, "desktop", "build", "sidecar"),
  ];

  for (const target of targets) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Could not remove ${target}:`, error instanceof Error ? error.message : error);
    }
  }
}

async function main() {
  const cfg = getConfig();

  switch (command) {
    case "backend-dev":
      await runProcess(
        cfg.pythonExe,
        ["-m", "backend.engine_main"],
        {
          FINLEDGE_MODE: "development",
          FINLEDGE_BACKEND_HOST: cfg.backendHost,
          FINLEDGE_BACKEND_PORT: cfg.backendPort,
        }
      );
      return;

    case "backend-reload":
      await runProcess(
        cfg.pythonExe,
        [
          "-m",
          "uvicorn",
          "backend.main:app",
          "--reload",
          "--host",
          cfg.backendHost,
          "--port",
          cfg.backendPort,
        ],
        {
          FINLEDGE_MODE: "development",
          FINLEDGE_BACKEND_HOST: cfg.backendHost,
          FINLEDGE_BACKEND_PORT: cfg.backendPort,
        }
      );
      return;

    case "desktop-dev": {
      const apiBase = `http://${cfg.backendHost}:${cfg.desktopDevBackendPort}`;
      await runNpmWithEnv(
        {
          ELECTRON_DEV: "1",
          FINLEDGE_MODE: "development",
          FINLEDGE_BACKEND_HOST: cfg.backendHost,
          FINLEDGE_BACKEND_PORT: cfg.desktopDevBackendPort,
          FINLEDGE_FRONTEND_HOST: cfg.frontendHost,
          FINLEDGE_FRONTEND_PORT: cfg.desktopDevFrontendPort,
          VITE_API_BASE_URL: apiBase,
        },
        "start",
        "--prefix",
        "desktop"
      );
      return;
    }

    case "desktop-build":
    case "desktop-build-publish": {
      cleanDesktopArtifacts();
      const apiBase = `http://${cfg.backendHost}:${cfg.desktopProdBackendPort}`;
      const commonEnv = {
        FINLEDGE_MODE: "production",
        FINLEDGE_BACKEND_HOST: cfg.backendHost,
        FINLEDGE_BACKEND_PORT: cfg.desktopProdBackendPort,
        VITE_API_BASE_URL: apiBase,
      };

      await runNpmWithEnv(commonEnv, "run", "build:frontend");
      await runNpmWithEnv(commonEnv, "run", "build:sidecar");

      if (command === "desktop-build-publish") {
        await runNpmWithEnv(commonEnv, "run", "build", "--prefix", "desktop", "--", "--publish", "always");
      } else {
        await runNpmWithEnv(commonEnv, "run", "build:desktop");
      }
      return;
    }

    default:
      throw new Error(`Unknown FinLedge command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
