import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearSettingsModuleData, exportAllSettingsDataFiles, exportSettingsDataFile, getSettingsDataTypes, getSettingsDevTools, previewSettingsDataFile } from "../api/settingsApi";
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
  const [importMode, setImportMode] = useState("merge");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [exportTarget, setExportTarget] = useState("");
  const [devTools, setDevTools] = useState({ enabled: false, mode: "" });
  const [clearTarget, setClearTarget] = useState("share");
  const [clearSubmitting, setClearSubmitting] = useState(false);

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
  useEffect(() => {
    let active = true;
    getSettingsDevTools().then(value => {
      if (active) setDevTools(value || { enabled: false, mode: "" });
    }).catch(() => {
      if (active) setDevTools({ enabled: false, mode: "" });
    });
    return () => { active = false; };
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

    setImportSubmitting(true);
    try {
      const previewResult = await previewSettingsDataFile(importType, importFile, importMode || "replace");
      const review = {
        ...previewResult.data,
        filename: importFile.name,
        currentStep: "review",
      };
      localStorage.setItem("finledge.import-review.v1", JSON.stringify(review));
      setImportFile(null);
      event.target.reset();
      navigate("/import-review");
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

  async function handleClearModule() {
    const target = clearTarget;
    const targetLabel = target === "share-sip" ? "SIP" : (dataTypes.find(item => item.id === target)?.label || target);
    if (!window.confirm(`Clear all ${targetLabel} transaction records? The workbook, worksheets, headers, and other modules will remain.`)) return;
    setError("");
    setSuccess("");
    setClearSubmitting(true);
    try {
      const result = await clearSettingsModuleData(target);
      setSuccess(`Cleared ${result.removed_rows} ${targetLabel} transaction ${result.removed_rows === 1 ? "record" : "records"}.`);
      window.dispatchEvent(new CustomEvent("finledge:data-changed", { detail: { dataType: target } }));
    } catch (exc) {
      setError(exc.message || "Could not clear module data.");
    } finally {
      setClearSubmitting(false);
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
          {devTools.enabled ? (
            <section className="card dev-data-clear" aria-label="Development data clearing">
              <h2>Development / Testing data tools</h2>
              <p>Environment: {devTools.mode}. This removes transaction rows only; workbook files, worksheets, headers, and other modules are preserved.</p>
              <label className="field">
                <span>Module to clear</span>
                <select value={clearTarget} onChange={event => setClearTarget(event.target.value)}>
                  {dataTypes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  <option value="share-sip">SIP transactions only</option>
                </select>
              </label>
              <button className="danger" type="button" disabled={clearSubmitting} onClick={handleClearModule}>
                {clearSubmitting ? "Working…" : `Clear ${clearTarget === "share-sip" ? "SIP" : (dataTypes.find(item => item.id === clearTarget)?.label || "module")} records`}
              </button>
            </section>
          ) : null}
          <StatusNotice message={success} kind="success" onDismiss={() => setSuccess("")} />
          <StatusNotice message={error} onDismiss={() => setError("")} />
        </div>
      </div>
    </main>;
}
export default Settings;
