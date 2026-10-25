"use strict";

const fs = require("fs");
const path = require("path");
const { ensureWritableDirectory } = require("../services/dataDirectory");
const { resolveAppxExternalPath } = require("../services/appxPaths");

function getFileLocations(dataDir, backupDir = path.join(dataDir, "backups")) {
  return {
    dataDir,
    backupDir: path.join(backupDir, "auto"),
    bankFile: path.join(dataDir, "bank_transactions.xlsx"),
    shareFile: path.join(dataDir, "share_transactions.xlsx"),
    personalFinanceBankFile: path.join(dataDir, "personal_finance_bank_flow.xlsx"),
    personalFinanceCashFile: path.join(dataDir, "personal_finance_cash_flow.xlsx"),
  };
}

function registerDataHandlers({
  ipcMain,
  app,
  dialog,
  shell,
  dataRuntime,
  appxPackageFamilyName,
  isAppxPackage,
  processManager,
  getMainWindow,
  logLine,
}) {
  ipcMain.handle("app:get-data-locations", async () => ({
    ...getFileLocations(dataRuntime.getRuntimeDataDir(), dataRuntime.getBackupDirectory()),
    buildType: dataRuntime.getBuildTypeLabel(),
    dataDirError: dataRuntime.getDataDirError(),
    canChooseDataFolder: dataRuntime.getCanChooseDataFolder(),
    dataSetupStatus: dataRuntime.getDataSetupStatus(),
  }));

  ipcMain.handle("app:choose-data-folder", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(getMainWindow(), {
      title: "Choose FinLedge data folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (canceled || !filePaths?.[0]) return { ok: false, cancelled: true };

    try {
      const selected = ensureWritableDirectory(filePaths[0]);
      dataRuntime.initializeDataDirectory(selected);
      const saved = dataRuntime.persistDataDirectory(selected);
      if (!saved.savedTo) {
        dataRuntime.releaseLock();
        dataRuntime.resetRuntimeDataDir();
        throw new Error("FinLedge couldn't save the folder choice. Check access to Documents and try again.");
      }
      processManager.startBackend();
      dataRuntime.setDataDirError("");
      return {
        ok: true,
        locations: {
          ...getFileLocations(selected, dataRuntime.getBackupDirectory()),
          buildType: dataRuntime.getBuildTypeLabel(),
          dataSetupStatus: dataRuntime.getDataSetupStatus(),
          dataDirError: dataRuntime.getDataDirError(),
          canChooseDataFolder: dataRuntime.getCanChooseDataFolder(),
        },
        preferenceSaved: Boolean(saved.savedTo),
      };
    } catch (error) {
      processManager.stopBackend();
      dataRuntime.releaseLock();
      dataRuntime.setDataDirError(error.message || "Could not use that folder. Choose a folder you can write to.", { canChooseDataFolder: true });
      return { ok: false, reason: dataRuntime.getDataDirError() };
    }
  });

  ipcMain.handle("app:open-data-location", async (_event, target = "folder") => {
    const dataDir = dataRuntime.getRuntimeDataDir();
    const backupDir = dataRuntime.getBackupDirectory();
    const targetMap = {
      folder: dataDir,
      backups: path.join(backupDir, "auto"),
      bank: path.join(dataDir, "bank_transactions.xlsx"),
      share: path.join(dataDir, "share_transactions.xlsx"),
      "pf-bank": path.join(dataDir, "personal_finance_bank_flow.xlsx"),
      "pf-cash": path.join(dataDir, "personal_finance_cash_flow.xlsx"),
    };
    const requestedPath = targetMap[String(target)] || dataDir;

    try {
      fs.mkdirSync(dataDir, { recursive: true });
      if (String(target) === "backups") fs.mkdirSync(requestedPath, { recursive: true });
      const pathToOpen = fs.existsSync(requestedPath) ? requestedPath : dataDir;
      const shellPath = isAppxPackage
        ? resolveAppxExternalPath({
            targetPath: pathToOpen,
            packageFamilyName: appxPackageFamilyName,
            userDataPath: app.getPath("userData"),
            appDataPath: app.getPath("appData"),
            localAppDataPath: path.resolve(app.getPath("appData"), "..", "Local"),
          })
        : pathToOpen;
      const openError = await shell.openPath(shellPath);
      if (openError) {
        logLine("[main] open data location returned an error", { path: shellPath, error: openError });
        return { ok: false, reason: "open-data-location-failed" };
      }
      return { ok: true, path: shellPath };
    } catch (error) {
      logLine("[main] open data location failed", String(error && error.stack ? error.stack : error));
      return { ok: false, reason: "open-data-location-failed" };
    }
  });

  ipcMain.handle("app:save-export-file", async (_event, payload = {}) => {
    const defaultName = String(payload.defaultName || "finledge-export.xlsx").trim() || "finledge-export.xlsx";
    const base64 = String(payload.base64 || "");
    const isZip = defaultName.toLowerCase().endsWith(".zip");
    if (!base64) return { ok: false, reason: "missing-export-data" };

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export FinLedge data",
      defaultPath: defaultName,
      filters: isZip
        ? [{ name: "Zip archive", extensions: ["zip"] }]
        : [{ name: "Excel workbook", extensions: ["xlsx"] }],
    });
    if (canceled || !filePath) return { ok: false, cancelled: true };

    try {
      fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
      return { ok: true, path: filePath };
    } catch (error) {
      logLine("[main] save export file failed", String(error && error.stack ? error.stack : error));
      return { ok: false, reason: "save-export-file-failed" };
    }
  });
}

module.exports = { getFileLocations, registerDataHandlers };
