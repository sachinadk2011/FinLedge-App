import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  checkSettingsDataHasData,
  exportAllSettingsDataFiles,
  exportSettingsDataFile,
  getSettingsDataTypes,
  importSettingsDataFile,
} from "../api/settingsApi";

// import { OPEN_TOUR_EVENT, TOUR_DISABLED_KEY, TOUR_SEEN_KEY } from "../components/OnboardingTour"; // disabled for now

const SETTINGS_SECTIONS = [
  { id: "general", label: "General" },
  { id: "investment", label: "Investment" },
  { id: "import-export", label: "Import/Export" },
  { id: "backup", label: "Backup" },
  { id: "about", label: "About" },
  { id: "how-to-use", label: "How To Use" },
  { id: "privacy", label: "Privacy" },
  { id: "version", label: "Version" },
];

const GENERAL_FILE_ROWS = [
  {
    label: "Data folder",
    pathKey: "dataDir",
    target: "folder",
    actionLabel: "Open folder",
    fallback: "Desktop app only",
  },
  {
    label: "Bank Services",
    pathKey: "bankFile",
    target: "bank",
    actionLabel: "Open",
    fallback: "bank_transactions.xlsx",
  },
  {
    label: "Share Portfolio",
    pathKey: "shareFile",
    target: "share",
    actionLabel: "Open",
    fallback: "share_transactions.xlsx",
  },
  {
    label: "Personal Expenses — Bank Flow",
    pathKey: "personalFinanceBankFile",
    target: "pf-bank",
    actionLabel: "Open",
    fallback: "personal_finance_bank_flow.xlsx",
  },
  {
    label: "Personal Expenses — Cash Flow",
    pathKey: "personalFinanceCashFile",
    target: "pf-cash",
    actionLabel: "Open",
    fallback: "personal_finance_cash_flow.xlsx",
  },
];

function getDesktopBridge() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.financialTracker || null;
}

function SettingsPlaceholder({ title, detail }) {
  return (
    <section className="card settings-panel">
      <h3>{title}</h3>
      <p className="subtitle">{detail}</p>
    </section>
  );
}

