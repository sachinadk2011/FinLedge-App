import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const installerArg = process.argv[2];
const versionArg = process.argv[3];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

if (!installerArg) {
  throw new Error("Usage: node ./scripts/refresh-latest-yml.mjs <installer.exe> [version]");
}

const installerPath = path.resolve(projectRoot, installerArg);
if (!fs.existsSync(installerPath)) {
  throw new Error(`Installer not found: ${installerPath}`);
}

const version = versionArg || readJson("desktop/package.json").version;
const installerName = path.basename(installerPath);
const installerBytes = fs.readFileSync(installerPath);
const sha512 = crypto.createHash("sha512").update(installerBytes).digest("base64");
const size = installerBytes.length;
const ymlPath = path.join(path.dirname(installerPath), "latest.yml");
const releaseDate = new Date().toISOString();
const yml = [
  `version: ${version}`,
  "files:",
  `  - url: ${installerName}`,
  `    sha512: ${sha512}`,
  `    size: ${size}`,
  `path: ${installerName}`,
  `sha512: ${sha512}`,
  `releaseDate: '${releaseDate}'`,
  "",
].join("\n");

fs.writeFileSync(ymlPath, yml);
console.log(`Wrote ${ymlPath}`);
