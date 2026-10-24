export default function BackupSettingsSection({
  locations,
  openLocation
}) {
  return <section className="card settings-panel">
          <h3>Automatic backups</h3>
          <div className="settings-row">
            <div>
              <strong>Backup folder</strong>
              <p className="subtitle"><code>{locations?.backupDir || "Desktop app only"}</code></p>
            </div>
            <div className="settings-actions">
              <button type="button" className="ghost" onClick={() => openLocation("backups")}>
                Open backup folder
              </button>
            </div>
          </div>
        </section>;
}
