import { GENERAL_FILE_ROWS } from "./settingsConstants.js";
export default function GeneralSettingsSection({
  locations,
  message,
  openLocation,
  chooseDataFolder
}) {
  return <>
          <section className="card settings-panel">
            <h3>Excel file locations</h3>

            <div className="settings-row">
              <div>
                <strong>Build type</strong>
              </div>
              <code>{locations?.buildType || "Desktop app"}</code>
            </div>

            {locations?.dataDirError ? <div className="settings-row" role="alert">
                <p>{locations.dataDirError}</p>
                {locations?.canChooseDataFolder ? <button type="button" onClick={chooseDataFolder}>Choose data folder</button> : null}
              </div> : null}

            {locations?.dataSetupStatus === "legacy_fallback" ? <p className="subtitle" role="status">
                FinLedge could not migrate the previous data folder, so it opened that folder
                directly. Your original files were left in place.
              </p> : null}

            <div className="file-location-grid">
              {GENERAL_FILE_ROWS.map(row => <div key={row.target} className="file-location-row">
                  <span>{row.label}</span>
                  <code>{locations?.[row.pathKey] || row.fallback}</code>
                  <button type="button" className="ghost" onClick={() => openLocation(row.target)}>
                    {row.actionLabel}
                  </button>
                </div>)}
            </div>

            {message ? <p className="subtitle">{message}</p> : null}
          </section>
        </>;
}
