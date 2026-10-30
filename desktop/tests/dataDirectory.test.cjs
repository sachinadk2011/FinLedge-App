"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  acquireDataDirectoryLock,
  ensureWritableDirectory,
  expandDataDirectoryPath,
  getBuildType,
  resolveDataDirectory,
} = require("../services/dataDirectory");
const { createDataDirectoryRuntime } = require("../services/dataDirectoryRuntime");
const { findAppxLegacyDirs, resolveAppxExternalPath } = require("../services/appxPaths");
const { acquireClientInstanceLock } = require("../services/clientInstanceLock");
const { getFileLocations, registerDataHandlers } = require("../ipc/dataHandlers");
const { getSafeReleaseUrl } = require("../ipc/updateHandlers");

function withTempDir(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "finledge-data-test-"));
  try { run(directory); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test("packaged default resolves to Roaming/Finledge and explicit path wins", () => {
  const resolved = resolveDataDirectory({ homeDir: "C:/Users/test", projectRoot: "C:/app" });
  assert.equal(resolved, path.join("C:/Users/test", "AppData", "Roaming", "Finledge", "FinLedge Data"));
  assert.equal(resolveDataDirectory({ explicitPath: "C:/custom/data", homeDir: "C:/Users/test" }), path.resolve("C:/custom/data"));
});

test("data directory supports auto mode and portable environment-variable paths", () => {
  const env = { APPDATA: "C:/Users/test/AppData/Roaming" };
  const configured = expandDataDirectoryPath("%APPDATA%/FinLedge Data", { env });
  assert.equal(configured, path.join(env.APPDATA, "FinLedge Data"));
  assert.equal(resolveDataDirectory({
    explicitPath: "%APPDATA%/FinLedge Data",
    env,
    homeDir: "C:/Users/test",
  }), path.join(env.APPDATA, "FinLedge Data"));
  assert.equal(resolveDataDirectory({
    explicitPath: "auto",
    projectRoot: "C:/app",
    isDevelopment: true,
    env,
  }), path.join("C:/app", ".finledge-dev-data", "FinLedge Data"));
  assert.throws(() => expandDataDirectoryPath("%FINLEDGE_MISSING_ROOT%/data", { env: {} }), /undefined environment variable/);
});

test("production EXE and AppX keep separate working folders with shared Roaming sync and recovery", () => {
  const expected = [
    path.join("C:/Users/test/AppData/Roaming", "Finledge", "FinLedge Data"),
    path.join("C:/Users/test/AppData/Roaming", "Finledge Store", "FinLedge Data"),
  ];
  const runtimes = [false, true].map((isAppxPackage) => {
    const app = {
      isPackaged: true,
      getPath: (name) => ({
        appData: "C:/Users/test/AppData/Roaming",
        documents: "C:/Users/test/Documents",
        userData: `C:/Users/test/AppData/Roaming/Finledge ${isAppxPackage ? "Store" : "Installer"}`,
        home: "C:/Users/test",
      })[name],
    };
    const runtime = createDataDirectoryRuntime({
      app,
      projectRoot: "C:/app",
      isDevelopment: false,
      isTestingBuild: false,
      isStoreDistribution: isAppxPackage,
      isAppxPackage,
      backendHost: "127.0.0.1",
      backendPort: 8000,
      logLine: () => {},
    });
    return { dataDir: runtime.getRuntimeDataDir(), env: runtime.getBackendEnv() };
  });
  assert.deepEqual(runtimes.map(({ dataDir }) => dataDir), expected);
  const sharedBackups = path.join("C:/Users/test/AppData/Roaming", "Finledge", "FinLedge Data Shared", "Backups");
  assert.equal(runtimes[0].env.FINLEDGE_SHARED_SYNC_DIR, path.join("C:/Users/test/AppData/Roaming", "Finledge", "FinLedge Data Shared"));
  assert.equal(runtimes[1].env.FINLEDGE_SHARED_SYNC_DIR, path.join("C:/Users/test/AppData/Roaming", "Finledge", "FinLedge Data Shared"));
  assert.equal(runtimes[0].env.FINLEDGE_SAFETY_COPY_DIR, path.join(sharedBackups, "safety-copy"));
  assert.equal(runtimes[1].env.FINLEDGE_SAFETY_COPY_DIR, path.join(sharedBackups, "safety-copy"));
  assert.equal(runtimes[0].env.FINLEDGE_BACKUP_DIR, sharedBackups);
  assert.equal(runtimes[1].env.FINLEDGE_BACKUP_DIR, sharedBackups);
  assert.deepEqual(runtimes.map(({ env }) => env.FINLEDGE_DATA_DIR_IS_MANAGED), ["1", "1"]);
});

test("AppX legacy discovery is restricted to its own production or Testing channel", () => {
  withTempDir((directory) => {
    const packages = path.join(directory, "Packages");
    const productionPackage = "SachinAdhikari.Finledge_abcd1234";
    const testingPackage = "SachinAdhikari.Finledge.Testing_efgh5678";
    for (const packageName of [productionPackage, testingPackage]) {
      fs.mkdirSync(path.join(packages, packageName, "LocalCache", "Roaming"), { recursive: true });
    }

    const discovered = findAppxLegacyDirs({ localAppDataPath: directory });
    const redirected = path.join(packages, productionPackage, "LocalCache", "Roaming");
    assert.ok(discovered.includes(path.join(redirected, "Finledge")));
    assert.ok(discovered.includes(path.join(redirected, "FinLedge", "FinLedge Data")));
    assert.ok(discovered.includes(path.join(redirected, "FinancialTracker")));
    assert.ok(discovered.every((candidate) => !candidate.includes(testingPackage)));
    const testingDiscovered = findAppxLegacyDirs({ localAppDataPath: directory, isTestingBuild: true });
    const testingRedirected = path.join(packages, testingPackage, "LocalCache", "Roaming");
    assert.ok(testingDiscovered.includes(path.join(testingRedirected, "Finledge Testing AppX", "FinLedge Data")));
    assert.ok(testingDiscovered.every((candidate) => !candidate.includes(productionPackage)));
    assert.ok(testingDiscovered.every((candidate) => !/\\(?:Finledge|FinLedge|FinancialTracker)(?:\\|$)/i.test(candidate)));

    const originalLocalAppData = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = directory;
    try {
      const runtime = createDataDirectoryRuntime({
        app: {
          isPackaged: true,
          getPath: (name) => ({
            appData: path.join(directory, "Roaming"),
            documents: path.join(directory, "Documents"),
            userData: path.join(directory, "Roaming", "Finledge Installer"),
            home: directory,
          })[name],
        },
        projectRoot: path.join(directory, "app"),
        isDevelopment: false,
        isTestingBuild: false,
        isAppxPackage: true,
        appxPackageFamilyName: productionPackage,
        backendHost: "127.0.0.1",
        backendPort: 8000,
        getPythonExecutable: () => "python",
        logLine: () => {},
      });
      const legacy = JSON.parse(runtime.getBackendEnv().FINLEDGE_LEGACY_DATA_DIRS);
      assert.ok(legacy.includes(path.join(redirected, "FinLedge", "FinLedge Data")));
      assert.ok(legacy.includes(path.join(directory, "AppData", "Roaming", "Finledge", "FinLedge Data")));
      assert.ok(legacy.includes(path.join(directory, "AppData", "Roaming", "financial-tracker-desktop")));
      assert.ok(legacy.includes(path.join(directory, "AppData", "Roaming", "Finledge AppX")));
      assert.ok(legacy.includes(path.join(directory, "Documents", "FinLedge")));
    } finally {
      if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = originalLocalAppData;
    }
  });
});

test("build labels distinguish development, test, AppX, Store distribution, and installer", () => {
  assert.equal(getBuildType({ isPackaged: false }), "Development");
  assert.equal(getBuildType({ isPackaged: true, isTestingBuild: true, isStoreBuild: true }), "Testing");
  assert.equal(getBuildType({ isPackaged: true, isStoreBuild: true }), "AppX Package");
  assert.equal(getBuildType({ isPackaged: true, isStoreBuild: true, isStoreDistribution: true }), "Microsoft Store");
  assert.equal(getBuildType({ isPackaged: true }), "Installer");
  assert.equal(getBuildType({ isPackaged: true, isTestingBuild: true }), "Testing");
});

test("Testing EXE and AppX keep separate workbooks and never scan production AppX roots", () => {
  withTempDir((directory) => {
    const localAppData = path.join(directory, "Local");
    const home = path.join(directory, "Profile");
    const appData = path.join(home, "AppData", "Roaming");
    const packageName = "SachinAdhikari.Finledge.Testing_8x98p8ab6vke2";
    const productionPackageName = "SachinAdhikari.Finledge_1a2b3c4d";
    const appxRoaming = path.join(localAppData, "Packages", packageName, "LocalCache", "Roaming");
    const productionAppxRoaming = path.join(localAppData, "Packages", productionPackageName, "LocalCache", "Roaming");
    const oldAppxData = path.join(appxRoaming, "Finledge Testing AppX", "FinLedge Data");
    const oldExeData = path.join(appData, "Finledge Testing EXE", "FinLedge Data");
    fs.mkdirSync(oldAppxData, { recursive: true });
    fs.mkdirSync(oldExeData, { recursive: true });
    fs.mkdirSync(path.join(productionAppxRoaming, "Finledge", "FinLedge Data"), { recursive: true });

    const runtimePaths = ["appx", "exe"].map((testBuildType) => {
      const app = {
        isPackaged: true,
        getPath: (name) => ({
          userData: path.join(appData, `Finledge Testing ${testBuildType === "appx" ? "AppX" : "EXE"}`),
          appData,
          documents: path.join(directory, "Documents"),
          home,
        })[name],
      };
      const runtime = createDataDirectoryRuntime({
        app,
        projectRoot: path.join(directory, "app"),
        isDevelopment: false,
        isTestingBuild: true,
        testBuildType,
        isAppxPackage: testBuildType === "appx",
        appxPackageFamilyName: testBuildType === "appx" ? packageName : "",
        localAppDataPath: localAppData,
        backendHost: "127.0.0.1",
        backendPort: 8000,
        logLine: () => {},
      });
      assert.equal(runtime.getBuildTypeLabel(), "Testing");
      assert.equal(runtime.getBackendEnv().FINLEDGE_MODE, "testing");
      assert.equal(runtime.getBackendEnv().FINLEDGE_DATA_DIR_IS_MANAGED, "1");
      assert.equal(runtime.getBackendEnv().FINLEDGE_SAFETY_COPY_DIR, path.join(appData, "Finledge Testing EXE", "FinLedge Data Shared", "Backups", "safety-copy"));
      assert.equal(runtime.getBackendEnv().FINLEDGE_BACKUP_DIR, path.join(appData, "Finledge Testing EXE", "FinLedge Data Shared", "Backups"));
      const legacy = JSON.parse(runtime.getBackendEnv().FINLEDGE_LEGACY_DATA_DIRS);
      assert.ok(!legacy.includes(path.join(appData, "financial-tracker-desktop")));
      assert.ok(legacy.every((candidate) => !candidate.includes(productionPackageName)));
      assert.ok(legacy.every((candidate) => !candidate.includes(productionAppxRoaming)));
      if (testBuildType === "appx") {
        assert.ok(legacy.includes(oldAppxData));
        assert.ok(legacy.includes(oldExeData));
        assert.ok(legacy.includes(path.join(localAppData, "Finledge Testing AppX Test")));
      } else {
        assert.ok(legacy.includes(oldExeData));
        assert.ok(legacy.includes(oldAppxData));
        assert.ok(legacy.some((candidate) => candidate.includes(packageName)));
      }
      const activeDataDir = runtime.getRuntimeDataDir();
      const backendEnv = runtime.getBackendEnv();
      assert.equal(backendEnv.FINLEDGE_DATA_DIR, activeDataDir);
      return { activeDataDir, backendEnv, legacy };
    });

    const exeDataDir = path.join(appData, "Finledge Testing EXE", "FinLedge Data");
    const appxDataDir = path.join(appData, "Finledge Testing AppX", "FinLedge Data");
    assert.deepEqual(runtimePaths.map(({ activeDataDir }) => activeDataDir), [appxDataDir, exeDataDir]);
    const appxRuntime = runtimePaths[0];
    assert.ok(appxRuntime.legacy.includes(path.join(appData, "Finledge Testing EXE", "FinLedge Data")));
    assert.equal(getFileLocations(appxRuntime.activeDataDir).dataDir, appxRuntime.backendEnv.FINLEDGE_DATA_DIR);
    assert.equal(
      getFileLocations(appxRuntime.activeDataDir).personalFinanceTransferFile,
      path.join(appxRuntime.backendEnv.FINLEDGE_DATA_DIR, "personal_finance_transfer.xlsx"),
    );
  });
});

test("production runtime cannot discover Testing AppX legacy data", () => {
  withTempDir((directory) => {
    const localAppData = path.join(directory, "Local");
    const home = path.join(directory, "Profile");
    const testingPackage = "SachinAdhikari.Finledge.Testing_testfamily";
    const testingRedirected = path.join(localAppData, "Packages", testingPackage, "LocalCache", "Roaming");
    fs.mkdirSync(path.join(testingRedirected, "Finledge Testing AppX", "FinLedge Data"), { recursive: true });
    const previousLocalAppData = process.env.LOCALAPPDATA;
    const previousDataDir = process.env.FINLEDGE_DATA_DIR;
    const previousLegacy = process.env.FINLEDGE_LEGACY_DATA_DIRS;
    delete process.env.FINLEDGE_DATA_DIR;
    delete process.env.FINLEDGE_LEGACY_DATA_DIRS;
    process.env.LOCALAPPDATA = localAppData;
    try {
      const runtime = createDataDirectoryRuntime({
        app: {
          isPackaged: true,
          getPath: (name) => ({
            home,
            appData: path.join(home, "AppData", "Roaming"),
            documents: path.join(home, "Documents"),
            userData: path.join(home, "AppData", "Roaming", "Finledge Installer"),
          })[name],
        },
        projectRoot: path.join(directory, "app"),
        isDevelopment: false,
        isTestingBuild: false,
        isAppxPackage: false,
        backendHost: "127.0.0.1",
        backendPort: 8000,
        logLine: () => {},
      });
      const legacy = JSON.parse(runtime.getBackendEnv().FINLEDGE_LEGACY_DATA_DIRS);
      assert.ok(legacy.every((candidate) => !candidate.includes(testingPackage)));
      assert.ok(legacy.every((candidate) => !candidate.includes("Finledge Testing AppX")));
    } finally {
      if (previousLocalAppData === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = previousLocalAppData;
      if (previousDataDir === undefined) delete process.env.FINLEDGE_DATA_DIR;
      else process.env.FINLEDGE_DATA_DIR = previousDataDir;
      if (previousLegacy === undefined) delete process.env.FINLEDGE_LEGACY_DATA_DIRS;
      else process.env.FINLEDGE_LEGACY_DATA_DIRS = previousLegacy;
    }
  });
});

test("Testing EXE and AppX use separate active folders under Roaming", () => {
  withTempDir((directory) => {
    const home = path.join(directory, "Profile");
    const virtualAppData = path.join(directory, "Local", "Packages", "testing", "LocalCache", "Roaming");
    for (const isAppxPackage of [false, true]) {
      const runtime = createDataDirectoryRuntime({
        app: {
          isPackaged: true,
          getPath: (name) => ({
            home,
            appData: virtualAppData,
            documents: path.join(directory, "Documents"),
            userData: path.join(virtualAppData, "Finledge Testing"),
          })[name],
        },
        projectRoot: path.join(directory, "app"),
        isDevelopment: false,
        isTestingBuild: true,
        isAppxPackage,
        backendHost: "127.0.0.1",
        backendPort: 8000,
        logLine: () => {},
      });
      const expected = isAppxPackage
        ? path.join(virtualAppData, "Finledge Testing", "FinLedge Data")
        : path.join(home, "AppData", "Roaming", "Finledge Testing EXE", "FinLedge Data");
      assert.equal(runtime.getRuntimeDataDir(), expected);
    }
  });
});

test("isolated Testing launch redirects data and recovery folders and disables legacy scans", () => {
  withTempDir((directory) => {
    const previous = {
      isolated: process.env.FINLEDGE_TEST_ISOLATED,
      documents: process.env.FINLEDGE_TEST_DOCUMENTS_DIR,
      data: process.env.FINLEDGE_DATA_DIR,
    };
    const isolatedDocuments = path.join(directory, "Documents");
    const isolatedData = path.join(directory, "active");
    process.env.FINLEDGE_TEST_ISOLATED = "1";
    process.env.FINLEDGE_TEST_DOCUMENTS_DIR = isolatedDocuments;
    process.env.FINLEDGE_DATA_DIR = isolatedData;
    try {
      for (const isAppxPackage of [false, true]) {
        const appData = path.join(directory, "Roaming");
        const runtime = createDataDirectoryRuntime({
          app: {
            isPackaged: true,
            getPath: (name) => ({
              appData,
              documents: path.join(directory, "real-user-documents"),
              userData: path.join(appData, "existing-testing-user-data"),
              home: directory,
            })[name],
          },
          projectRoot: path.join(directory, "app"),
          isDevelopment: false,
          isTestingBuild: true,
          isAppxPackage,
          appxPackageFamilyName: "SachinAdhikari.Finledge.Testing_testfamily",
          localAppDataPath: path.join(directory, "Local"),
          backendHost: "127.0.0.1",
          backendPort: 8000,
          logLine: () => {},
        });
        const env = runtime.getBackendEnv();
        assert.equal(env.FINLEDGE_DATA_DIR, isolatedData);
        assert.equal(env.FINLEDGE_SAFETY_COPY_DIR, path.join(directory, "AppData", "Roaming", "Finledge Testing EXE", "FinLedge Data Shared", "Backups", "safety-copy"));
        assert.equal(env.FINLEDGE_BACKUP_DIR, path.join(directory, "AppData", "Roaming", "Finledge Testing EXE", "FinLedge Data Shared", "Backups"));
        assert.deepEqual(JSON.parse(env.FINLEDGE_LEGACY_DATA_DIRS), []);
        assert.deepEqual(JSON.parse(env.FINLEDGE_CLEANUP_LEGACY_ROOTS), []);
      }
    } finally {
      if (previous.isolated === undefined) delete process.env.FINLEDGE_TEST_ISOLATED;
      else process.env.FINLEDGE_TEST_ISOLATED = previous.isolated;
      if (previous.documents === undefined) delete process.env.FINLEDGE_TEST_DOCUMENTS_DIR;
      else process.env.FINLEDGE_TEST_DOCUMENTS_DIR = previous.documents;
      if (previous.data === undefined) delete process.env.FINLEDGE_DATA_DIR;
      else process.env.FINLEDGE_DATA_DIR = previous.data;
    }
  });
});

test("Testing launch can scan only an explicit legacy source while isolating data and recovery writes", () => {
  withTempDir((directory) => {
    const previous = {
      isolated: process.env.FINLEDGE_TEST_ISOLATED,
      documents: process.env.FINLEDGE_TEST_DOCUMENTS_DIR,
      legacy: process.env.FINLEDGE_TEST_LEGACY_DATA_DIRS,
      data: process.env.FINLEDGE_DATA_DIR,
      localAppData: process.env.LOCALAPPDATA,
    };
    const home = path.join(directory, "Profile");
    const active = path.join(directory, "Testing EXE QA", "FinLedge Data");
    const documents = path.join(directory, "Testing EXE QA", "Recovery");
    const formerRoot = path.join(home, "AppData", "Roaming", "financial-tracker-desktop");
    const productionPackage = "SachinAdhikari.Finledge_prodhash";
    const productionAppxRoot = path.join(directory, "Local", "Packages", productionPackage, "LocalCache", "Roaming");
    const productionRoamingRoot = path.join(home, "AppData", "Roaming", "Finledge");
    fs.mkdirSync(productionAppxRoot, { recursive: true });
    delete process.env.FINLEDGE_TEST_ISOLATED;
    process.env.FINLEDGE_TEST_DOCUMENTS_DIR = documents;
    process.env.FINLEDGE_TEST_LEGACY_DATA_DIRS = JSON.stringify([
      formerRoot,
      path.join(productionAppxRoot, "Finledge", "FinLedge Data"),
      path.join(productionRoamingRoot, "FinLedge Data"),
    ]);
    process.env.FINLEDGE_DATA_DIR = active;
    process.env.LOCALAPPDATA = path.join(directory, "Local");
    try {
      const runtime = createDataDirectoryRuntime({
        app: {
          isPackaged: true,
          getPath: (name) => ({
            home,
            appData: path.join(directory, "PackageCache", "LocalCache", "Roaming"),
            documents: path.join(directory, "RealDocuments"),
            userData: path.join(directory, "PackageCache", "UserData"),
          })[name],
        },
        projectRoot: path.join(directory, "app"),
        isDevelopment: false,
        isTestingBuild: true,
        isAppxPackage: false,
        localAppDataPath: path.join(directory, "Local"),
        backendHost: "127.0.0.1",
        backendPort: 8000,
        logLine: () => {},
      });
      const env = runtime.getBackendEnv();
      assert.equal(env.FINLEDGE_DATA_DIR, active);
      assert.equal(env.FINLEDGE_SAFETY_COPY_DIR, path.join(home, "AppData", "Roaming", "Finledge Testing EXE", "FinLedge Data Shared", "Backups", "safety-copy"));
      assert.equal(env.FINLEDGE_BACKUP_DIR, path.join(home, "AppData", "Roaming", "Finledge Testing EXE", "FinLedge Data Shared", "Backups"));
      assert.deepEqual(JSON.parse(env.FINLEDGE_LEGACY_DATA_DIRS), [formerRoot]);
    } finally {
      if (previous.isolated === undefined) delete process.env.FINLEDGE_TEST_ISOLATED;
      else process.env.FINLEDGE_TEST_ISOLATED = previous.isolated;
      if (previous.documents === undefined) delete process.env.FINLEDGE_TEST_DOCUMENTS_DIR;
      else process.env.FINLEDGE_TEST_DOCUMENTS_DIR = previous.documents;
      if (previous.legacy === undefined) delete process.env.FINLEDGE_TEST_LEGACY_DATA_DIRS;
      else process.env.FINLEDGE_TEST_LEGACY_DATA_DIRS = previous.legacy;
      if (previous.data === undefined) delete process.env.FINLEDGE_DATA_DIR;
      else process.env.FINLEDGE_DATA_DIR = previous.data;
      if (previous.localAppData === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = previous.localAppData;
    }
  });
});

test("data-directory initialization prepares the shared Roaming folder before active workbooks", () => {
  withTempDir((directory) => {
    const documents = path.join(directory, "Documents");
    const appData = path.join(directory, "Roaming");
    const app = {
      isPackaged: true,
      getPath: (name) => ({
        appData,
        documents,
        userData: path.join(appData, "Finledge Testing EXE"),
        home: directory,
      })[name],
    };
    const runtime = createDataDirectoryRuntime({
      app,
      projectRoot: path.join(directory, "app"),
      isDevelopment: false,
      isTestingBuild: true,
      isAppxPackage: false,
      backendHost: "127.0.0.1",
      backendPort: 8201,
      logLine: () => {},
    });

    runtime.initializeDataDirectory(runtime.getRuntimeDataDir());
    const backupRoot = path.join(directory, "AppData", "Roaming", "Finledge Testing EXE", "FinLedge Data Shared", "Backups");
    assert.ok(fs.statSync(path.join(backupRoot, "safety-copy")).isDirectory());
    assert.ok(fs.statSync(backupRoot).isDirectory());
    assert.ok(fs.statSync(path.join(backupRoot, "migration")).isDirectory());
    assert.ok(fs.statSync(runtime.getRuntimeDataDir()).isDirectory());
    runtime.releaseLock();
  });
});

test("unavailable shared Roaming folder reports a clear startup error code", () => {
  withTempDir((directory) => {
    const home = directory;
    const notAFolder = path.join(home, "AppData", "Roaming", "Finledge Testing EXE", "FinLedge Data Shared", "Backups");
    fs.mkdirSync(path.dirname(notAFolder), { recursive: true });
    fs.writeFileSync(notAFolder, "test only");
    const appData = path.join(home, "AppData", "Roaming");
    const runtime = createDataDirectoryRuntime({
      app: {
        isPackaged: true,
        getPath: (name) => ({
          appData,
          documents: path.join(directory, "Documents"),
          userData: path.join(appData, "Finledge Testing EXE"),
          home,
        })[name],
      },
      projectRoot: path.join(directory, "app"),
      isDevelopment: false,
      isTestingBuild: true,
      isAppxPackage: false,
      backendHost: "127.0.0.1",
      backendPort: 8201,
      logLine: () => {},
    });

    assert.throws(
      () => runtime.initializeDataDirectory(runtime.getRuntimeDataDir()),
      (error) => error.code === "FINLEDGE_SHARED_STORAGE_UNAVAILABLE",
    );
    assert.equal(fs.existsSync(path.join(appData, "Finledge Testing EXE", "FinLedge Data")), false);
  });
});

test("preparation failure never switches the dashboard to an old workbook folder", () => {
  withTempDir((directory) => {
    const documents = path.join(directory, "Documents");
    const oldWorkbookRoot = path.join(directory, "Roaming", "Finledge Testing EXE");
    fs.mkdirSync(oldWorkbookRoot, { recursive: true });
    fs.writeFileSync(path.join(oldWorkbookRoot, "bank_transactions.xlsx"), "legacy source placeholder");
    const runtime = createDataDirectoryRuntime({
      app: {
        isPackaged: true,
        getPath: (name) => ({
          home: directory,
          appData: path.join(directory, "Roaming"),
          documents,
          userData: path.join(directory, "Roaming", "Finledge Testing EXE"),
        })[name],
      },
      projectRoot: path.join(directory, "app"),
      isDevelopment: false,
      isTestingBuild: true,
      isAppxPackage: false,
      backendHost: "127.0.0.1",
      backendPort: 8201,
      logLine: () => {},
    });
    const activeDataDir = runtime.getRuntimeDataDir();
    runtime.initializeDataDirectory(activeDataDir, { allowLegacyFallback: true });
    assert.equal(runtime.switchToLegacyFallback(new Error("migration failed")), false);
    assert.equal(runtime.getRuntimeDataDir(), activeDataDir);
    runtime.releaseLock();
  });
});

test("desktop development and the web backend share the project development data directory", () => {
  const projectRoot = "C:/workspace/FinLedge";
  const app = {
    isPackaged: false,
    getPath: (name) => ({
      home: "C:/Users/test",
      userData: "C:/Users/test/AppData/Roaming/Finledge Development",
      appData: "C:/Users/test/AppData/Roaming",
      documents: "C:/Users/test/Documents",
    })[name],
  };
  const runtime = createDataDirectoryRuntime({
    app,
    projectRoot,
    isDevelopment: true,
    isTestingBuild: false,
    backendHost: "127.0.0.1",
    backendPort: 8000,
    localAppDataPath: "C:/Users/test/AppData/Local",
    logLine: () => {},
  });
  assert.equal(runtime.getRuntimeDataDir(), path.join(projectRoot, ".finledge-dev-data", "FinLedge Data"));
  assert.equal(runtime.getBackendEnv().FINLEDGE_DATA_DIR, runtime.getRuntimeDataDir());
  assert.equal(runtime.getBackendEnv().FINLEDGE_SAFETY_COPY_DIR, path.join(projectRoot, ".finledge-dev-data", "FinLedge Data Shared", "Backups", "safety-copy"));
  assert.equal(runtime.getBackendEnv().FINLEDGE_BACKUP_DIR, path.join(projectRoot, ".finledge-dev-data", "FinLedge Data Shared", "Backups"));
  assert.equal(runtime.getBackendEnv().FINLEDGE_DATA_DIR_IS_MANAGED, "1");
  assert.ok(JSON.parse(runtime.getBackendEnv().FINLEDGE_LEGACY_DATA_DIRS).includes(path.join(projectRoot, ".finledge-dev-data")));
});

test("custom data directory environment override is shared by Testing EXE and AppX", () => {
  withTempDir((directory) => {
    const previous = process.env.FINLEDGE_DATA_DIR;
    process.env.FINLEDGE_DATA_DIR = path.join(directory, "shared-env-data");
    try {
      for (const testBuildType of ["appx", "exe"]) {
        const app = {
          isPackaged: true,
          getPath: (name) => ({
            home: directory,
            userData: path.join(directory, `Roaming/Finledge Testing ${testBuildType}`),
            appData: path.join(directory, "Roaming"),
            documents: path.join(directory, "Documents"),
          })[name],
        };
        const runtime = createDataDirectoryRuntime({
          app,
          projectRoot: path.join(directory, "app"),
          isDevelopment: false,
          isTestingBuild: true,
          testBuildType,
          isAppxPackage: testBuildType === "appx",
          localAppDataPath: path.join(directory, "Local"),
          backendHost: "127.0.0.1",
          backendPort: 8000,
          logLine: () => {},
        });
        assert.equal(runtime.getRuntimeDataDir(), process.env.FINLEDGE_DATA_DIR);
        assert.equal(runtime.getBackendEnv().FINLEDGE_DATA_DIR, process.env.FINLEDGE_DATA_DIR);
        assert.equal(runtime.getBackendEnv().FINLEDGE_DATA_DIR_IS_MANAGED, "0");
      }
    } finally {
      if (previous === undefined) delete process.env.FINLEDGE_DATA_DIR;
      else process.env.FINLEDGE_DATA_DIR = previous;
    }
  });
});

test("Testing builds can isolate the shared sync folder and legacy-root cleanup", () => {
  withTempDir((directory) => {
    const shared = path.join(directory, "isolated-shared");
    const cleanupRoot = path.join(directory, "legacy-root");
    const previousShared = process.env.FINLEDGE_TEST_SHARED_SYNC_DIR;
    const previousCleanup = process.env.FINLEDGE_TEST_CLEANUP_LEGACY_ROOTS;
    process.env.FINLEDGE_TEST_SHARED_SYNC_DIR = shared;
    process.env.FINLEDGE_TEST_CLEANUP_LEGACY_ROOTS = JSON.stringify([cleanupRoot]);
    try {
      const runtime = createDataDirectoryRuntime({
        app: {
          isPackaged: true,
          getPath: (name) => ({ home: directory, appData: path.join(directory, "Roaming"), userData: path.join(directory, "AppX"), documents: path.join(directory, "Documents") })[name],
        },
        projectRoot: path.join(directory, "app"),
        isDevelopment: false,
        isTestingBuild: true,
        isAppxPackage: true,
        backendHost: "127.0.0.1",
        backendPort: 8202,
        logLine: () => {},
      });
      const env = runtime.getBackendEnv();
      assert.equal(env.FINLEDGE_SHARED_SYNC_DIR, shared);
      assert.deepEqual(JSON.parse(env.FINLEDGE_CLEANUP_LEGACY_ROOTS), [cleanupRoot]);
      assert.equal(env.FINLEDGE_BACKUP_DIR, path.join(shared, "Backups"));
    } finally {
      if (previousShared === undefined) delete process.env.FINLEDGE_TEST_SHARED_SYNC_DIR;
      else process.env.FINLEDGE_TEST_SHARED_SYNC_DIR = previousShared;
      if (previousCleanup === undefined) delete process.env.FINLEDGE_TEST_CLEANUP_LEGACY_ROOTS;
      else process.env.FINLEDGE_TEST_CLEANUP_LEGACY_ROOTS = previousCleanup;
    }
  });
});

test("Settings resolves AppX working data but keeps shared backup paths physical", () => {
  const logicalRoot = path.join("C:/Users/test/AppData/Roaming", "Finledge", "FinLedge Data");
  const physicalRoot = path.join("C:/Users/test/AppData/Local/Packages/Finledge/LocalCache/Roaming", "Finledge", "FinLedge Data");
  const sharedBackupRoot = path.join("C:/Users/test/AppData/Roaming", "Finledge", "FinLedge Data Shared", "Backups");
  const locations = getFileLocations(logicalRoot, sharedBackupRoot, (candidate) =>
    candidate.replace(logicalRoot, physicalRoot));
  assert.equal(locations.dataDir, physicalRoot);
  assert.equal(locations.bankFile, path.join(physicalRoot, "bank_transactions.xlsx"));
  assert.equal(locations.backupDir, path.join(sharedBackupRoot, "auto"));
});

test("missing Testing AppX shared support folders initialize under the Testing EXE root", () => {
  withTempDir((directory) => {
    const home = path.join(directory, "Profile");
    const appData = path.join(home, "AppData", "Roaming");
    const packageLocalCache = path.join(directory, "Local", "Packages", "SachinAdhikari.Finledge.Testing_testfamily", "LocalCache", "Roaming");
    const runtime = createDataDirectoryRuntime({
      app: {
        isPackaged: true,
        getPath: (name) => ({
          home,
          appData,
          documents: path.join(home, "Documents"),
          userData: path.join(appData, "Finledge Testing AppX"),
        })[name],
      },
      projectRoot: path.join(directory, "app"),
      isDevelopment: false,
      isTestingBuild: true,
      isAppxPackage: true,
      localAppDataPath: path.join(directory, "Local"),
      backendHost: "127.0.0.1",
      backendPort: 8000,
      logLine: () => {},
    });

    const [safetyCopy, backupRoot, migrationBackup] = runtime.ensureRuntimeSupportDirectories();
    const expectedShared = path.join(appData, "Finledge Testing EXE", "FinLedge Data Shared");
    assert.equal(backupRoot, path.join(expectedShared, "Backups"));
    assert.equal(safetyCopy, path.join(expectedShared, "Backups", "safety-copy"));
    assert.equal(migrationBackup, path.join(expectedShared, "Backups", "migration"));
    assert.ok(fs.statSync(migrationBackup).isDirectory());
    assert.equal(fs.existsSync(path.join(packageLocalCache, "Finledge Testing EXE", "FinLedge Data Shared", "Backups")), false);
  });
});

test("AppX Settings displays and opens the shared backup directory without creating a package-local copy", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "finledge-appx-shared-backup-path-"));
  try {
    const appDataPath = path.join(directory, "AppData", "Roaming");
    const localAppDataPath = path.join(directory, "AppData", "Local");
    const packageFamilyName = "SachinAdhikari.Finledge.Testing_8x98p8ab6vke2";
    const activeDataDir = path.join(appDataPath, "Finledge Testing AppX", "FinLedge Data");
    const sharedBackupRoot = path.join(appDataPath, "Finledge Testing EXE", "FinLedge Data Shared", "Backups");
    const redirectedPackageRoot = path.join(localAppDataPath, "Packages", packageFamilyName, "LocalCache", "Roaming");
    const handlers = new Map();
    let openedPath = "";
    registerDataHandlers({
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
      app: {
        getPath: (name) => ({
          appData: appDataPath,
          userData: path.join(appDataPath, "Finledge Testing AppX"),
        })[name] || directory,
      },
      dialog: {},
      shell: { openPath: async (target) => { openedPath = target; return ""; } },
      dataRuntime: {
        getRuntimeDataDir: () => activeDataDir,
        getBackupDirectory: () => sharedBackupRoot,
        getBuildTypeLabel: () => "Testing",
        getDataDirError: () => "",
        getCanChooseDataFolder: () => false,
        getDataSetupStatus: () => "ready",
      },
      appxPackageFamilyName: packageFamilyName,
      isAppxPackage: true,
      localAppDataPath,
      processManager: {},
      getMainWindow: () => null,
      logLine: () => {},
    });

    const locations = await handlers.get("app:get-data-locations")();
    assert.equal(locations.dataDir, path.join(redirectedPackageRoot, "Finledge Testing AppX", "FinLedge Data"));
    assert.equal(locations.backupDir, path.join(sharedBackupRoot, "auto"));

    const result = await handlers.get("app:open-data-location")(null, "backups");
    assert.deepEqual(result, { ok: true, path: path.join(sharedBackupRoot, "auto") });
    assert.equal(openedPath, path.join(sharedBackupRoot, "auto"));
    assert.ok(fs.statSync(path.join(sharedBackupRoot, "auto")).isDirectory());
    assert.equal(fs.existsSync(path.join(redirectedPackageRoot, "Finledge Testing EXE", "FinLedge Data Shared", "Backups", "auto")), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("AppX Settings and file-open IPC resolve to the same active workbook directory", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "finledge-settings-data-path-"));
  try {
    const activeDataDir = path.join(directory, "Documents", "FinLedge Testing", "FinLedge Data");
    const handlers = new Map();
    let openedPath = "";
    registerDataHandlers({
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
      app: { getPath: (name) => (name === "appData" ? path.join(directory, "Roaming") : directory) },
      dialog: {},
      shell: { openPath: async (target) => { openedPath = target; return ""; } },
      dataRuntime: {
        getRuntimeDataDir: () => activeDataDir,
        getBackupDirectory: () => path.join(directory, "backups"),
        getBuildTypeLabel: () => "Development",
        getDataDirError: () => "",
        getCanChooseDataFolder: () => false,
        getDataSetupStatus: () => "ready",
      },
      appxPackageFamilyName: "SachinAdhikari.Finledge.Testing_8x98p8ab6vke2",
      isAppxPackage: true,
      localAppDataPath: path.join(directory, "Local"),
      processManager: {},
      getMainWindow: () => null,
      logLine: () => {},
    });

    const locations = await handlers.get("app:get-data-locations")();
    const effectiveDataDir = activeDataDir;
    assert.equal(locations.dataDir, effectiveDataDir);
    assert.equal(locations.bankFile, path.join(effectiveDataDir, "bank_transactions.xlsx"));
    const openResult = await handlers.get("app:open-data-location")(null, "folder");
    assert.deepEqual(openResult, { ok: true, path: effectiveDataDir });
    assert.equal(openedPath, effectiveDataDir);

    const fileTargets = [
      ["bank", locations.bankFile],
      ["share", locations.shareFile],
      ["pf-bank", locations.personalFinanceBankFile],
      ["pf-cash", locations.personalFinanceCashFile],
      ["pf-transfer", locations.personalFinanceTransferFile],
    ];
    for (const [target, expectedPath] of fileTargets) {
      fs.writeFileSync(expectedPath, "test placeholder");
      const result = await handlers.get("app:open-data-location")(null, target);
      assert.deepEqual(result, { ok: true, path: expectedPath });
      assert.equal(openedPath, expectedPath);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("client instance locks are separate by user-data folder and reject a duplicate", () => {
  withTempDir((directory) => {
    const exeLock = acquireClientInstanceLock({ directory: path.join(directory, "exe"), pid: 101, processIsAlive: () => true });
    const appxLock = acquireClientInstanceLock({ directory: path.join(directory, "appx"), pid: 202, processIsAlive: () => true });
    assert.equal(exeLock.acquired, true);
    assert.equal(appxLock.acquired, true);

    const duplicateExe = acquireClientInstanceLock({ directory: path.join(directory, "exe"), pid: 303, processIsAlive: (pid) => pid === 101 });
    assert.equal(duplicateExe.acquired, false);

    exeLock.release();
    const restartedExe = acquireClientInstanceLock({ directory: path.join(directory, "exe"), pid: 404, processIsAlive: () => false });
    assert.equal(restartedExe.acquired, true);
    restartedExe.release();
    appxLock.release();
  });
});

test("choosing a Settings data folder restarts the backend with that directory", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "finledge-settings-folder-change-"));
  try {
    const selectedPath = path.join(directory, "selected-data");
    const handlers = new Map();
    const events = [];
    let activePath = path.join(directory, "old-data");
    const runtime = {
      getRuntimeDataDir: () => activePath,
      getBackupDirectory: () => path.join(activePath, "backups"),
      getBuildTypeLabel: () => "Development",
      getDataDirError: () => "",
      getCanChooseDataFolder: () => false,
      getDataSetupStatus: () => "ready",
      releaseLock: () => events.push("release"),
      initializeDataDirectory: (value) => { activePath = value; events.push("initialize"); },
      persistDataDirectory: (value) => ({ savedTo: path.join(directory, "preference.json"), dataDir: value }),
      setDataDirError: () => {},
      getBackendEnv: () => ({ FINLEDGE_DATA_DIR: activePath }),
    };
    const processManager = {
      stopBackend: async () => { events.push("stop"); },
      startBackend: () => { events.push(`start:${runtime.getBackendEnv().FINLEDGE_DATA_DIR}`); },
    };
    registerDataHandlers({
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
      app: { getPath: () => directory },
      dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [selectedPath] }) },
      shell: { openPath: async () => "" },
      dataRuntime: runtime,
      appxPackageFamilyName: "",
      isAppxPackage: false,
      processManager,
      getMainWindow: () => null,
      logLine: () => {},
    });

    const result = await handlers.get("app:choose-data-folder")();
    assert.equal(result.ok, true);
    assert.equal(result.locations.dataDir, selectedPath);
    assert.equal(activePath, selectedPath);
    assert.deepEqual(events, ["stop", "release", "initialize", `start:${selectedPath}`]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("custom roaming override resolves to the physical AppX LocalCache path", () => {
  const appData = "C:/Users/test/AppData/Roaming";
  const appxRoot = "C:/Users/test/AppData/Local/Packages/Finledge_abcd1234/LocalCache/Roaming";
  const customDir = path.join(appData, "FinLedge Shared", "FinLedge Data");
  assert.equal(resolveAppxExternalPath({
    targetPath: customDir,
    packageFamilyName: "Finledge_abcd1234",
    userDataPath: path.join(appData, "Finledge AppX"),
    appDataPath: appData,
    localAppDataPath: "C:/Users/test/AppData/Local",
  }), path.join(appxRoot, "FinLedge Shared", "FinLedge Data"));
});

test("release links use the configured public release page as their safe origin", () => {
  const base = "https://github.example/finledge/releases";
  assert.equal(getSafeReleaseUrl(`${base}/latest`, base), `${base}/latest`);
  assert.equal(getSafeReleaseUrl("https://other.example/releases/latest", base), base);
  assert.equal(getSafeReleaseUrl("javascript:alert(1)", base), base);
  assert.equal(getSafeReleaseUrl("https://github.example.evil/finledge/releases/latest", base), base);
  assert.equal(getSafeReleaseUrl("https://user@github.example/finledge/releases/latest", base), base);
  assert.equal(getSafeReleaseUrl("https://evil.example/releases/latest", "javascript:alert(1)"), "");
});

test("active data lock blocks a second writer and release allows a new owner", () => {
  withTempDir((directory) => {
    const first = acquireDataDirectoryLock(directory, {
      processId: 101,
      processIsAlive: (pid) => pid === 101,
      setIntervalFn: () => 1,
      clearIntervalFn: () => {},
    });
    const second = acquireDataDirectoryLock(directory, {
      processId: 202,
      processIsAlive: (pid) => pid === 101,
      setIntervalFn: () => 2,
      clearIntervalFn: () => {},
    });
    assert.equal(first.acquired, true);
    assert.equal(second.acquired, false);
    first.release();
    assert.equal(acquireDataDirectoryLock(directory, {
      processId: 202,
      processIsAlive: () => false,
      setIntervalFn: () => 3,
      clearIntervalFn: () => {},
    }).acquired, true);
  });
});

test("stale lock is taken over and writable-directory errors are surfaced", () => {
  withTempDir((directory) => {
    const lockPath = path.join(directory, ".finledge.lock");
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 1, heartbeatAt: "2000-01-01T00:00:00.000Z" }));
    const lock = acquireDataDirectoryLock(directory, {
      processId: 2,
      now: () => Date.now(),
      processIsAlive: () => true,
      setIntervalFn: () => 1,
      clearIntervalFn: () => {},
    });
    assert.equal(lock.acquired, true);
    lock.release();

    const unwritableFileSystem = {
      mkdirSync: () => {},
      openSync: () => { const error = new Error("denied"); error.code = "EACCES"; throw error; },
    };
    assert.throws(() => ensureWritableDirectory(directory, { fileSystem: unwritableFileSystem }), { code: "EACCES" });
  });
});