function SettingsDisabledPanel({ title, detail, actions = [] }) {
  return (
    <section className="card settings-panel settings-panel--disabled">
      <h3>{title}</h3>
      <p className="subtitle">{detail}</p>
      {actions.length ? (
        <div className="settings-actions">
          {actions.map((action) => (
            <button key={action.label} type="button" className={action.className || ""} disabled>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
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
  // const [showTourOnStartup, setShowTourOnStartup] = useState(
  //   () => typeof window === "undefined" || !window.localStorage.getItem(TOUR_DISABLED_KEY)
  // ); // disabled for now

  useEffect(() => {
    let active = true;

    bridge
      ?.getDataLocations?.()
      .then((value) => {
        if (active) setLocations(value);
      })
      .catch(() => {
        if (active) setMessage("File locations are available in the desktop app.");
      });

    return () => {
      active = false;
    };
  }, [bridge]);

  useEffect(() => {
    let active = true;

    // Try the direct version IPC first (available in all packaged/dev modes)
    bridge
      ?.getAppVersion?.()
      .then((ver) => {
        if (!active) return;
        const v = String(ver || "").trim();
        if (v) setAppVersion(v);
      })
      .catch(() => {
        // Fallback: try the update status payload
        bridge
          ?.getUpdateStatus?.()
          .then((status) => {
            if (!active) return;
            const v = String(status?.currentVersion || status?.version || "").trim();
            if (v) setAppVersion(v);
          })
          .catch(() => {});
      });

    return () => {
      active = false;
    };
  }, [bridge]);

  useEffect(() => {
    let active = true;

    getSettingsDataTypes()
      .then((payload) => {
        if (!active) return;
        const types = payload?.data_types || [];
        setDataTypes(types);
        if (types.length) {
          setImportType((current) => (types.some((item) => item.id === current) ? current : types[0].id));
        }
      })
      .catch((exc) => {
        if (active) setError(String(exc.message || exc));
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!success && !error) return undefined;
    const timer = window.setTimeout(() => {
      setSuccess("");
      setError("");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [success, error]);

  const openLocation = async (target) => {
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

  const selectedImportType = dataTypes.find((item) => item.id === importType);

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
        // Can't reach the backend — just proceed with replace
      }
    }

    setImportSubmitting(true);
    try {
      const result = await importSettingsDataFile(importType, importFile, importMode || "replace");
      setSuccess(result?.message || "Data imported successfully.");
      setImportFile(null);
      setImportMode("replace");
      setShowMergePrompt(false);
      event.target.reset();
    } catch (exc) {
      setError(String(exc.message || exc));
    } finally {
      setImportSubmitting(false);
    }
  }

  async function handleExport(dataType) {
    setError("");
    setSuccess("");
    setExportTarget(dataType || "all");

    try {
      const result = dataType
        ? await exportSettingsDataFile(dataType)
        : await exportAllSettingsDataFiles();

      if (result?.cancelled) {
        return;
      }

      setSuccess(dataType ? "Data file exported successfully." : "All data files exported successfully.");
    } catch (exc) {
      setError(String(exc.message || exc));
    } finally {
      setExportTarget("");
    }
  }

  // --- Tour helpers disabled for now ---
  // const startTour = () => window.dispatchEvent(new Event(OPEN_TOUR_EVENT));
  // const toggleStartupTour = (checked) => {
  //   setShowTourOnStartup(checked);
  //   if (checked) {
  //     window.localStorage.removeItem(TOUR_DISABLED_KEY);
  //     window.localStorage.removeItem(TOUR_SEEN_KEY);
  //   } else {
  //     window.localStorage.setItem(TOUR_DISABLED_KEY, "1");
  //     window.localStorage.setItem(TOUR_SEEN_KEY, "1");
  //   }
  // };

  const activeLabel = SETTINGS_SECTIONS.find((section) => section.id === activeSection)?.label || "Settings";

  function renderSectionContent() {
    if (activeSection === "general") {
      return (
        <>
          {/* Guide section — disabled for now, will be re-enabled when tour is ready
          <section className="card settings-panel">
            <h3>Guide</h3>
            <div className="settings-row">
              <div>
                <strong>First-run tour</strong>
                <p className="subtitle">Show the product guide for new users, or run it again whenever needed.</p>
              </div>
              <div className="settings-actions">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={showTourOnStartup}
                    onChange={(event) => toggleStartupTour(event.target.checked)}
                  />
                  Show on startup
                </label>
                <button type="button" onClick={startTour}>
                  Start tour
                </button>
              </div>
            </div>
          </section>
          */}

          <section className="card settings-panel">
            <h3>Excel file locations</h3>
            <p className="subtitle">Each FinLedge workbook is stored locally. Open a file directly or browse the data folder.</p>

            <div className="file-location-grid">
              {GENERAL_FILE_ROWS.map((row) => (
                <div key={row.target} className="file-location-row">
                  <span>{row.label}</span>
                  <code>{locations?.[row.pathKey] || row.fallback}</code>
                  <button type="button" className="ghost" onClick={() => openLocation(row.target)}>
                    {row.actionLabel}
                  </button>
                </div>
              ))}
            </div>

            {message ? <p className="subtitle">{message}</p> : null}
          </section>
        </>
      );
    }

    if (activeSection === "investment") {
      return (
        <SettingsDisabledPanel
          title="Investment"
          detail="Interest rate settings will be available in a future update."
          actions={[{ label: "Interest rate settings" }]}
        />
      );
    }

    if (activeSection === "import-export") {
      return (
        <>
          <section className="card settings-panel">
            <h3>Import data</h3>
            <p className="subtitle">
              Import an Excel file to restore or update a data type. The file must contain
              the core data columns; internal auto-generated columns (timestamps, Sync Ref)
              are optional — they are filled in automatically if missing.
            </p>

            <form className="settings-import-form" onSubmit={handleImportSubmit}>
              <label>
                Data type
                <select value={importType} onChange={(event) => { setImportType(event.target.value); setShowMergePrompt(false); setImportMode("replace"); }}>
                  {dataTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Excel file
                <input
                  type="file"
                  accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => { setImportFile(event.target.files?.[0] || null); setShowMergePrompt(false); setImportMode("replace"); }}
                />
              </label>

              {selectedImportType?.required_headers?.length ? (
                <div className="settings-header-preview">
                  <strong>Required columns</strong>
                  <code>{selectedImportType.required_headers.join(", ")}</code>
                </div>
              ) : null}

              {/* Merge / Replace prompt: shown when user clicks Import and data already exists */}
              {showMergePrompt ? (
                <div className="settings-merge-prompt">
                  <p className="subtitle">
                    <strong>Existing data found.</strong> How would you like to handle it?
                  </p>
                  <div className="settings-merge-options">
                    <label className="settings-merge-option">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={importMode === "replace"}
                        onChange={() => setImportMode("replace")}
                      />
                      <span>
                        <strong>Replace</strong> — discard all existing data and use only the imported file.
                      </span>
                    </label>
                    <label className="settings-merge-option">
                      <input
                        type="radio"
                        name="importMode"
                        value="merge"
                        checked={importMode === "merge"}
                        onChange={() => setImportMode("merge")}
                      />
                      <span>
                        <strong>Merge</strong> — keep existing data and append the imported rows after it.
                      </span>
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="settings-actions">
                <button type="submit" disabled={importSubmitting}>
                  {importSubmitting
                    ? "Importing..."
                    : showMergePrompt
                    ? `Confirm — ${importMode === "merge" ? "Merge" : "Replace"}`
                    : "Import file"}
                </button>
                {showMergePrompt ? (
                  <button type="button" className="ghost" onClick={() => { setShowMergePrompt(false); setImportMode("replace"); }}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="card settings-panel">
            <h3>Export data</h3>
            <p className="subtitle">Download plain copies of the current live Excel files with no transformation.</p>

            <div className="settings-export-grid">
              {dataTypes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="ghost"
                  disabled={exportTarget !== ""}
                  onClick={() => handleExport(item.id)}
                >
                  {exportTarget === item.id ? "Exporting..." : `Export ${item.label}`}
                </button>
              ))}
              <button
                type="button"
                disabled={exportTarget !== ""}
                onClick={() => handleExport("")}
              >
                {exportTarget === "all" ? "Exporting..." : "Export all data files (.zip)"}
              </button>
            </div>
          </section>
        </>
      );
    }

    if (activeSection === "backup") {
      return (
        <SettingsDisabledPanel
          title="Backup"
          detail="Backup and restore will be available in a future update."
          actions={[
            { label: "Create backup" },
            { label: "Restore backup", className: "ghost" },
          ]}
        />
      );
    }

    if (activeSection === "about") {
      return (
        <section className="card settings-panel">
          <h3>About FinLedge</h3>

          <p className="subtitle">
            FinLedge is an offline-first personal financial operating system. It keeps all of
            your financial data on your own device in plain Excel files — no cloud account, no
            internet connection, and no data sent anywhere.
          </p>

          <h4>Modules</h4>

          <p className="subtitle">
            <strong>Bank Services</strong> — Answers one question: is my bank account itself
            worth it? Track interest earned against charges like mobile banking fees, debit
            card charges, locker costs, and renewal fees. If your bank is quietly draining
            money, Bank Services will show you.
          </p>
          <p className="subtitle">
            <strong>Share Portfolio</strong> — Track every stage of your market investments:
            IPO applications, secondary market buys and sells, dividend income (cash and
            bonus), and SIP installments and redemptions. Profit and loss is calculated
            automatically using FIFO lot matching.
          </p>
          <p className="subtitle">
            <strong>Personal Expenses</strong> — Your everyday income and expenses, split into
            two flows. <em>Bank Flow</em> tracks money moving through your bank accounts.
            <em> Cash Flow</em> tracks cash-in-hand spending that never touches a bank
            statement. The <em>Combined Overview</em> merges both into a single view so you
            can see your full financial picture.
          </p>
          <p className="subtitle">
            <strong>Financial Summary</strong> — A read-only analytics page that pulls data
            from Bank Services, Share Portfolio, and Personal Expenses together. View your
            overall financial position without entering any data here.
          </p>

          <h4>How Bank Flow's live sync works</h4>

          <p className="subtitle">
            When you record a transaction in Share Portfolio, a read-only entry automatically
            appears in Personal Expenses &gt; Bank Flow — you never need to enter the same
            thing twice. Here is what shows up:
          </p>
          <p className="subtitle">
            <strong>Investment Expense:</strong> IPO applications, secondary market buys, and
            SIP installment payments.<br />
            <strong>Investment Income:</strong> Share sells, cash dividend payments, and SIP
            redemptions.<br />
            <strong>Bonus dividends</strong> do not create a Bank Flow entry because no money
            changes hands.
          </p>
          <p className="subtitle">
            Bank Services rows also appear in Bank Flow automatically: Interest Earned shows
            as income, and every other Bank Services category shows as a service cost. These
            synced entries are read-only in Personal Expenses — edit or delete them in their
            original module and the change is reflected immediately.
          </p>

          <h4>Where your data lives</h4>

          <p className="subtitle">
            Every FinLedge module stores its data in a separate Excel workbook on your own
            device. Bank Services uses <code>bank_transactions.xlsx</code>, Share Portfolio
            uses <code>share_transactions.xlsx</code>, and Personal Expenses uses
            <code> personal_finance_bank_flow.xlsx</code> and
            <code> personal_finance_cash_flow.xlsx</code>. Nothing is sent to a server,
            synced to the cloud, or shared with any third party.
          </p>

          <h4>Version</h4>
          <div className="settings-version-row">
            <span>Current version</span>
            <strong>{appVersion || (bridge ? "Loading..." : "Web preview")}</strong>
          </div>
        </section>
      );
    }

    if (activeSection === "how-to-use") {
      return (
        <section className="card settings-panel">
          <h3>How to use FinLedge</h3>

          <p className="subtitle">
            Every module follows the same four-step pattern:
          </p>
          <ol className="subtitle" style={{ paddingLeft: "1.2em", margin: "0 0 1em" }}>
            <li>Open a module from the top navigation bar.</li>
            <li>Fill in the entry form and click <strong>Add Bank Service Entry</strong>, <strong>Add Share Entry</strong>, or <strong>Add Personal Expenses Entry</strong> — the button label changes depending on the module.</li>
            <li>Review the new row in the <strong>Recent transactions</strong> table below the form. Use the edit or delete icons on any row to correct a mistake.</li>
            <li>Click <strong>View dashboard</strong> (top-right of the page) to see charts and totals for the module.</li>
          </ol>

          <h4>Adding a Bank Services entry</h4>
          <ol className="subtitle" style={{ paddingLeft: "1.2em", margin: "0 0 1em" }}>
            <li>Go to <strong>Bank Services</strong> in the top nav.</li>
            <li>Pick a <strong>Category</strong> from the dropdown (e.g. Interest Earned, Mobile Banking Charge, Locker).</li>
            <li>Enter the <strong>Amount</strong> as a plain positive number — the app determines whether it is a credit or debit from the category.</li>
            <li>Add an optional <strong>Description</strong>, then click <strong>Add Bank Service Entry</strong>.</li>
          </ol>

          <h4>Adding a Share Portfolio entry</h4>
          <ol className="subtitle" style={{ paddingLeft: "1.2em", margin: "0 0 1em" }}>
            <li>Go to <strong>Share Portfolio</strong> in the top nav.</li>
            <li>Choose a transaction type: IPO, Buy, Sell, Dividend, Bonus, or SIP.</li>
            <li>Fill in Share Name, Per Unit Price, quantity (Allotted / Units), and the ASBA or exchange charge where applicable.</li>
            <li>Click <strong>Add Share Entry</strong>. Profit/loss and cumulative profit are calculated automatically.</li>
          </ol>

          <h4>Adding a Personal Expenses entry (Bank Flow or Cash Flow)</h4>
          <ol className="subtitle" style={{ paddingLeft: "1.2em", margin: "0 0 1em" }}>
            <li>Go to <strong>Personal Expenses</strong> in the top nav. You will see three cards: <strong>Bank Flow</strong>, <strong>Cash Flow</strong>, and <strong>Combined Overview</strong>.</li>
            <li>Click <strong>Bank Flow</strong> to record money that moved through a bank account, or <strong>Cash Flow</strong> to record cash-in-hand spending.</li>
            <li>Choose a <strong>Direction</strong> (Income or Expense) and select the matching <strong>Category</strong>.</li>
            <li>Enter the <strong>Amount</strong> and an optional <strong>Description</strong>, then click <strong>Add Personal Expenses Entry</strong>.</li>
          </ol>
          <p className="subtitle">
            <strong>Note:</strong> Bank Flow also shows read-only rows synced from Share Portfolio and Bank Services. You cannot add, edit, or delete those rows here — see the FAQ below.
          </p>

          <h4>Reading the dashboards</h4>

          <p className="subtitle">
            <strong>Bank Services dashboard</strong> — three stat cards:<br />
            <strong>Interest earned</strong> = total interest credited to your account.<br />
            <strong>Total charges</strong> = sum of all fees and service costs.<br />
            <strong>Net balance</strong> = Interest earned minus Total charges. Positive means the bank is paying you more than it is charging you.
          </p>
          <p className="subtitle">
            <strong>Share Portfolio dashboard</strong> — key stat cards:<br />
            <strong>Total IPO investment</strong> and <strong>Secondary buy amount</strong> = money put in.<br />
            <strong>Total sell amount</strong> = proceeds from selling shares.<br />
            <strong>Realized trading profit</strong> = profit/loss on closed trades (sell minus FIFO cost).<br />
            <strong>Total dividend</strong> = all cash dividends received.<br />
            <strong>SIP investment / SIP redeemed / SIP profit/loss</strong> = SIP-specific tracking.<br />
            <strong>Grand total investment</strong> and <strong>Grand total profit/loss</strong> = across IPO, secondary, and SIP combined.
          </p>
          <p className="subtitle">
            <strong>Bank Flow dashboard</strong> — key stat cards:<br />
            <strong>Income</strong> = manual bank income entries.<br />
            <strong>Expense</strong> = manual bank expense entries.<br />
            <strong>Investment expense</strong> = IPO / Buy / SIP installments synced from Share Portfolio.<br />
            <strong>Investment income</strong> = Sell / Cash dividend / SIP redemption synced from Share Portfolio.<br />
            <strong>Interest earned</strong> and <strong>Service cost</strong> = synced from Bank Services.<br />
            <strong>Total income</strong>, <strong>Total expense</strong>, and <strong>Net profit/loss</strong> = the full picture across manual and synced entries.
          </p>
          <p className="subtitle">
            <strong>Cash Flow dashboard</strong> — three stat cards: <strong>Income</strong>, <strong>Expense</strong>, and <strong>Net profit/loss</strong> for cash-only entries.
          </p>
          <p className="subtitle">
            <strong>Combined Overview dashboard</strong> — five stat cards: <strong>Overall income</strong>, <strong>Overall expenses</strong>, <strong>Overall net/savings</strong>, <strong>Bank net</strong>, and <strong>Cash net</strong>.
          </p>

          <h4>Using Import and Export</h4>

          <p className="subtitle">
            Open <em>Settings → Import/Export</em>.
          </p>
          <p className="subtitle">
            <strong>To export one file:</strong> click <strong>Export Bank Services</strong>, <strong>Export Share Portfolio</strong>, <strong>Export Personal Expenses — Bank Flow</strong>, or <strong>Export Personal Expenses — Cash Flow</strong>. A save-dialog opens so you can choose where to save it.
          </p>
          <p className="subtitle">
            <strong>To export all files at once:</strong> click <strong>Export all data files (.zip)</strong>. You get a single zip containing all four workbooks.
          </p>
          <p className="subtitle">
            <strong>To import a file:</strong> choose a <strong>Data type</strong>, pick an <strong>Excel file</strong>, and click <strong>Import file</strong>. The Required columns listed below the dropdown show the minimum columns your file must contain. Internal timestamp columns are optional — they are filled in automatically. If you already have data, you will be asked whether to <strong>Replace</strong> (discard existing) or <strong>Merge</strong> (keep existing and append imported rows). The existing workbook is always backed up before any change is made.
          </p>

          <h4>Frequently asked questions</h4>

          <p className="subtitle">
            <strong>Why does a Bank Flow entry appear that I did not add?</strong><br />
            Bank Flow includes read-only rows synced live from Share Portfolio and Bank Services — you never need to enter the same transaction twice. To edit or delete one of those rows, go to the module where it was originally recorded and make the change there. The Bank Flow view updates immediately.
          </p>
          <p className="subtitle">
            <strong>What happens to my data when I upgrade FinLedge?</strong><br />
            A one-time migration runs automatically on startup when the app detects an older data format. Your original files are backed up first. If anything looks wrong, open <em>Settings → General</em> to find the data folder and check the backup inside it.
          </p>
          <p className="subtitle">
            <strong>Does FinLedge send my data anywhere?</strong><br />
            No. All data stays in Excel files on your device. The only network request FinLedge makes is a version check when you open Settings.
          </p>
        </section>
      );
    }

    if (activeSection === "privacy") {
      return (
        <SettingsPlaceholder
          title="Privacy"
          detail="FinLedge stores your financial data locally on this device. No account sign-in or cloud sync is required in this version."
        />
      );
    }

    if (activeSection === "version") {
      return (
        <section className="card settings-panel">
          <h3>Version</h3>
          <p className="subtitle">Installed FinLedge build information.</p>
          <div className="settings-version-row">
            <span>Current version</span>
            <strong>{appVersion || (bridge ? "—" : "Web preview")}</strong>
          </div>
          {bridge ? (
            <div className="settings-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="ghost"
                onClick={() => bridge.checkForUpdates?.()}
              >
                Check for updates
              </button>
            </div>
          ) : null}
        </section>
      );
    }

    return null;
  }

  return (
    <main className="page">
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
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`settings-nav-item${activeSection === section.id ? " is-active" : ""}`}
              aria-current={activeSection === section.id ? "page" : undefined}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {renderSectionContent()}
          {success ? <p className="success">{success}</p> : null}
          {error ? <pre className="error-pre">{error}</pre> : null}
        </div>
      </div>
    </main>
  );
}

export default Settings;
