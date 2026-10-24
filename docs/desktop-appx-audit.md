# Desktop AppX packaging and launch audit

Reviewed 2026-10-24. This is a desktop-only audit record; mobile-owned architecture
and task documents were not changed.

## Findings

- The generated Testing AppX manifest inspected before this change registers a full
  trust application with `Windows.FullTrustApplication`, points to the packaged
  `Finledge-Testing.exe`, supplies Windows tile logos, and registers a Start menu
  entry. Production identity and publisher remain in
  `desktop/appx-package-config.json`; local test builds override them with the
  separate `.Testing` package identity.
- The native Update/progress/Reinstall UI is Windows App Installer. Electron has a
  short startup splash and React has a separate release policy notice. The app has
  no AppX reinstall or relaunch operation. AppX automatic policy checks, manual
  updater IPC, and renderer prompts are now disabled so Windows owns package updates.
- The Windows `desktop7:Shortcut` manifest extension declares a package-managed
  desktop shortcut, not an optional first-launch prompt. FinLedge shows its own
  React prompt after the backend is healthy, checks for its named desktop link first,
  and stores the choice for the current package version. A decline is asked again
  only after a version update; an existing link suppresses the question. New links
  launch the package by `shell:AppsFolder\\<AUMID>`, avoiding a versioned WindowsApps
  target.
- First-run data preparation uses the existing non-destructive migration path and
  workbook initialization marker. Each launch checks preparation state; completed
  migration/workbook setup is idempotent and does not replace existing workbooks.
  Writable data remains in the configured per-user data folder, not the protected
  package directory. Logs use the OS temp directory. Shortcut preferences and the
  copied icon stay in writable per-user package storage; links use the physical
  LocalCache path visible to Explorer.

## Changes in this audit

- Disabled AppX update checks in all code paths and hid the update notice for AppX.
- Added the optional, per-package-version shortcut prompt and stable AUMID launch
  target. Existing desktop shortcuts are detected before asking.
- Used the ICO for the Electron window/taskbar identity, removed the splash logo's
  box shadow/rounded-square styling, and set the AppX tile background to transparent.
- Fixed the shortcut prompt's package identity lookup: Electron has no
  `app.getAppUserModelId()` getter, so the previous code exited before asking. The
  manager now derives the package family from the AppX executable path and combines
  it with the configured application ID.
- Regenerated `finledge_icon.ico` from the canonical `finledge_icon.png`. The old ICO
  had square small-size frames while the AppX logos came from the round PNG, causing
  the visible mismatch. AppX and EXE artwork now comes from the same source image,
  with 16/32/48/256px transparent ICO frames.
- Added the in-app shortcut prompt, set the AppX window's registered AUMID, and map
  virtualized package data paths to LocalCache for Windows shell open actions.
- The AppX startup log showed a sidecar initialization error being mislabeled as a
  folder permission problem. Folder selection is now offered only when the writable
  directory probe itself fails; other preparation failures report that existing
  records were preserved and can be retried by restarting.
- Removed recursive PyInstaller collection of every `backend` submodule. The old
  command also pulled the ignored `backend.tests` suite into the packaged sidecar.
- Aligned executable product name and description with FinLedge while leaving the
  NSIS artifact filename pattern and production AppX identity/publisher intact.

## Validation and limits

- Desktop data/runtime tests: 9 passed.
- Frontend production build: passed; Vite reported its existing large-chunk advisory.
- Desktop configuration JSON and desktop main-process JavaScript syntax checks:
  passed.
- NSIS x64 installer build: passed to a temporary audit folder. Its executable
  metadata reports ProductName `FinLedge`, ProductVersion `1.3.0`, FileDescription
  `FinLedge personal finance tracker`, and CompanyName `Sachin Adhikari`. The installer
  was not run, to avoid altering production app/data during this audit.
- The combined local Testing AppX and NSIS package build completed successfully. The
  AppX manifest has test identity `SachinAdhikari.Finledge.Testing`, version
  `1.3.0.6`, application ID `FinledgeTesting`, and transparent tile background. The
  NSIS test installer reports ProductName `Finledge-Testing`, ProductVersion `1.3.0`,
  and the FinLedge description.
- The generated ICO was validated as a PNG-backed 256px icon from the same canonical
  image used for AppX logos. The package was built but not installed/launched during
  this follow-up, so live shortcut prompting, Start menu behavior, and Windows icon
  cache refresh still require installation on the target account.
- Latest follow-up: `npm run desktop-build:test` completed with Testing AppX revision
  `1.3.0.7` and the matching Testing EXE installer. Frontend build, JS syntax checks,
  `git diff --check`, package contents, the four ICO frames, the sidecar `--help` and
  isolated `--prepare-data` smoke commands, and AppX external path resolution passed.
  PyInstaller's analysis no longer lists `backend.tests`. The test package has not yet
  been installed/launched, so the React prompt, taskbar refresh, and Explorer open
  actions still need confirmation in the installed build.

## Windows behavior and limitations

- Windows owns AppX installation/update UI and package install location. The NSIS
  custom install-path wizard and desktop-shortcut checkbox do not carry over.
- A signed local package is required to validate the optional prompt and shortcut on
  the target Windows account. Windows/App Installer remains responsible for package
  updates, and the user should preserve app data if a Windows uninstall/repair prompt
  offers a choice that removes app data.
