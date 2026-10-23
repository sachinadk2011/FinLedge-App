# Tech Spec — Capacitor mobile runtime, release tooling, CI, update policy

Covers the mobile runtime, how both platforms are built/released from the
same root, and the update policy split. Desktop behavior is unchanged; the
mobile track is additive.

## 1. Mobile runtime

- **Capacitor** wraps `frontendwebapp` as a native Android app.
  `mobile/capacitor.config.ts` already sets `webDir: 'www'` and the
  Android project path (`mobile/android`). The Capacitor web build must
  consume the same `frontendwebapp` build used by desktop.
- **Storage**: `@capacitor-community/sqlite` (already a dependency in
  `mobile/package.json`). SQLite is the on-device source of truth
  (schema.md). The same service layer used by manual entries and Keep
  Notes import writes here.
- Mobile app id/name: `com.finledge.mobile` / `FinLedge Mobile` (from
  `mobile/capacitor.config.ts`).

## 2. Root-level release tooling

Both platforms are triggered from the root the same way desktop is today.
Because a single script today assumes one platform, each tool accepts a
`--platform desktop|mobile` flag (or, if a flag proves awkward inside a
given script, add `*-mobile.mjs` siblings for that script). Approach: keep
the existing scripts' current default behavior as **desktop**, and branch
on the flag for mobile so existing desktop invocations are unchanged.

Scripts to extend (`scripts/`):

| Script | Today | With platform flag |
|--------|-------|--------------------|
| `finledge.mjs` | `desktop-dev`, `desktop-build`, `desktop-build-publish` | add `mobile-build` (Capacitor sync + `npx cap build android`) and a dev/serve path for the mobile web target; route shared frontend build to `www` for Capacitor |
| `sync-version.mjs` | bumps root/frontend/desktop package.json + locks + `update-policy.json` | on `--platform mobile`, also bump `mobile/package.json` + its lock and `update-policy-mobile.json` |
| `verify-version.mjs` | checks root/frontend/desktop + locks | on `--platform mobile`, also check `mobile/package.json` + lock |
| `start-release.mjs` | tags `v<version>`, commits release files, pushes | on `--platform mobile`, tag `mobile-v<version>`, include `mobile/` + `update-policy-mobile.json` in the release files |

Root `package.json` scripts gain mobile equivalents (`mobile-dev`,
`mobile-build`, `mobile-release`, etc.) mirroring the desktop ones.

## 3. GitHub Actions — matrix build keyed off tag prefix

Replace/augment `.github/workflows/release.yml` so the tag branch selects
which platform to build:

- Tag **`desktop-v*`** → run the existing **Electron** build (Windows),
  publish to the **desktop** release channel.
- Tag **`mobile-v*`** → run the **Capacitor/Android** build (e.g.
  `ubuntu-latest` with Android SDK or `macos-latest` for APK/AAB signing),
  publish to the **mobile** release channel.

A single workflow triggers on both `desktop-v*` and `mobile-v*` and uses a
job matrix (or `if` on the tag prefix) to pick the platform. Publish the
two platforms to the **same GitHub release intended for its own tag**, i.e.
each tag produces its own release artifact set — the desktop channel and
mobile channel are distinct release entries, not combined into one.

## 4. Update policy — two files

- **`update-policy.json`** — desktop (existing, unchanged shape; still
  consumed by the Electron update check).
- **`update-policy-mobile.json`** — mobile, mirroring the same fields
  (`latestVersion`, `minimumSupportedVersion`, `releaseUrl`, messages,
  `releaseNotes`).

`sync-version.mjs` keeps each policy's `latestVersion` in sync for its own
platform.

### 4.1 Update-check UX differs by platform

The update-check UI is presented differently on the two platforms:

- **Desktop**: existing blocking dialog (Electron `dialog.showMessageBox`),
  unchanged.
- **Mobile**: a **non-blocking, dismissible banner** instead of a blocking
  dialog (e.g. an in-app banner the user can dismiss). Banner remains
  visible until dismissed or the release is installed; a critical/required
  version may escalate (e.g. persist the banner and disable entry to the
  update flow until updated).

Exact UX (banner placement, dismiss persistence, escalation for required
updates) is **decided when this phase starts**, not now — this spec only
fixes the direction (dismissible banner vs. blocking dialog).

## 5. Static in-app assets vs. launcher icon assets

`mobile/assets/` holds launcher icon masters only, consumed by
`npx @capacitor/assets generate --android` — never referenced directly by
app code. Any image the UI itself renders (in-app logo, splash graphic,
favicon) must live in `mobile/public/`, which Vite copies verbatim into
`www/` on build. The drawer's brand mark (`./icon.png` in `shell.ts`) must
resolve to a file that actually exists at `mobile/public/icon.png`.
