import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
const { resolveRepositoryConfig } = require("../desktop/services/repositoryConfig.js");

function emitPublicDesktopConfig(config) {
  return {
    name: "finledge-public-desktop-config",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "finledge-public-config.json",
        source: `${JSON.stringify({
          githubOwner: config.owner,
          githubRepo: config.repo,
          releasesUrl: config.releasesUrl,
          updatePolicyUrl: config.updatePolicyUrl,
        }, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rootEnvDir = path.resolve(__dirname, "..");
  const env = loadEnv(mode, rootEnvDir, "");
  const repositoryConfig = resolveRepositoryConfig({ projectRoot: rootEnvDir, env });

  return {
    base: "./",
    define: {
      "import.meta.env.VITE_FINLEDGE_RELEASES_URL": JSON.stringify(repositoryConfig.releasesUrl),
      "import.meta.env.VITE_FINLEDGE_GITHUB_OWNER": JSON.stringify(repositoryConfig.owner),
      "import.meta.env.VITE_FINLEDGE_GITHUB_REPO": JSON.stringify(repositoryConfig.repo),
    },
    envDir: rootEnvDir,
    plugins: [react(), emitPublicDesktopConfig(repositoryConfig)],
    server: {
      host: env.FINLEDGE_FRONTEND_HOST || "127.0.0.1",
      port: Number(env.FINLEDGE_FRONTEND_PORT || 5173),
    },
  };
});
