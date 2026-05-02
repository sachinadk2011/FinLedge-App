import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const version = process.argv[2];
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
  throw new Error("Usage: node ./scripts/start-release.mjs 1.0.4");
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
];

run("git", ["add", ...releaseFiles]);
const staged = run("git", ["diff", "--cached", "--name-only"]);
if (staged) {
  run("git", ["commit", "-m", `Release v${version}`]);
} else {
  console.log("Version files already match; no release version commit needed.");
}

const tag = `v${version}`;
const existingTag = spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
  cwd: projectRoot,
  encoding: "utf8",
  shell: false,
});

if (existingTag.status === 0) {
  throw new Error(`Tag ${tag} already exists.`);
}

run("git", ["tag", "-a", tag, "-m", `FinLedge ${tag}`]);
run("git", ["push", "origin", "main"]);
run("git", ["push", "origin", tag]);

console.log(`Release ${tag} pushed. GitHub Actions will build, sign, and publish the release.`);
