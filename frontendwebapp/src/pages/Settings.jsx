import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { OPEN_TOUR_EVENT, TOUR_DISABLED_KEY, TOUR_SEEN_KEY } from "../components/OnboardingTour";

function getDesktopBridge() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.financialTracker || null;
}

function Settings() {
  const navigate = useNavigate();
  const bridge = getDesktopBridge();
  const [locations, setLocations] = useState(null);
  const [message, setMessage] = useState("");
  const [showTourOnStartup, setShowTourOnStartup] = useState(
    () => typeof window === "undefined" || !window.localStorage.getItem(TOUR_DISABLED_KEY)
  );

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

  const openLocation = async (target) => {
    setMessage("");
    if (!bridge?.openDataLocation) {
      setMessage("Open folder is available in the desktop app.");
      return;
    }

    const result = await bridge.openDataLocation(target);
    if (result?.ok === false) {
      setMessage("Could not open that location.");
    }
  };

  const startTour = () => {
    window.dispatchEvent(new Event(OPEN_TOUR_EVENT));
  };

  const toggleStartupTour = (checked) => {
    setShowTourOnStartup(checked);
    if (checked) {
      window.localStorage.removeItem(TOUR_DISABLED_KEY);
      window.localStorage.removeItem(TOUR_SEEN_KEY);
    } else {
      window.localStorage.setItem(TOUR_DISABLED_KEY, "1");
      window.localStorage.setItem(TOUR_SEEN_KEY, "1");
    }
  };

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>App settings</h1>
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

      <section className="card">
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

      <section className="card">
        <h3>Excel file location</h3>
        <p className="subtitle">Your bank and share records are stored locally as Excel files.</p>

        <div className="file-location-grid">
          <div className="file-location-row">
            <span>Data folder</span>
            <code>{locations?.dataDir || "Desktop app only"}</code>
            <button type="button" className="ghost" onClick={() => openLocation("folder")}>
              Open folder
            </button>
          </div>
          <div className="file-location-row">
            <span>Bank Excel file</span>
            <code>{locations?.bankFile || "bank_transactions.xlsx"}</code>
            <button type="button" className="ghost" onClick={() => openLocation("bank")}>
              Show file
            </button>
          </div>
          <div className="file-location-row">
            <span>Share Excel file</span>
            <code>{locations?.shareFile || "share_transactions.xlsx"}</code>
            <button type="button" className="ghost" onClick={() => openLocation("share")}>
              Show file
            </button>
          </div>
        </div>

        {message ? <p className="subtitle">{message}</p> : null}
      </section>
    </main>
  );
}

export default Settings;
