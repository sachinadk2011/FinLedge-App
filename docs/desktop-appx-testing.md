# Local Windows test packages (AppX + EXE)

Electron Builder 26.15.3 in this repository supports the `appx` target. It produces
a Windows AppX package, which is the MSIX-family format supported by this installed
builder version. The artifact is `.appx`; this setup does not claim to produce a
`.msix` file.

## One-time setup

1. Get or create a local test signing certificate (`.pfx`) outside the repository.
   Keep the certificate and password out of Git.
2. Fill in `identityName`, `publisher`, and `publisherDisplayName` in
   `desktop/appx-package-config.json`. For a local signed package, `publisher` must
   match the certificate subject. Store identity values must come from Partner
   Center when preparing a Store submission.
3. Import the public test certificate into the Windows **Local Computer → Trusted
   People** store before installing. This requires an elevated PowerShell window.

## Build from PowerShell

The desktop build pins electron-builder's `winCodeSign` toolset to `1.1.0`,
which uses the Windows Kits 10.0.26100 tools. Keep this setting: the legacy
10.0.17763 SignTool used by electron-builder's default toolset failed to sign
the valid AppX package on the current Windows build.

Set the test certificate path and, if needed, its password in the current PowerShell
session or the root `.env` file. Keep `.env` and the certificate out of Git. Then run
the single test build command:

```powershell
$env:FINLEDGE_TEST_CERT_PATH = "C:\certs\FinLedge-Test.pfx"
$securePassword = Read-Host "PFX password" -AsSecureString
$env:FINLEDGE_TEST_CERT_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
npm run desktop-build:test
```

Omit the password prompt and `FINLEDGE_TEST_CERT_PASSWORD` assignment when the
certificate has no password. The command builds the frontend and Python sidecar once,
then asks Electron Builder to create both an x64 NSIS installer and an x64 AppX package
in the standard `desktop/dist/` output folder. Both use a distinct Testing app name;
the AppX package uses the `SachinAdhikari.Finledge.Testing` identity, so it can be
installed alongside the production app. The command never publishes. It uses the
same output folder as the normal desktop release build to exercise the same packaging
flow. AppX test builds use Electron's app-specific `userData` directory at
`%APPDATA%\Finledge Testing AppX`, created before backend startup. Settings reports
its resolved location. The first launch checks the older
`%LOCALAPPDATA%\Finledge Testing AppX Test` folder as a legacy source and copies
validated files without modifying the source. No production
folder is used as a test migration source. Package contents are read-only; export
archives use the operating system temporary directory. The packaged channel marker
identifies a production AppX build intended for Store distribution; Electron's
`process.windowsStore` confirms it is running as an AppX package. A sideloaded
non-Store AppX package without that marker is labeled `AppX Package`. The
Store-targeted production AppX builds disable the self-update checker and use the
Phase 3 data-folder resolver. Testing packages use their app-specific user-data
folders instead.

Each combined test build increments the AppX package revision and records the
counter beside the configured `.pfx`, outside the repository. This gives each
package a higher version than the previous test build, allowing Windows to update
the installed test app in place while retaining its test data. Keep the `.pfx`
directory available and writable between builds so the counter persists. Do not
manually reset the counter while a package built with a higher revision is still
installed.

Install the produced AppX package from PowerShell:

```powershell
Add-AppxPackage -Path "<path printed by the build>"
```

Before installing, open PowerShell as Administrator (using the same Windows account
that created the certificate) and trust its public certificate in the machine store:

```powershell
$cerPath = Join-Path $env:LOCALAPPDATA "FinLedge-Test-Signing\FinLedge-Test.cer"
Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\LocalMachine\TrustedPeople"
```

Do not import the self-signed test certificate into Trusted Root Certification
Authorities. Microsoft documents Local Computer → Trusted People for this package
installation trust error.

The test EXE uses a separate application ID and its own Electron `userData` directory.
Normal production builds continue to use their production identity and write to the
same `desktop/dist/` folder; the release workflow clears and rebuilds that folder
before selecting the production-named installer for GitHub. Development launched
with `npm run desktop-dev` uses its own `Finledge Development` user-data directory.
Build output is ignored by Git. Existing `desktop/dist-*` diagnostic folders are
retained and ignored; new builds do not create them.

AppX installation and update screens are provided by Windows. FinLedge cannot
replace them with the NSIS multi-step wizard or select a custom package install
path. Windows manages the protected package location and may show “Reinstall” after
an update completes; check the installed package version to confirm the update.
The EXE installer uses NSIS, which supports a selectable installation directory.
The data folder is separate from the application install location. On first launch,
the app creates the selected test data directory and empty module workbooks; the
standard installer data location defaults to `Documents\FinLedge`.

The AppX manifest registers the application entry point and Windows adds it to the
Start menu. FinLedge asks once per package version whether to create a desktop
shortcut. It checks for the named shortcut first; an existing shortcut suppresses
the prompt. Choosing “Not now” is remembered until a later package version. A link
created by FinLedge starts the app through its stable `shell:AppsFolder` application
identity, so the target does not depend on the versioned package install path. Its
icon is cached in writable per-user app data.

Windows does not expose the NSIS custom-path or multi-step install wizard for AppX.
Although the Windows manifest has a desktop-shortcut extension, that declares a
package-managed shortcut rather than an optional first-run choice. FinLedge therefore
asks in the app and uses Electron's Windows shortcut API after backend startup.
Windows/App Installer still owns AppX installation and update screens; the package
may return to an “Open” or “Reinstall” action after installation/update. FinLedge
does not run an AppX updater or reinstall/relaunch the package. AppX self-update
checks, prompts, downloads, and install IPC are disabled. Use Microsoft Store or
App Installer to update packaged builds.

AppX data writes use the configured per-user data folder, not the protected package
directory. The shortcut preference and cached icon are app-local writable settings;
workbooks remain in the selected data directory, and process logs go to the OS temp
directory. Package repairs and launches do not delete workbook data.
