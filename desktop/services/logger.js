"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");

const LOG_FILE = path.join(os.tmpdir(), "finledge-electron.log");

function logLine(...parts) {
  const line = `[${new Date().toISOString()}] ${parts
    .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
    .join(" ")}\n`;

  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // Logging must not prevent the app from starting.
  }

  try {
    console.log(...parts);
  } catch {
    // Logging must not prevent the app from starting.
  }
}

module.exports = { LOG_FILE, logLine };
