import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const expectedVersion = process.argv[2];
const files = [
  "package.json",
  "package-lock.json",
  "frontendwebapp/package.json",
  "frontendwebapp/package-lock.json",
  "desktop/package.json",
  "desktop/package-lock.json",
];

if (!expectedVersion) {
  throw new Error("Usage: node ./scripts/verify-version.mjs <version>");
}

for (const relativePath of files) {
  const filePath = path.join(projectRoot, relativePath);
  const actualVersion = JSON.parse(fs.readFileSync(filePath, "utf8")).version;

  if (actualVersion !== expectedVersion) {
    throw new Error(`${relativePath} is ${actualVersion}, expected ${expectedVersion}.`);
  }
}

console.log(`Version files match ${expectedVersion}.`);
