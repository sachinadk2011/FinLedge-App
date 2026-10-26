"use strict";

const fs = require("fs");

function createUpdatePolicyService({
  app,
  http,
  https,
  updatePolicyUrl,
  localPolicyPath,
  releasesUrl,
  compareVersions,
  normalizeReleaseNotes,
  getMainWindow,
  logLine,
}) {
  let latestUpdateStatus = { state: "idle", title: "Updates", detail: "" };

  function sendUpdateStatus(status) {
    latestUpdateStatus = {
      ...latestUpdateStatus,
      ...status,
      updatedAt: new Date().toISOString(),
    };
    const window = getMainWindow();
    if (!window || window.isDestroyed()) return;
    window.webContents.send("app:update-status", latestUpdateStatus);
  }

  function fetchJson(url, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith("https:") ? https : http;
      const request = client.get(
        url,
        {
          headers: {
            "User-Agent": `Finledge/${app.getVersion()}`,
            Accept: "application/json",
          },
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => { body += chunk; });
          response.on("end", () => {
            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
              reject(new Error(`Policy request failed with ${response.statusCode || "unknown"} status.`));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      request.on("error", reject);
      request.setTimeout(timeoutMs, () => request.destroy(new Error("Policy request timed out.")));
    });
  }

  function loadPolicy() {
    if (localPolicyPath) {
      return Promise.resolve(JSON.parse(fs.readFileSync(localPolicyPath, "utf8")));
    }
    return fetchJson(updatePolicyUrl);
  }

  async function checkUpdatePolicy({ silent = true } = {}) {
    if (!updatePolicyUrl) return;
    try {
      const policy = await loadPolicy();
      const currentVersion = app.getVersion();
      const minimumSupportedVersion = String(policy.minimumSupportedVersion || "").trim();
      const latestVersion = String(policy.latestVersion || "").trim();
      const releaseUrl = String(policy.releaseUrl || releasesUrl).trim();
      const releaseNotes = normalizeReleaseNotes(policy.releaseNotes || policy.notes);

      const storeMigration = policy.exeStoreMigration || {};
      const storeProductId = String(storeMigration.storeProductId || "").trim();
      if (storeMigration.enabled === true && storeProductId) {
        sendUpdateStatus({
          state: "store-migration",
          title: "FinLedge is available on Microsoft Store",
          detail: String(storeMigration.message || "You can switch to the Microsoft Store version now, or keep using this version.").trim(),
          currentVersion,
          storeProductId,
          releaseUrl,
          force: false,
          percent: null,
        });
        return;
      }

      if (minimumSupportedVersion && compareVersions(currentVersion, minimumSupportedVersion) < 0) {
        sendUpdateStatus({
          state: "required",
          title: "Update required",
          detail: policy.requiredMessage ||
            `This Finledge version is no longer supported. Please install Finledge ${minimumSupportedVersion} or newer from GitHub Releases.`,
          currentVersion,
          version: latestVersion || minimumSupportedVersion,
          minimumSupportedVersion,
          releaseUrl,
          releaseNotes,
          force: true,
          percent: null,
        });
        return;
      }

      if (latestVersion && compareVersions(currentVersion, latestVersion) < 0 && latestUpdateStatus.state !== "required") {
        sendUpdateStatus({
          state: "available",
          title: "Update available",
          detail: policy.availableMessage ||
            `Finledge ${latestVersion} is available on GitHub. Review what changed and download it from the official release page.`,
          currentVersion,
          version: latestVersion,
          minimumSupportedVersion,
          releaseUrl,
          releaseNotes,
          force: false,
          percent: null,
        });
        return;
      }

      if (!silent && latestUpdateStatus.state !== "required") {
        sendUpdateStatus({
          state: "not-available",
          title: "Finledge is up to date",
          detail: "You already have the latest supported version.",
          percent: null,
        });
      }
    } catch (error) {
      logLine("[updater] update policy check failed", String(error && error.stack ? error.stack : error));
      if (!silent) {
        sendUpdateStatus({
          state: "error",
          title: "Update check failed",
          detail: "Finledge could not check the update policy. Please check GitHub Releases manually.",
          releaseUrl: releasesUrl,
          error: String(error && error.message ? error.message : error),
        });
      }
    }
  }

  async function checkStoreUpdatePolicy({ silent = true } = {}) {
    if (!updatePolicyUrl) return;
    try {
      const policy = await loadPolicy();
      const currentVersion = app.getVersion();
      const latestVersion = String(policy.appxLatestVersion || "").trim();
      const fallbackUrl = String(policy.appxFallbackUrl || policy.releaseUrl || releasesUrl).trim();
      const storeProductId = String(policy.storeProductId || "").trim();
      if (latestVersion && compareVersions(currentVersion, latestVersion) < 0) {
        sendUpdateStatus({
          state: "appx-available",
          title: "FinLedge update available",
          detail: "Open Microsoft Store to install the latest version. Store will manage the download and installation.",
          currentVersion,
          version: latestVersion,
          storeProductId,
          releaseUrl: fallbackUrl,
          releaseNotes: normalizeReleaseNotes(policy.appxReleaseNotes || policy.releaseNotes || policy.notes),
          percent: null,
        });
      } else if (!silent) {
        sendUpdateStatus({
          state: "not-available",
          title: "FinLedge is up to date",
          detail: "You already have the latest Store version.",
          percent: null,
        });
      }
    } catch (error) {
      logLine("[updater] Store update policy check failed", String(error && error.stack ? error.stack : error));
      if (!silent) {
        sendUpdateStatus({
          state: "error",
          title: "Update check failed",
          detail: "FinLedge could not check for updates. Try Microsoft Store or the release page.",
          releaseUrl: releasesUrl,
        });
      }
    }
  }

  function simulateUpdateAvailable() {
    sendUpdateStatus({
      state: "available",
      title: "Update available — Finledge 1.2.0",
      detail: "A new version of Finledge is ready. Download it from GitHub Releases to get the latest features and fixes.",
      version: "1.2.0",
      releaseUrl: releasesUrl,
      releaseNotes: normalizeReleaseNotes([
        "<p>Interactive onboarding tour with spotlight and step animations.</p>",
        "Dividend entries: cash adds to total dividend; bonus shares add to portfolio quantity.",
        "Secondary market buy/sell: enter total amount + quantity, app calculates per-unit price.",
        "Refresh button now appears beside the Finledge logo for quick data reload.",
        "Update notice shows version number and expandable 'What's new' section.",
        "Force-update support via update-policy.json — critical versions can block the app.",
        "Summary overall net corrected: Bank net + Share profit/loss.",
      ]),
      force: false,
      isSimulation: true,
    });
  }

  function simulateRequiredUpdate() {
    sendUpdateStatus({
      state: "required",
      title: "Critical update required",
      detail: "This version of Finledge is no longer supported. You must install the latest release to continue.",
      version: "1.2.0",
      minimumSupportedVersion: "1.2.0",
      releaseUrl: releasesUrl,
      releaseNotes: [
        "Critical data-integrity fix for share transaction calculations.",
        "Security patch for local file handling.",
      ],
      force: true,
      isSimulation: true,
    });
  }

  return {
    sendUpdateStatus,
    checkUpdatePolicy,
    checkStoreUpdatePolicy,
    simulateUpdateAvailable,
    simulateRequiredUpdate,
    getLatestUpdateStatus: () => latestUpdateStatus,
  };
}

module.exports = { createUpdatePolicyService };
