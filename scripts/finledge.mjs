import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
const mobileRoot = path.join(projectRoot, "mobile");
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
      shell: process.platform === "win32" ? true : false,
      env: {
        ...loadEnvFile(),
        ...process.env,
        ...extraEnv,
      },
    });

    const env = { ...loadEnvFile(), ...process.env };
    const isCustomPythonEnv = Boolean(env.FINLEDGE_PYTHON_PATH && commandName === env.FINLEDGE_PYTHON_PATH);
    const displayCommand = isCustomPythonEnv ? "FINLEDGE_PYTHON_PATH" : commandName;

    child.on("error", (err) => {
      const message = err instanceof Error ? err.message : String(err);
      reject(new Error(`Failed to start ${displayCommand}: ${message}`));
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${displayCommand} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function runNpmWithEnv(extraEnv, ...args) {
  const commandName = process.platform === "win32" ? "npm.cmd" : "npm";
  await runProcess(commandName, args, extraEnv);
}

async function runMobileNpm(...args) {
  const commandName = process.platform === "win32" ? "npm.cmd" : "npm";
  await runProcess(commandName, args, {}, mobileRoot);
}

async function runMobileNpx(...args) {
  const commandName = process.platform === "win32" ? "npx.cmd" : "npx";
  await runProcess(commandName, args, {}, mobileRoot);
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
  const desktopDevBackendPort = env.FINLEDGE_DESKTOP_DEV_BACKEND_PORT || "8401";
  const desktopDevFrontendPort = env.FINLEDGE_DESKTOP_DEV_FRONTEND_PORT || "8451";
  const desktopExeBackendPort = env.FINLEDGE_DESKTOP_EXE_BACKEND_PORT || "8001";
  const desktopTestExeBackendPort = env.FINLEDGE_TEST_EXE_BACKEND_PORT || "8201";

  return {
    backendHost,
    frontendHost,
    backendPort,
    desktopDevBackendPort,
    desktopDevFrontendPort,
    desktopExeBackendPort,
    desktopTestExeBackendPort,
    pythonExe: resolvePythonExecutable(env),
  };
}

function getAppxApplicationId() {
  const configPath = path.join(projectRoot, "desktop", "appx-package-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return String(config.appx?.applicationId || "Finledge").trim();
}

function cleanDesktopArtifacts(outputDirectory = "dist") {
  const targets = [
    path.join(projectRoot, "desktop", outputDirectory),
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

async function buildDesktopRuntime(commonEnv) {
  await runNpmWithEnv(commonEnv, "run", "build:frontend");
  await runNpmWithEnv(commonEnv, "run", "build:sidecar");
}

function nextTestAppxBuildNumber(certPath) {
  const statePath = path.join(projectRoot, "desktop", "build", "finledge-appx-test-build-number.txt");
  const legacyStatePath = path.join(path.dirname(path.resolve(certPath)), "finledge-appx-test-build-number.txt");
  let previous = 0;
  for (const candidate of [statePath, legacyStatePath]) {
    try {
      const storedValue = fs.readFileSync(candidate, "utf8").trim();
      if (!/^\d+$/.test(storedValue)) {
        throw new Error(`Invalid AppX test build counter in ${candidate}.`);
      }
      previous = Math.max(previous, Number(storedValue));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const next = previous + 1;
  if (next > 65535) {
    throw new Error("The AppX test build revision reached 65535. Increase the app version before building again.");
  }
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${next}\n`, "utf8");
  return next;
}

function copyStagedTestArtifacts(stagingDirectory, outputDirectory) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const candidates = fs.readdirSync(stagingDirectory).filter((file) => /\.(appx|exe|blockmap)$/i.test(file));
  const copied = [];
  for (const file of candidates) {
    const source = path.join(stagingDirectory, file);
    const destination = path.join(outputDirectory, file);
    fs.copyFileSync(source, destination);
    copied.push(destination);
  }
  return copied;
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
      const apiBase = `http://${cfg.backendHost}:${cfg.desktopExeBackendPort}`;
      const appxApplicationId = getAppxApplicationId();
      const commonEnv = {
        FINLEDGE_MODE: "production",
        FINLEDGE_DISTRIBUTION_CHANNEL: "microsoft-store",
        FINLEDGE_APPX_APPLICATION_ID: appxApplicationId,
        FINLEDGE_BACKEND_HOST: cfg.backendHost,
        FINLEDGE_BACKEND_PORT: cfg.desktopExeBackendPort,
        VITE_API_BASE_URL: apiBase,
      };

      await buildDesktopRuntime(commonEnv);

      if (command === "desktop-build") {
        await runNpmWithEnv(commonEnv, "run", "build", "--prefix", "desktop", "--", "--publish", "never");
      } else if (command === "desktop-build-publish") {
        await runNpmWithEnv(commonEnv, "run", "build", "--prefix", "desktop", "--", "--publish", "always");
      }
      return;
    }

    case "desktop-test-build": {
      if (process.platform !== "win32") {
        throw new Error("The local Windows test packages must be built on Windows.");
      }

      const buildEnv = { ...loadEnvFile(), ...process.env };
      const certPath = buildEnv.FINLEDGE_TEST_CERT_PATH;
      if (!certPath || !fs.existsSync(certPath)) {
        throw new Error("Set FINLEDGE_TEST_CERT_PATH to an existing test signing certificate (.pfx) before building both Windows test packages.");
      }

      const appxConfigPath = path.join(projectRoot, "desktop", "appx-package-config.json");
      const appxConfig = JSON.parse(fs.readFileSync(appxConfigPath, "utf8")).appx;
      const identityValues = [appxConfig?.identityName, appxConfig?.publisher, appxConfig?.publisherDisplayName];
      if (identityValues.some((value) => !value || value.includes("REPLACE_WITH"))) {
        throw new Error("Fill identityName, publisher, and publisherDisplayName in desktop/appx-package-config.json before building.");
      }

      const appxBuildNumber = nextTestAppxBuildNumber(certPath);
      const testUpdatePolicyDirectory = path.join(projectRoot, "desktop", "test-update-policy");
      const testUpdatePolicyPath = path.join(testUpdatePolicyDirectory, "desktop-update-policy.json");
      fs.mkdirSync(testUpdatePolicyDirectory, { recursive: true });
      if (!fs.existsSync(testUpdatePolicyPath)) {
        fs.copyFileSync(
          path.join(projectRoot, "desktop", "services", "test-update-policy.example.json"),
          testUpdatePolicyPath
        );
      }
      const apiBase = `http://${cfg.backendHost}:${cfg.desktopTestExeBackendPort}`;
      const commonEnv = {
        FINLEDGE_MODE: "testing",
        FINLEDGE_APPX_APPLICATION_ID: "FinledgeTesting",
        FINLEDGE_BACKEND_HOST: cfg.backendHost,
        FINLEDGE_BACKEND_PORT: cfg.desktopTestExeBackendPort,
        VITE_API_BASE_URL: apiBase,
        BUILD_NUMBER: String(appxBuildNumber),
        FINLEDGE_TEST_UPDATE_POLICY_DIR: testUpdatePolicyDirectory,
        WIN_CSC_LINK: certPath,
        ...(buildEnv.FINLEDGE_TEST_CERT_PASSWORD
          ? { WIN_CSC_KEY_PASSWORD: buildEnv.FINLEDGE_TEST_CERT_PASSWORD }
          : {}),
      };

      await buildDesktopRuntime(commonEnv);
      const outputDir = path.join(projectRoot, "desktop", "dist");
      const buildRoot = path.resolve(projectRoot, "desktop", "build");
      const stagingDirectory = path.resolve(buildRoot, `test-output-${appxBuildNumber}`);
      if (!stagingDirectory.startsWith(`${buildRoot}${path.sep}`)) {
        throw new Error("The temporary test build path is outside desktop/build.");
      }
      const relativeStagingDirectory = path.relative(path.join(projectRoot, "desktop"), stagingDirectory);
      fs.rmSync(stagingDirectory, { recursive: true, force: true });

      let artifacts = [];
      try {
        await runNpmWithEnv(
          commonEnv,
          "run",
          "build",
          "--prefix",
          "desktop",
          "--",
          "--win",
          "nsis",
          "appx",
          "--x64",
          "--publish",
          "never",
          "--config.appId=com.finledge.tracker.testing",
          "--config.productName=Finledge-Testing",
          `--config.directories.output=${relativeStagingDirectory}`,
          "--config.win.artifactName=Finledge-Testing-EXE-Setup-${version}-r" + appxBuildNumber + ".${ext}",
          `--config.appx.identityName=${appxConfig.identityName}.Testing`,
          "--config.appx.applicationId=FinledgeTesting",
          "--config.appx.displayName=Finledge-Testing",
          "--config.appx.setBuildNumber=true",
          "--config.appx.artifactName=Finledge-Testing-${version}-r" + appxBuildNumber + ".${ext}"
        );

        artifacts = copyStagedTestArtifacts(stagingDirectory, outputDir);
        if (!artifacts.some((file) => file.toLowerCase().endsWith(".appx")) ||
            !artifacts.some((file) => file.toLowerCase().endsWith(".exe"))) {
          throw new Error(`The combined test build did not produce both AppX and NSIS packages in ${stagingDirectory}.`);
        }
      } finally {
        try {
          fs.rmSync(stagingDirectory, { recursive: true, force: true });
        } catch (error) {
          console.warn(`Could not remove temporary test build output ${stagingDirectory}:`, error instanceof Error ? error.message : error);
        }
      }

      console.log(`Combined AppX and EXE test packages (AppX revision ${appxBuildNumber}):`);
      for (const artifact of artifacts.filter((file) => /\.(appx|exe)$/i.test(file))) console.log(artifact);
      return;
    }

    case "mobile-build":
      await runMobileNpm("run", "build");
      return;

    case "mobile-test":
      await runMobileNpm("test");
      return;

    case "mobile-sync-android":
      await runMobileNpm("run", "cap:sync:android");
      return;

    case "mobile-android":
      await runMobileNpm("run", "build");
      await runMobileNpm("run", "cap:sync:android");
      return;

    case "mobile-android-run":
      // Build + sync, then install and launch on the connected device.
      await runMobileNpm("run", "build");
      await runMobileNpm("run", "cap:sync:android");
      await runMobileNpx("cap", "run", "android");
      return;

    default:
      throw new Error(`Unknown FinLedge command: ${command}`);
  }
}

main().catch((error) => {
  console.error("FinLedge command failed.");
  console.error(error?.stack || error);
  process.exit(1);
});
