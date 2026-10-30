"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { loadRuntimeConfig } = require("../services/runtimeConfig");

function withResources(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "finledge-runtime-config-test-"));
  const resourcesPath = path.join(root, "resources");
  fs.mkdirSync(resourcesPath);
  try { run(root, resourcesPath); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("packaged AppX and NSIS markers select Testing mode independently of Store status", () => {
  withResources((root, resourcesPath) => {
    fs.writeFileSync(path.join(resourcesPath, "finledge-test-mode.json"), JSON.stringify({ buildType: "appx" }));
    const env = {};
    const config = loadRuntimeConfig({
      app: { isPackaged: true },
      projectRoot: root,
      resourcesPath,
      env,
      logLine: () => {},
    });
    assert.equal(config.isTestingBuild, true);
    assert.equal(config.testBuildType, "appx");
    assert.equal(env.FINLEDGE_MODE, "testing");
  });

  withResources((root, resourcesPath) => {
    fs.writeFileSync(path.join(resourcesPath, "finledge-test-mode.json"), JSON.stringify({ buildType: "exe" }));
    const config = loadRuntimeConfig({
      app: { isPackaged: true },
      projectRoot: root,
      resourcesPath,
      env: {},
      logLine: () => {},
    });
    assert.equal(config.isTestingBuild, true);
    assert.equal(config.testBuildType, "exe");
  });
});

test("only an explicit packaged Store channel marker selects Microsoft Store", () => {
  withResources((root, resourcesPath) => {
    fs.writeFileSync(path.join(resourcesPath, "finledge-build-channel.json"), JSON.stringify({
      distributionChannel: "microsoft-store",
    }));
    const config = loadRuntimeConfig({
      app: { isPackaged: true },
      projectRoot: root,
      resourcesPath,
      env: {},
      logLine: () => {},
    });
    assert.equal(config.isStoreDistribution, true);
    assert.equal(config.isTestingBuild, false);
  });
});

test("combined test marker is recognized and package type comes from Electron runtime", () => {
  withResources((root, resourcesPath) => {
    fs.writeFileSync(path.join(resourcesPath, "finledge-build-channel.json"), JSON.stringify({ kind: "testing" }));
    const appxConfig = loadRuntimeConfig({
      app: { isPackaged: true },
      projectRoot: root,
      resourcesPath,
      isStoreBuild: true,
      env: {},
      logLine: () => {},
    });
    const exeConfig = loadRuntimeConfig({
      app: { isPackaged: true },
      projectRoot: root,
      resourcesPath,
      isStoreBuild: false,
      env: {},
      logLine: () => {},
    });
    assert.equal(appxConfig.isTestingBuild, true);
    assert.equal(appxConfig.testBuildType, "appx");
    assert.equal(exeConfig.isTestingBuild, true);
    assert.equal(exeConfig.testBuildType, "exe");
  });
});

test("legacy AppX test marker remains recognized for safe data migration", () => {
  withResources((root, resourcesPath) => {
    fs.writeFileSync(path.join(resourcesPath, "appx-test-mode.json"), JSON.stringify({
      dataDirectory: "local-app-data/Finledge Testing AppX Test",
      disableLegacyMigration: true,
    }));
    const config = loadRuntimeConfig({
      app: { isPackaged: true },
      projectRoot: root,
      resourcesPath,
      env: {},
      logLine: () => {},
    });
    assert.equal(config.isTestingBuild, true);
    assert.equal(config.testBuildType, "appx");
  });
});

test("release and update policy URLs honor the root environment settings", () => {
  const env = {
    VITE_FINLEDGE_RELEASES_URL: "https://releases.example/finledge",
    FINLEDGE_UPDATE_POLICY_URL: "https://config.example/finledge-policy.json",
  };
  const config = loadRuntimeConfig({
    app: { isPackaged: false },
    projectRoot: path.resolve(__dirname, "..", ".."),
    env,
    logLine: () => {},
  });
  assert.equal(config.releasesUrl, env.VITE_FINLEDGE_RELEASES_URL);
  assert.equal(config.updatePolicyUrl, env.FINLEDGE_UPDATE_POLICY_URL);
});
