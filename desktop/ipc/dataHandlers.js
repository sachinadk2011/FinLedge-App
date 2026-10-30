"use strict";

const fs = require("fs");
const path = require("path");
const { ensureWritableDirectory } = require("../services/dataDirectory");
const { resolveAppxExternalPath } = require("../services/appxPaths");

function getFileLocations(dataDir, backupDir = path.join(dataDir, "backups"), resolvePath = (value) => value) {
  return {
    dataDir: resolvePath(dataDir),
    backupDir: resolvePath(path.join(backupDir, "auto")),
    bankFile: resolvePath(path.join(dataDir, "bank_transactions.xlsx")),
    shareFile: resolvePath(path.join(dataDir, "share_transactions.xlsx")),
    personalFinanceBankFile: resolvePath(path.join(dataDir, "personal_finance_bank_flow.xlsx")),
    personalFinanceCashFile: resolvePath(path.join(dataDir, "personal_finance_cash_flow.xlsx")),
    personalFinanceTransferFile: resolvePath(path.join(dataDir, "personal_finance_transfer.xlsx")),
  };
}

function registerDataHandlers({
  ipcMain,
  app,
  dialog,
  shell,
  dataRuntime,
  processManager,
  getMainWindow,
  logLine,
  isAppxPackage = false,
  appxPackageFamilyName = "",
  localAppDataPath = process.env.LOCALAPPDATA || "",
}) {
  const resolveExternalPath = (targetPath) => isAppxPackage
    ? resolveAppxExternalPath({
      targetPath,
      packageFamilyName: appxPackageFamilyName,
      userDataPath: app.getPath("userData"),
      appDataPath: app.getPath("appData"),
      localAppDataPath,
    })
    : targetPath;
  const getRuntimeFileLocations = () => getFileLocations(
    dataRuntime.getRuntimeDataDir(),
    dataRuntime.getBackupDirectory(),
    resolveExternalPath,
  );

  ipcMain.handle("app:get-data-locations", async () => {
    const locations = getRuntimeFileLocations();
    logLine("[main] Settings data locations", {
      dataDir: locations.dataDir,
      bankFile: locations.bankFile,
      shareFile: locations.shareFile,
      personalFinanceBankFile: locations.personalFinanceBankFile,
      personalFinanceCashFile: locations.personalFinanceCashFile,
      personalFinanceTransferFile: locations.personalFinanceTransferFile,
    });
    return {
      ...locations,
      buildType: dataRuntime.getBuildTypeLabel(),
      dataDirError: dataRuntime.getDataDirError(),
      canChooseDataFolder: dataRuntime.getCanChooseDataFolder(),
      dataSetupStatus: dataRuntime.getDataSetupStatus(),
    };
  });

  ipcMain.handle("app:choose-data-folder", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(getMainWindow(), {
      title: "Choose FinLedge data folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (canceled || !filePaths?.[0]) return { ok: false, cancelled: true };

    try {
      await processManager.stopBackend();
      dataRuntime.releaseLock();
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
          ...getFileLocations(selected, dataRuntime.getBackupDirectory(), resolveExternalPath),
          buildType: dataRuntime.getBuildTypeLabel(),
          dataSetupStatus: dataRuntime.getDataSetupStatus(),
          dataDirError: dataRuntime.getDataDirError(),
          canChooseDataFolder: dataRuntime.getCanChooseDataFolder(),
        },
        preferenceSaved: Boolean(saved.savedTo),
      };
    } catch (error) {
      await processManager.stopBackend();
      dataRuntime.releaseLock();
      dataRuntime.setDataDirError("Could not use that folder. Choose a folder you can write to.", { canChooseDataFolder: true });
      return { ok: false, reason: dataRuntime.getDataDirError() };
    }
  });

  ipcMain.handle("app:open-data-location", async (_event, target = "folder") => {
    const locations = getRuntimeFileLocations();
    const targetMap = {
      folder: locations.dataDir,
      backups: locations.backupDir,
      bank: locations.bankFile,
      share: locations.shareFile,
      "pf-bank": locations.personalFinanceBankFile,
      "pf-cash": locations.personalFinanceCashFile,
      "pf-transfer": locations.personalFinanceTransferFile,
    };
    const requestedPath = targetMap[String(target)] || locations.dataDir;

    try {
      fs.mkdirSync(locations.dataDir, { recursive: true });
      if (String(target) === "backups") fs.mkdirSync(requestedPath, { recursive: true });
      const shellPath = fs.existsSync(requestedPath) ? requestedPath : locations.dataDir;
      logLine("[main] opening data location", { target: String(target), path: shellPath });
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
