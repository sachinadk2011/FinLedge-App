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
          {bridge?.updatesManagedByWindows ? <p>Microsoft Store manages installation and progress for Store updates.</p> : null}
          {bridge?.isTestBuild ? <p>Test update notices use a local policy file. Edit it, then check for updates again.</p> : null}
          {bridge?.isTestBuild ? <div className="settings-actions" style={{ marginTop: 12 }}>
              <button type="button" className="ghost" onClick={() => bridge.openTestUpdatePolicyFolder?.()}>
                Open test update policy folder
              </button>
            </div> : null}
          {bridge && (!bridge.updatesManagedByWindows || bridge.storeAppxUpdates || bridge.testUpdateNotices) ? <div className="settings-actions" style={{
      marginTop: 16
    }}>
              <button type="button" className="ghost" onClick={() => bridge.checkForUpdates?.()}>
                Check for updates
              </button>
            </div> : null}
        </section>;
}
