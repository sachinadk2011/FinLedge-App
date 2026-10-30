import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { checkSettingsDataHasData, exportAllSettingsDataFiles, exportSettingsDataFile, getSettingsDataTypes, importSettingsDataFile } from "../api/settingsApi";
import StatusNotice from "../components/StatusNotice";
import GeneralSettingsSection from "./settings/GeneralSettingsSection.jsx";
import InvestmentSettingsSection from "./settings/InvestmentSettingsSection.jsx";
import ImportExportSettingsSection from "./settings/ImportExportSettingsSection.jsx";
import BackupSettingsSection from "./settings/BackupSettingsSection.jsx";
import AboutSettingsSection from "./settings/AboutSettingsSection.jsx";
import HowToUseSettingsSection from "./settings/HowToUseSettingsSection.jsx";
import PrivacySettingsSection from "./settings/PrivacySettingsSection.jsx";
import VersionSettingsSection from "./settings/VersionSettingsSection.jsx";
import { SETTINGS_SECTIONS } from "./settings/settingsConstants.js";


function getDesktopBridge() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.financialTracker || null;
}

function getSimpleImportError(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("fetch") || message.includes("network") || message.includes("connect")) {
    return "Could not connect. Try again.";
  }
  return "Import failed. Check the selected file and try again.";
}

function Settings() {
  const navigate = useNavigate();
  const bridge = getDesktopBridge();
  const [activeSection, setActiveSection] = useState("general");
  const [locations, setLocations] = useState(null);
  const [message, setMessage] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [dataTypes, setDataTypes] = useState([]);
  const [importType, setImportType] = useState("bank");
  const [importFile, setImportFile] = useState(null);
  const [importMode, setImportMode] = useState("replace");
  const [showMergePrompt, setShowMergePrompt] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [exportTarget, setExportTarget] = useState("");

  useEffect(() => {
    let active = true;
    bridge?.getDataLocations?.().then(value => {
      if (active) setLocations(value);
    }).catch(() => {
      if (active) setMessage("File locations are available in the desktop app.");
    });
    return () => {
      active = false;
    };
  }, [bridge]);
  useEffect(() => {
    let active = true;

    // Try the direct version IPC first (available in all packaged/dev modes)
    bridge?.getAppVersion?.().then(ver => {
      if (!active) return;
      const v = String(ver || "").trim();
      if (v) setAppVersion(v);
    }).catch(() => {
      // Fallback: try the update status payload
      bridge?.getUpdateStatus?.().then(status => {
        if (!active) return;
        const v = String(status?.currentVersion || status?.version || "").trim();
        if (v) setAppVersion(v);
      }).catch(() => {});
    });
    return () => {
      active = false;
    };
  }, [bridge]);
  useEffect(() => {
    let active = true;
    getSettingsDataTypes().then(payload => {
      if (!active) return;
      const types = payload?.data_types || [];
      setDataTypes(types);
      if (types.length) {
        setImportType(current => types.some(item => item.id === current) ? current : types[0].id);
      }
    }).catch(() => {
      if (active) setError("Could not load data types. Try again.");
    });
    return () => {
      active = false;
    };
  }, []);
  const openLocation = async target => {
    setMessage("");
    if (!bridge?.openDataLocation) {
      setMessage("Open actions are available in the desktop app.");
      return;
    }
    const result = await bridge.openDataLocation(target);
    if (result?.ok === false) {
      setMessage("Could not open that location.");
    }
  };
  const chooseDataFolder = async () => {
    if (!bridge?.chooseDataFolder) {
      setError("Folder selection is available in the desktop app.");
      return;
    }
    const result = await bridge.chooseDataFolder();
    if (result?.cancelled) return;
    if (!result?.ok) {
      setError("Could not use that folder. Choose another folder.");
      return;
    }
    setLocations(result.locations);
    setError("");
    setSuccess("Data folder updated.");
  };
  const selectedImportType = dataTypes.find(item => item.id === importType);
  async function handleImportSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!importFile) {
      setError("Choose an Excel file to import.");
      return;
    }

    // First click: check if there is existing live data that would be overwritten.
    // If yes, show the Replace / Merge prompt and wait for the user to confirm.
    if (!showMergePrompt) {
      try {
        const hasData = await checkSettingsDataHasData(importType);
        if (hasData) {
          setShowMergePrompt(true);
          return;
        }
      } catch {
        // Fail closed: without checking the target workbook, never proceed with
        // a potentially destructive replace import.
        setError("Could not check existing data. Try again.");
        return;
      }
    }
    setImportSubmitting(true);
    try {
      const importResult = await importSettingsDataFile(importType, importFile, importMode || "replace");
      setImportFile(null);
      setImportMode("replace");
      setShowMergePrompt(false);
      event.target.reset();
      setSuccess(importResult?.message || "Import completed.");
    } catch (exc) {
      setError(getSimpleImportError(exc));
    } finally {
      setImportSubmitting(false);
    }
  }
  async function handleExport(dataType) {
    setError("");
    setSuccess("");
    setExportTarget(dataType || "all");
    try {
      const result = dataType ? await exportSettingsDataFile(dataType) : await exportAllSettingsDataFiles();
      if (result?.cancelled) {
        return;
      }
      setSuccess(dataType ? "Data file exported successfully." : "All data files exported successfully.");
    } catch (exc) {
      setError("Export failed. Try again.");
    } finally {
      setExportTarget("");
    }
  }

  const activeLabel = SETTINGS_SECTIONS.find(section => section.id === activeSection)?.label || "Settings";
  function renderSectionContent() {
    const selectedImportType = dataTypes.find(item => item.id === importType);
    const sharedLocationProps = {
      locations,
      openLocation
    };
    const importExportProps = {
      dataTypes,
      importType,
      setImportType,
      importFile,
      setImportFile,
      importMode,
      setImportMode,
      showMergePrompt,
      setShowMergePrompt,
      selectedImportType,
      handleImportSubmit,
      importSubmitting,
      exportTarget,
      handleExport
    };
    switch (activeSection) {
      case "general":
        return <GeneralSettingsSection {...sharedLocationProps} message={message} chooseDataFolder={chooseDataFolder} />;
      case "investment":
        return <InvestmentSettingsSection />;
      case "import-export":
        return <ImportExportSettingsSection {...importExportProps} />;
      case "backup":
        return <BackupSettingsSection {...sharedLocationProps} />;
      case "about":
        return <AboutSettingsSection appVersion={appVersion} bridge={bridge} />;
      case "how-to-use":
        return <HowToUseSettingsSection />;
      case "privacy":
        return <PrivacySettingsSection />;
      case "version":
        return <VersionSettingsSection appVersion={appVersion} bridge={bridge} />;
      default:
        return null;
    }
  }
  return <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>{activeLabel}</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" type="button" onClick={() => navigate(-1)}>
            Back
          </button>
          <Link className="ghost" to="/">
            Home
          </Link>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map(section => <button key={section.id} type="button" className={`settings-nav-item${activeSection === section.id ? " is-active" : ""}`} aria-current={activeSection === section.id ? "page" : undefined} onClick={() => setActiveSection(section.id)}>
              {section.label}
            </button>)}
        </nav>

        <div className="settings-content">
          {renderSectionContent()}
          <StatusNotice message={success} kind="success" onDismiss={() => setSuccess("")} />
          <StatusNotice message={error} onDismiss={() => setError("")} />
        </div>
      </div>
    </main>;
}
export default Settings;
