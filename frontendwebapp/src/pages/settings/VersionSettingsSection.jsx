export default function VersionSettingsSection({
  appVersion,
  bridge
}) {
  return <section className="card settings-panel">
          <h3>Version</h3>
          <div className="settings-version-row">
            <span>Current version</span>
            <strong>{appVersion || (bridge ? "—" : "Web preview")}</strong>
          </div>
          {bridge?.updatesManagedByWindows ? <p>Updates are managed by Windows and Microsoft Store.</p> : null}
          {bridge && !bridge.updatesManagedByWindows ? <div className="settings-actions" style={{
      marginTop: 16
    }}>
              <button type="button" className="ghost" onClick={() => bridge.checkForUpdates?.()}>
                Check for updates
              </button>
            </div> : null}
        </section>;
}
