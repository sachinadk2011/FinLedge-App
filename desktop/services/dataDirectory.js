"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const LOCK_FILE_NAME = ".finledge.lock";
const LOCATION_FILE_NAME = ".finledge-data-location.json";
const LOCK_HEARTBEAT_MS = 5_000;
const LOCK_STALE_MS = 30_000;

function readSavedLocation(documentsDir, userDataDir, fileSystem = fs) {
  const candidates = [
    path.join(documentsDir, LOCATION_FILE_NAME),
    path.join(userDataDir, LOCATION_FILE_NAME),
  ];
  for (const candidate of candidates) {
    try {
      const config = JSON.parse(fileSystem.readFileSync(candidate, "utf8"));
      const dataDir = String(config?.dataDir || "").trim();
      if (dataDir) return path.resolve(dataDir);
    } catch {
      // Missing or unreadable preferences leave the standard location in use.
    }
  }
  return null;
}

function resolveDataDirectory({
  explicitPath,
  isDevelopment = false,
  projectRoot,
  documentsDir,
  userDataDir,
  homeDir = os.homedir(),
  fileSystem = fs,
}) {
  if (String(explicitPath || "").trim()) return path.resolve(explicitPath);
  if (isDevelopment) {
    return path.resolve(userDataDir || path.join(projectRoot, ".finledge-dev-data"));
  }

  const documents = documentsDir || path.join(homeDir, "Documents");
  return readSavedLocation(documents, userDataDir || "", fileSystem)
    || path.join(documents, "FinLedge");
}

function ensureWritableDirectory(dataDir, { fileSystem = fs, processId = process.pid } = {}) {
  const resolved = path.resolve(dataDir);
  fileSystem.mkdirSync(resolved, { recursive: true });
  const probe = path.join(resolved, `.finledge-write-check-${processId}-${crypto.randomUUID()}`);
  const descriptor = fileSystem.openSync(probe, "wx", 0o600);
  fileSystem.closeSync(descriptor);
  fileSystem.unlinkSync(probe);
  return resolved;
}

function getBuildType({
  isStoreBuild = false,
  isStoreDistribution = false,
  isPackaged = false,
  isDevelopment = false,
  isTestingBuild = false,
} = {}) {
  if (isTestingBuild) return "Testing";
  if (isDevelopment || !isPackaged) return "Development";
  if (isStoreBuild && isStoreDistribution) return "Microsoft Store";
  if (isStoreBuild) return "AppX Package";
  return "Installer";
}

function readLock(lockPath, fileSystem, now, staleMs) {
  try {
    const lock = JSON.parse(fileSystem.readFileSync(lockPath, "utf8"));
    const heartbeat = Date.parse(lock.heartbeatAt || lock.startedAt || "");
    return { lock, stale: !Number.isFinite(heartbeat) || now - heartbeat > staleMs };
  } catch {
    try {
      const age = now - fileSystem.statSync(lockPath).mtimeMs;
      return { lock: null, stale: age > staleMs };
    } catch {
      return { lock: null, stale: true };
    }
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(Number(pid)) || Number(pid) <= 0) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function acquireDataDirectoryLock(dataDir, {
  buildType,
  fileSystem = fs,
  processId = process.pid,
  now = Date.now,
  processIsAlive = isProcessAlive,
  heartbeatMs = LOCK_HEARTBEAT_MS,
  staleMs = LOCK_STALE_MS,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  const lockPath = path.join(path.resolve(dataDir), LOCK_FILE_NAME);
  const token = crypto.randomUUID();
  const lockData = {
    pid: processId,
    buildType: buildType || "Unknown",
    startedAt: new Date(now()).toISOString(),
    heartbeatAt: new Date(now()).toISOString(),
    token,
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let descriptor;
    try {
      descriptor = fileSystem.openSync(lockPath, "wx", 0o600);
      fileSystem.writeFileSync(descriptor, JSON.stringify(lockData));
      fileSystem.closeSync(descriptor);
      descriptor = null;
      break;
    } catch (error) {
      if (descriptor !== undefined) {
        try { fileSystem.closeSync(descriptor); } catch { /* best effort */ }
      }
      if (error?.code !== "EEXIST") throw error;

      const current = readLock(lockPath, fileSystem, now(), staleMs);
      const ownerAlive = current.lock && processIsAlive(current.lock.pid);
      if (!current.stale && (ownerAlive || !current.lock)) {
        return { acquired: false, lockPath, owner: current.lock };
      }

      try {
        fileSystem.unlinkSync(lockPath);
      } catch (unlinkError) {
        if (unlinkError?.code !== "ENOENT") throw unlinkError;
      }
    }
  }

  let released = false;
  const heartbeat = setIntervalFn(() => {
    if (released) return;
    try {
      const current = JSON.parse(fileSystem.readFileSync(lockPath, "utf8"));
      if (current.token !== token) return;
      lockData.heartbeatAt = new Date(now()).toISOString();
      fileSystem.writeFileSync(lockPath, JSON.stringify(lockData));
    } catch {
      // The lock remains conservative: another process treats a fresh malformed
      // lock as occupied until it can verify the recorded owner.
    }
  }, heartbeatMs);
  heartbeat?.unref?.();

  return {
    acquired: true,
    lockPath,
    release() {
      if (released) return;
      released = true;
      clearIntervalFn(heartbeat);
      try {
        const current = JSON.parse(fileSystem.readFileSync(lockPath, "utf8"));
        if (current.token === token) fileSystem.unlinkSync(lockPath);
      } catch {
        // Missing or unreadable lock files need no cleanup.
      }
    },
  };
}

function persistDataDirectory(dataDir, { documentsDir, userDataDir, fileSystem = fs }) {
  const payload = `${JSON.stringify({ dataDir: path.resolve(dataDir) }, null, 2)}\n`;
  const candidates = [documentsDir, userDataDir].filter(Boolean);
  let lastError;
  for (const directory of candidates) {
    const target = path.join(directory, LOCATION_FILE_NAME);
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    try {
      fileSystem.mkdirSync(directory, { recursive: true });
      fileSystem.writeFileSync(temporary, payload, { flag: "wx" });
      fileSystem.renameSync(temporary, target);
      return { savedTo: target };
    } catch (error) {
      lastError = error;
      try { fileSystem.unlinkSync(temporary); } catch { /* temporary was not created */ }
    }
  }
  return { savedTo: null, error: lastError };
}

module.exports = {
  LOCK_FILE_NAME,
  acquireDataDirectoryLock,
  ensureWritableDirectory,
  getBuildType,
  persistDataDirectory,
  resolveDataDirectory,
};
