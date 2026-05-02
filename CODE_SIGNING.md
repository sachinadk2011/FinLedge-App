# Code Signing and Signed Releases

FinLedge should not try to bypass Windows SmartScreen or antivirus checks. The correct release path is to build from a trusted CI system, sign the installer with a trusted certificate, publish the signed installer, and make sure `latest.yml` matches the signed file.

## Code Signing Policy

Free code signing is provided by SignPath.io using a certificate issued by the SignPath Foundation.

### Project Maintainer

FinLedge is maintained and released by Sachin Adhikari.

### Committers and Reviewers

Code changes are reviewed and approved through the official GitHub repository:

```text
https://github.com/sachinadk2011/FinLedge-App
```

Only approved commits merged into the `main` branch are eligible for signed release builds.

### Release Approvers

Only the repository owner, Sachin Adhikari, is authorized to approve production releases and publish signed installers.

### Security Policy

Release builds are generated from the official GitHub repository using controlled CI/CD workflows. No unofficial binaries are considered trusted.

Users should only download installers from the official GitHub Releases page.

### Privacy Policy

FinLedge is a local-first desktop finance application. User financial files remain on the local machine under the operating system's user data directory.

The application does not intentionally transfer personal financial data to external systems unless explicitly requested by the user.

## SignPath Foundation Setup

After SignPath Foundation approves the project:

1. Create/link a SignPath project for this repository.
2. Add the predefined trusted build system for GitHub.com in SignPath.
3. Link that trusted build system to the FinLedge SignPath project.
4. Use this repository policy file as the release signing policy:

```text
.signpath/policies/finledge-app/release-signing.yml
```

5. In GitHub repository settings, add these Actions variables:

```text
SIGNPATH_ORGANIZATION_ID
SIGNPATH_PROJECT_SLUG
SIGNPATH_SIGNING_POLICY_SLUG
SIGNPATH_ARTIFACT_CONFIGURATION_SLUG
```

6. Add this GitHub Actions secret:

```text
SIGNPATH_API_TOKEN
```

The artifact configuration in SignPath should target the Windows installer inside the uploaded GitHub artifact ZIP.

## Why Releases Should Build in GitHub Actions

SignPath Foundation signing is based on trusted origin metadata. A local laptop build cannot provide the same trustworthy build metadata as GitHub Actions. The local command should only create the release version commit and tag; GitHub Actions should build, submit to SignPath, and publish the signed release.

## One-Command Release

From a clean local `main` branch:

```powershell
node .\scripts\start-release.mjs 1.0.4
```

This command:

- syncs package and lockfile versions
- commits the release version if needed
- creates an annotated `v1.0.4` tag
- pushes `main` and the tag

The pushed tag triggers `.github/workflows/release-signed.yml`.

## Release Workflow

The signed release workflow:

1. Builds the unsigned Windows installer on GitHub-hosted Windows runners.
2. Uploads the installer as a GitHub Actions artifact.
3. Submits that artifact to SignPath.
4. Downloads the signed installer.
5. Regenerates `latest.yml` from the signed installer so `electron-updater` sees the correct SHA512 hash.
6. Publishes the GitHub Release with:

```text
Finledge-Setup-x.y.z.exe
latest.yml
```

`electron-updater` uses `latest.yml` to decide what to download. If an installer is signed after `latest.yml` is generated, the SHA512 hash changes, so `latest.yml` must be refreshed after signing.

## Important Notes

- Do not upload unsigned installers to public releases.
- Do not edit `latest.yml` manually unless you are regenerating the SHA512 and size from the final signed installer.
- Do not force-push release tags.
- For the first signed release, test by installing the previous version, publishing the signed new version, then checking that the old version detects, downloads, and installs the update.
