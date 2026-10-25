export default function ImportExportSettingsSection({
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
}) {
  return <>
          <section className="card settings-panel">
            <h3>Import data</h3>

            <form className="settings-import-form" onSubmit={handleImportSubmit}>
              <label>
                Data type
                <select value={importType} onChange={event => {
            setImportType(event.target.value);
            setShowMergePrompt(false);
            setImportMode("replace");
          }}>
                  {dataTypes.map(item => <option key={item.id} value={item.id}>
                      {item.label}
                    </option>)}
                </select>
              </label>

              <label>
                Excel file
                <input type="file" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => {
            setImportFile(event.target.files?.[0] || null);
            setShowMergePrompt(false);
            setImportMode("replace");
          }} />
              </label>

              {selectedImportType?.required_headers?.length ? <div className="settings-header-preview">
                  <strong>Required columns</strong>
                  <code>{selectedImportType.required_headers.join(", ")}</code>
                </div> : null}

              {/* Merge / Replace prompt: shown when user clicks Import and data already exists */}
              {showMergePrompt ? <div className="settings-merge-prompt">
                  <p className="subtitle">
                    <strong>Records already exist in this workbook.</strong> This checks all dates, even if the dashboard's current period looks empty.
                  </p>
                  <div className="settings-merge-options">
                    <label className="settings-merge-option">
                      <input type="radio" name="importMode" value="replace" checked={importMode === "replace"} onChange={() => setImportMode("replace")} />
                      <span>
                        <strong>Replace</strong> — discard all existing data and use only the imported file.
                      </span>
                    </label>
                    <label className="settings-merge-option">
                      <input type="radio" name="importMode" value="merge" checked={importMode === "merge"} onChange={() => setImportMode("merge")} />
                      <span>
                        <strong>Merge</strong> — keep existing data and append the imported rows after it.
                      </span>
                    </label>
                  </div>
                </div> : null}

              <div className="settings-actions">
                <button type="submit" disabled={importSubmitting}>
                  {importSubmitting ? "Importing..." : showMergePrompt ? `Confirm — ${importMode === "merge" ? "Merge" : "Replace"}` : "Import file"}
                </button>
                {showMergePrompt ? <button type="button" className="ghost" onClick={() => {
            setShowMergePrompt(false);
            setImportMode("replace");
          }}>
                    Cancel
                  </button> : null}
              </div>
            </form>
          </section>

          <section className="card settings-panel">
            <h3>Export data</h3>

            <div className="settings-export-grid">
              {dataTypes.map(item => <button key={item.id} type="button" className="ghost" disabled={exportTarget !== ""} onClick={() => handleExport(item.id)}>
                  {exportTarget === item.id ? "Exporting..." : `Export ${item.label}`}
                </button>)}
              <button type="button" disabled={exportTarget !== ""} onClick={() => handleExport("")}>
                {exportTarget === "all" ? "Exporting..." : "Export all data files (.zip)"}
              </button>
            </div>
          </section>
        </>;
}
