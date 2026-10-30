"use strict";

const fs = require("fs");
const path = require("path");

const REPOSITORY_SEGMENT_PATTERN = /^[A-Za-z0-9_.-]+$/;

function normalizeRepositorySegment(value) {
  const segment = String(value || "").trim();
  return segment && segment !== "." && segment !== ".." && REPOSITORY_SEGMENT_PATTERN.test(segment)
    ? segment
    : "";
}

function parseGitHubRepositoryUrl(value) {
  try {
    const url = new URL(String(value || "").trim().replace(/\.git$/i, ""));
    const [owner, repo, ...extra] = url.pathname.split("/").filter(Boolean);
    const normalizedOwner = normalizeRepositorySegment(owner);
    const normalizedRepo = normalizeRepositorySegment(repo);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com"
      || !normalizedOwner || !normalizedRepo || extra.length) return null;
    return { owner: normalizedOwner, repo: normalizedRepo };
  } catch {
    return null;
  }
}

function readPackageRepository(projectRoot, fileSystem = fs) {
  const candidates = [
    projectRoot && path.join(projectRoot, "desktop", "package.json"),
    path.resolve(__dirname, "..", "package.json"),
  ].filter(Boolean);

  for (const packagePath of [...new Set(candidates)]) {
    try {
      const manifest = JSON.parse(fileSystem.readFileSync(packagePath, "utf8"));
      const repository = parseGitHubRepositoryUrl(manifest.repository?.url);
      if (repository) return repository;
    } catch {
      // Try the next package manifest candidate.
    }
  }
  return null;
}

function readPackagedPublicConfig(resourcesPath, fileSystem = fs) {
  if (!resourcesPath) return null;
  const configPath = path.join(resourcesPath, "frontendwebapp", "dist", "finledge-public-config.json");
  try {
    const config = JSON.parse(fileSystem.readFileSync(configPath, "utf8"));
    const repository = {
      owner: normalizeRepositorySegment(config.githubOwner),
      repo: normalizeRepositorySegment(config.githubRepo),
    };
    if (!repository.owner || !repository.repo) return null;
    return {
      ...repository,
      releasesUrl: normalizeHttpsUrl(config.releasesUrl),
      updatePolicyUrl: normalizeHttpsUrl(config.updatePolicyUrl),
    };
  } catch {
    return null;
  }
}

function normalizeHttpsUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" ? url.href.replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}

function buildRepositoryUrl({ owner, repo }) {
  const normalizedOwner = normalizeRepositorySegment(owner);
  const normalizedRepo = normalizeRepositorySegment(repo);
  return normalizedOwner && normalizedRepo
    ? `https://github.com/${normalizedOwner}/${normalizedRepo}`
    : "";
}

function buildLatestReleaseUrl(repository) {
  const base = buildRepositoryUrl(repository);
  return base ? `${base}/releases/latest` : "";
}

function buildVersionReleaseUrl(repository, tag) {
  const base = buildRepositoryUrl(repository);
  const releaseTag = String(tag || "").trim();
  return base && releaseTag ? `${base}/releases/tag/${encodeURIComponent(releaseTag)}` : "";
}

function buildUpdatePolicyUrl(repository) {
  const owner = normalizeRepositorySegment(repository?.owner);
  const repo = normalizeRepositorySegment(repository?.repo);
  return owner && repo
    ? `https://raw.githubusercontent.com/${owner}/${repo}/main/desktop-update-policy.json`
    : "";
}

function resolveRepositoryConfig({ projectRoot, resourcesPath, env = process.env, fileSystem = fs } = {}) {
  const packageRepository = readPackageRepository(projectRoot, fileSystem) || { owner: "", repo: "" };
  const packagedConfig = readPackagedPublicConfig(resourcesPath, fileSystem) || {};
  const owner = normalizeRepositorySegment(env.FINLEDGE_GITHUB_OWNER)
    || packagedConfig.owner
    || packageRepository.owner;
  const repo = normalizeRepositorySegment(env.FINLEDGE_GITHUB_REPO)
    || packagedConfig.repo
    || packageRepository.repo;
  const repository = { owner, repo };
  const repositoryUrl = buildRepositoryUrl(repository);
  const releasesUrl = normalizeHttpsUrl(env.VITE_FINLEDGE_RELEASES_URL)
    || normalizeHttpsUrl(packagedConfig.releasesUrl)
    || (repositoryUrl ? `${repositoryUrl}/releases` : "");
  const updatePolicyUrl = normalizeHttpsUrl(env.FINLEDGE_UPDATE_POLICY_URL)
    || normalizeHttpsUrl(packagedConfig.updatePolicyUrl)
    || buildUpdatePolicyUrl(repository);

  return { ...repository, repositoryUrl, releasesUrl, updatePolicyUrl };
}

module.exports = {
  buildLatestReleaseUrl,
  buildRepositoryUrl,
  buildUpdatePolicyUrl,
  buildVersionReleaseUrl,
  normalizeHttpsUrl,
  normalizeRepositorySegment,
  parseGitHubRepositoryUrl,
  readPackageRepository,
  readPackagedPublicConfig,
  resolveRepositoryConfig,
};
