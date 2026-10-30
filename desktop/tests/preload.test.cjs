"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

test("preload resolves backend port through IPC once and caches it", async () => {
  const preloadSource = fs.readFileSync(path.join(__dirname, "..", "preload.js"), "utf8");
  const exposed = {};
  const processStub = { env: { FINLEDGE_BACKEND_HOST: "127.0.0.1" } };
  let calls = 0;
  let portChangeListener = null;
  const sentMessages = [];

  vm.runInNewContext(preloadSource, {
    process: processStub,
    require: () => ({
      contextBridge: {
        exposeInMainWorld: (_name, api) => Object.assign(exposed, api),
      },
      ipcRenderer: {
        on: (channel, listener) => {
          assert.equal(channel, "app:backend-port-changed");
          portChangeListener = listener;
        },
        send: (channel) => sentMessages.push(channel),
        invoke: async (channel) => {
          calls += 1;
          assert.equal(channel, "app:get-backend-port");
          return "8543";
        },
      },
    }),
  });

  processStub.env.FINLEDGE_BACKEND_PORT = "8000";
  assert.equal(await exposed.getBackendBaseUrl(), "http://127.0.0.1:8543");
  assert.equal(await exposed.getBackendBaseUrl(), "http://127.0.0.1:8543");
  assert.equal(calls, 1);
  portChangeListener({}, "8666");
  assert.equal(await exposed.getBackendBaseUrl(), "http://127.0.0.1:8666");
  exposed.reportStartupFirstPaint();
  assert.deepEqual(sentMessages, ["app:startup-first-paint"]);
});
