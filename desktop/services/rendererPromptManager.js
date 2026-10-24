"use strict";

const { randomUUID } = require("crypto");

const SHORTCUT_PROMPT_CHANNEL = "app:shortcut-prompt";
const SHORTCUT_RESPONSE_CHANNEL = "app:shortcut-prompt-response";

function createRendererPromptManager({ ipcMain, getMainWindow, logLine, timeoutMs = 5 * 60_000 }) {
  const pending = new Map();

  ipcMain.handle(SHORTCUT_RESPONSE_CHANNEL, (_event, payload = {}) => {
    const request = pending.get(String(payload.requestId || ""));
    if (!request) return { ok: false };
    clearTimeout(request.timeout);
    pending.delete(request.requestId);
    request.resolve(typeof payload.createShortcut === "boolean" ? payload.createShortcut : null);
    return { ok: true };
  });

  function requestShortcutChoice({ displayName }) {
    const window = getMainWindow?.();
    if (!window || window.isDestroyed?.() || window.webContents.isDestroyed?.()) return Promise.resolve(null);

    const requestId = randomUUID();
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        resolve(null);
        logLine("[shortcut] in-app prompt timed out");
      }, timeoutMs);
      timeout.unref?.();
      pending.set(requestId, { requestId, resolve, timeout });
      window.webContents.send(SHORTCUT_PROMPT_CHANNEL, { requestId, displayName });
    });
  }

  return { requestShortcutChoice };
}

module.exports = {
  SHORTCUT_PROMPT_CHANNEL,
  SHORTCUT_RESPONSE_CHANNEL,
  createRendererPromptManager,
};
