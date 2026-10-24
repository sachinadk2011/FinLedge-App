function SettingsPlaceholder({
  title
}) {
  return <section className="card settings-panel">
      <h3>{title}</h3>
    </section>;
}
function SettingsDisabledPanel({
  title,
  detail,
  actions = []
}) {
  return <section className="card settings-panel settings-panel--disabled">
      <h3>{title}</h3>
      {detail ? <p className="subtitle">{detail}</p> : null}
      {actions.length ? <div className="settings-actions">
          {actions.map(action => <button key={action.label} type="button" className={action.className || ""} disabled>
              {action.label}
            </button>)}
        </div> : null}
    </section>;
}
export { SettingsPlaceholder, SettingsDisabledPanel };
