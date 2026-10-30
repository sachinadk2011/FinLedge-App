"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  buildLatestReleaseUrl,
  buildVersionReleaseUrl,
  parseGitHubRepositoryUrl,
  resolveRepositoryConfig,
} = require("../services/repositoryConfig");
const { loadRuntimeConfig } = require("../services/runtimeConfig");

function withTempDir(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "finledge-repository-config-"));
  try { run(directory); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test("package repository metadata is the public default for release and policy URLs", () => {
  withTempDir((directory) => {
    const desktopDirectory = path.join(directory, "desktop");
    fs.mkdirSync(desktopDirectory);
    fs.writeFileSync(path.join(desktopDirectory, "package.json"), JSON.stringify({
      repository: { url: "https://github.com/example-owner/example-app.git" },
    }));

    const config = resolveRepositoryConfig({ projectRoot: directory, env: {} });
    assert.equal(config.owner, "example-owner");
    assert.equal(config.repo, "example-app");
    assert.equal(config.releasesUrl, "https://github.com/example-owner/example-app/releases");
    assert.equal(config.updatePolicyUrl, "https://raw.githubusercontent.com/example-owner/example-app/main/desktop-update-policy.json");
    assert.equal(buildLatestReleaseUrl(config), "https://github.com/example-owner/example-app/releases/latest");
    assert.equal(buildVersionReleaseUrl(config, "desktop-v2.4.1"), "https://github.com/example-owner/example-app/releases/tag/desktop-v2.4.1");
  });
});

test("electron-builder derives publisher coordinates from the package repository", () => {
  const desktopPackage = require("../package.json");
  const repository = parseGitHubRepositoryUrl(desktopPackage.repository.url);
  assert.ok(repository);
  const publisher = desktopPackage.build.publish.find((item) => item.provider === "github");
  assert.ok(publisher);
  assert.equal(Object.hasOwn(publisher, "owner"), false);
  assert.equal(Object.hasOwn(publisher, "repo"), false);
  assert.equal(repository.owner, "sachinadk2011");
  assert.equal(repository.repo, "FinLedge-App");
});

test("public repository environment overrides produce matching safe URLs", () => {
  const config = resolveRepositoryConfig({
    projectRoot: path.resolve(__dirname, "..", ".."),
    env: { FINLEDGE_GITHUB_OWNER: "fork-owner", FINLEDGE_GITHUB_REPO: "FinLedgeFork" },
  });
  assert.equal(config.repositoryUrl, "https://github.com/fork-owner/FinLedgeFork");
  assert.equal(config.releasesUrl, "https://github.com/fork-owner/FinLedgeFork/releases");
  assert.equal(config.updatePolicyUrl, "https://raw.githubusercontent.com/fork-owner/FinLedgeFork/main/desktop-update-policy.json");

  const invalid = parseGitHubRepositoryUrl("javascript:alert(1)");
  assert.equal(invalid, null);
});

test("packaged runtime reads built public config without relying on a root .env", () => {
  withTempDir((directory) => {
    const resourcesPath = path.join(directory, "resources");
    const configDirectory = path.join(resourcesPath, "frontendwebapp", "dist");
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(path.join(configDirectory, "finledge-public-config.json"), JSON.stringify({
      githubOwner: "packaged-owner",
      githubRepo: "packaged-app",
      releasesUrl: "https://github.com/packaged-owner/packaged-app/releases",
      updatePolicyUrl: "https://raw.githubusercontent.com/packaged-owner/packaged-app/main/desktop-update-policy.json",
    }));
    assert.equal(fs.existsSync(path.join(directory, ".env")), false);

    const config = loadRuntimeConfig({
      app: { isPackaged: true },
      projectRoot: directory,
      resourcesPath,
      env: {},
      logLine: () => {},
    });
    assert.equal(config.githubOwner, "packaged-owner");
    assert.equal(config.githubRepo, "packaged-app");
    assert.equal(config.releasesUrl, "https://github.com/packaged-owner/packaged-app/releases");
    assert.equal(config.updatePolicyUrl, "https://raw.githubusercontent.com/packaged-owner/packaged-app/main/desktop-update-policy.json");
  });
});
