"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function acquireClientInstanceLock({
  directory,
  pid = process.pid,
  fileSystem = fs,
  processIsAlive = isProcessAlive,
} = {}) {
  if (!directory) throw new TypeError("A client user-data directory is required.");

  const lockPath = path.join(directory, "finledge-client.lock");
  const token = `${pid}:${crypto.randomUUID()}`;
  fileSystem.mkdirSync(directory, { recursive: true });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let descriptor;
    try {
      descriptor = fileSystem.openSync(lockPath, "wx");
      fileSystem.writeFileSync(descriptor, token, "utf8");
      fileSystem.closeSync(descriptor);
      descriptor = undefined;
      let released = false;
      return {
        acquired: true,
        lockPath,
        release() {
          if (released) return;
          released = true;
          try {
            if (fileSystem.readFileSync(lockPath, "utf8") === token) {
              fileSystem.unlinkSync(lockPath);
            }
          } catch (error) {
            if (error?.code !== "ENOENT") throw error;
          }
        },
      };
    } catch (error) {
      if (descriptor !== undefined) {
        try { fileSystem.closeSync(descriptor); } catch { /* keep the original failure */ }
      }
      if (error?.code !== "EEXIST") throw error;

      let existingPid = 0;
      try {
        const existingToken = fileSystem.readFileSync(lockPath, "utf8");
        existingPid = Number.parseInt(existingToken.split(":", 1)[0], 10);
      } catch (readError) {
        if (readError?.code === "ENOENT") continue;
      }
      if (processIsAlive(existingPid)) {
        return { acquired: false, lockPath, release() {} };
      }

      try {
        fileSystem.unlinkSync(lockPath);
      } catch (unlinkError) {
        if (unlinkError?.code !== "ENOENT") throw unlinkError;
      }
    }
  }

  return { acquired: false, lockPath, release() {} };
}

module.exports = { acquireClientInstanceLock, isProcessAlive };
