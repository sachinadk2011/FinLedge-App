# FinLedge Mobile

This folder contains the mobile app scaffold for FinLedge.

The mobile app is a Capacitor-wrapped web frontend with SQLite-backed local storage. It is versioned independently from the desktop app: use `mobile-v1.0.0` style tags for mobile releases and `desktop-vX.Y.Z` style tags for desktop releases.

The current app includes the mobile SQLite schema/data-layer scaffold, local TypeScript business-logic ports, and the initial mobile screen shell. Backend integrations, Keep Notes import, Drive sync, and release automation are not implemented yet.

## Tooling

- Capacitor wraps the web frontend.
- Android is the initial native target.
- `@capacitor-community/sqlite` is included for local mobile storage.

## Commands

```sh
npm install
npm run dev
npm run build
npm test
npm run cap:sync:android
npm run cap:run:android
```

Note the distinction between the two Android commands:

- `npm run cap:sync:android` (`npx cap sync android`) — **sync-only**: copies the
  built web assets and plugins into the native Android project. It does **not**
  build the web app, and it does **not** install or launch on a device.
- `npm run cap:run:android` — **build + sync + run**: runs `npm run build`
  (web + services), then `npm run cap:sync:android`, then `npx cap run android`
  to build, install, and launch the app on the connected device. This is the
  single command to go from source to a running app in one step.

From the repository root you can run the same full chain with
`npm run mobile:run:android` (maps to `scripts/finledge.mjs mobile-android-run`).
Use `npm run mobile:android` for build + sync only, or
`npm run mobile:sync:android` for sync only.

## App icons

Icon masters live in `assets/`:

- `icon.png` — 1024×1024 master, full `FL` mark on the green brand background.
- `icon-only.png` — 1024×1024, the full icon used by `@capacitor/assets` as the
  non-adaptive square icon source.
- `icon-foreground.png` — 1024×1024, the `FL` mark on a transparent layer
  (Android adaptive-icon foreground; keep the mark inside the safe zone).
- `icon-background.png` — 1024×1024, the solid green brand fill
  (Android adaptive-icon background).

To regenerate all Android icon densities into
`android/app/src/main/res/mipmap-*` from the masters (do **not** hand-create
per-density files), run:

```sh
npx @capacitor/assets generate --android
```

This regenerates the adaptive-icon foreground/background in every density
plus the standard `ic_launcher` variants.
