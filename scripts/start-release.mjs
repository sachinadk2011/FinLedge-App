import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const rootPkg = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const version = process.argv[2] || rootPkg.version;
// SemVer-compliant regex (semver.org): MAJOR.MINOR.PATCH[-pre-release][+build]
// Rejects leading zeros (e.g. 01.2.3) and accepts build metadata (e.g. 1.2.3+build.4).
const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed${output ? `:\n${output}` : ""}`);
  }

  return result.stdout.trim();
}

if (!version || !versionPattern.test(version)) {
  throw new Error(
    `Version "${version}" is not valid semver.\n` +
    `Usage A: npm run version:sync -- 1.0.4   then   npm run release\n` +
    `Usage B: npm run release -- 1.0.4  (bumps version + releases in one step)`
  );
}

const branch = run("git", ["branch", "--show-current"]);
if (branch !== "main") {
  throw new Error(`Release must start from main. Current branch: ${branch || "(detached)"}`);
}

run("git", ["fetch", "origin", "main", "--tags"]);
const localMain = run("git", ["rev-parse", "main"]);
const remoteMain = run("git", ["rev-parse", "origin/main"]);
if (localMain !== remoteMain) {
  throw new Error("Local main must match origin/main before starting a release. Please fast-forward local main and retry.");
}

const statusBefore = run("git", ["status", "--porcelain"]);
if (statusBefore) {
  throw new Error("Working tree must be clean before starting a release.");
}

const tag = `v${version}`;
const existingTag = spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
  cwd: projectRoot,
  encoding: "utf8",
  shell: false,
});
const force = process.argv.some(arg => arg === "--force" || arg === "force" || arg === "--overwrite");
if (existingTag.status === 0) {
  if (force) {
    console.log(`Tag ${tag} already exists. --force provided, deleting existing tag...`);
    run("git", ["tag", "-d", tag]);
    try {
      run("git", ["push", "--delete", "origin", tag]);
    } catch (e) {
      console.log(`Failed to delete remote tag, it might not exist on remote. Proceeding...`);
    }
  } else {
    throw new Error(`Cannot create release: tag ${tag} already exists. Use '--force' to overwrite.`);
  }
}

run(process.execPath, ["./scripts/sync-version.mjs", version]);

const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
if (packageJson.version !== version) {
  throw new Error(`Version sync failed. package.json is ${packageJson.version}, expected ${version}.`);
}

const releaseFiles = [
  "package.json",
  "package-lock.json",
  "frontendwebapp/package.json",
  "frontendwebapp/package-lock.json",
  "desktop/package.json",
  "desktop/package-lock.json",
  "update-policy.json", // latestVersion is kept in sync by version:sync
];

run("git", ["add", ...releaseFiles]);
const staged = run("git", ["diff", "--cached", "--name-only"]);
if (staged) {
  run("git", ["commit", "-m", `Release v${version}`]);
} else {
  console.log("Version files already match; no release version commit needed.");
}

run("git", ["tag", "-a", tag, "-m", `FinLedge ${tag}`]);
run("git", ["push", "--atomic", "origin", "main", tag]);

console.log(`Release ${tag} pushed. GitHub Actions will build and publish the release.`);
