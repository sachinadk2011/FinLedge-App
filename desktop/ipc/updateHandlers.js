"use strict";

function getSafeReleaseUrl(candidate, releasesUrl) {
  const url = String(candidate || "").trim();
  return url.startsWith("https://github.com/sachinadk2011/FinLedge-App/releases")
    ? url
    : releasesUrl;
}

function registerUpdateHandlers({
  ipcMain,
  app,
  shell,
  getMainWindow,
  updateService,
  releasesUrl,
  isDevelopment,
  updatesManagedByPackage = false,
  isStorePackage = false,
  simulateUpdates,
  simulateRequiredUpdate,
  logLine,
}) {
  ipcMain.handle("app:refresh", async () => {
    const window = getMainWindow();
    if (!window || window.isDestroyed()) return false;
    try {
      window.webContents.reloadIgnoringCache();
      return true;
    } catch (error) {
      logLine("[main] refresh failed", String(error && error.stack ? error.stack : error));
      return false;
    }
  });

  ipcMain.handle("app:check-for-updates", async () => {
    if (isStorePackage) {
      await updateService.checkStoreUpdatePolicy({ silent: false });
      return { ok: true, storeManaged: true };
    }
    if (updatesManagedByPackage) {
      return { ok: false, reason: "updates-managed-by-windows" };
    }
    if (simulateUpdates) {
      updateService.sendUpdateStatus({
        state: "checking",
        title: "Checking for updates",
        detail: simulateRequiredUpdate
          ? "Simulating a force-required update check..."
          : "Running the test update check...",
        percent: null,
        isSimulation: true,
      });
      setTimeout(
        simulateRequiredUpdate
          ? updateService.simulateRequiredUpdate
          : updateService.simulateUpdateAvailable,
        900
      );
      return { ok: true, simulated: true };
    }

    await updateService.checkUpdatePolicy({ silent: false });
    const state = updateService.getLatestUpdateStatus().state;
    if (state === "required" || state === "available") return { ok: true, policy: true };
    if (isDevelopment || !app.isPackaged) {
      updateService.sendUpdateStatus({
        state: "not-available",
        title: "Updates disabled in development",
        detail: "Auto-updates run only from the installed production app.",
        percent: null,
      });
      return { ok: false, reason: "updates-disabled-in-dev" };
    }
    return { ok: true };
  });

  ipcMain.handle("app:get-update-status", async () => updateService.getLatestUpdateStatus());
  ipcMain.handle("app:get-version", () => app.getVersion());

  ipcMain.handle("app:open-update-release", async (_event, releaseUrl) => {
    if (isStorePackage) {
      const status = updateService.getLatestUpdateStatus();
      const productId = String(status.storeProductId || "").trim();
      const storeUrl = productId
        ? `ms-windows-store://pdp/?ProductId=${encodeURIComponent(productId)}`
        : "ms-windows-store://downloadsandupdates";
      try {
        await shell.openExternal(storeUrl);
        return { ok: true, storeManaged: true, url: storeUrl };
      } catch (error) {
        const fallback = getSafeReleaseUrl(releaseUrl || status.releaseUrl, releasesUrl);
        try {
          await shell.openExternal(fallback);
          return { ok: true, fallback: true, url: fallback };
        } catch (fallbackError) {
          logLine("[updater] Store and fallback links failed", String(fallbackError?.stack || fallbackError || error));
          return { ok: false, reason: "open-update-link-failed" };
        }
      }
    }
    const currentStatus = updateService.getLatestUpdateStatus();
    if (currentStatus.state === "store-migration" && currentStatus.storeProductId) {
      const storeUrl = `ms-windows-store://pdp/?ProductId=${encodeURIComponent(currentStatus.storeProductId)}`;
      try {
        await shell.openExternal(storeUrl);
        return { ok: true, url: storeUrl };
      } catch (error) {
        logLine("[updater] Microsoft Store link failed", String(error?.stack || error));
        return { ok: false, reason: "open-store-failed" };
      }
    }
    if (updatesManagedByPackage) return { ok: false, reason: "updates-managed-by-windows" };
    const target = getSafeReleaseUrl(
      releaseUrl || updateService.getLatestUpdateStatus().releaseUrl,
      releasesUrl
    );
    try {
      await shell.openExternal(target);
      return { ok: true, url: target };
    } catch (error) {
      logLine("[updater] open release failed", String(error && error.stack ? error.stack : error));
      return { ok: false, reason: "open-release-failed" };
    }
  });

  ipcMain.handle("app:download-update", async () => {
    if (isStorePackage) {
      const status = updateService.getLatestUpdateStatus();
      const fallback = getSafeReleaseUrl(status.releaseUrl, releasesUrl);
      try {
        await shell.openExternal(fallback);
        return { ok: true, fallback: true, url: fallback };
      } catch (error) {
        logLine("[updater] AppX fallback link failed", String(error?.stack || error));
        return { ok: false, reason: "open-fallback-failed" };
      }
    }
    if (updatesManagedByPackage) return { ok: false, reason: "updates-managed-by-windows" };
    const target = getSafeReleaseUrl(updateService.getLatestUpdateStatus().releaseUrl, releasesUrl);
    try {
      await shell.openExternal(target);
      return { ok: true, url: target, simulated: simulateUpdates };
    } catch (error) {
      logLine("[updater] open release failed", String(error && error.stack ? error.stack : error));
      return { ok: false, reason: "open-release-failed" };
    }
  });

  ipcMain.handle("app:install-update", async () => {
    if (updatesManagedByPackage) return { ok: false, reason: "updates-managed-by-windows" };
    if (simulateUpdates) {
      updateService.sendUpdateStatus({
        state: "installing",
        title: "Restart simulated",
        detail: "The test update flow is complete. A real release would restart now.",
        percent: 100,
        isSimulation: true,
      });
      return { ok: true, simulated: true };
    }
    return { ok: true };
  });
}

module.exports = { getSafeReleaseUrl, registerUpdateHandlers };
