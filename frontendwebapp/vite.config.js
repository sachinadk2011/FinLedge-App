import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rootEnvDir = path.resolve(__dirname, "..");
  const env = loadEnv(mode, rootEnvDir, "");

  return {
    base: "./",
    envDir: rootEnvDir,
    plugins: [react()],
    server: {
      host: env.FINLEDGE_FRONTEND_HOST || "127.0.0.1",
      port: Number(env.FINLEDGE_FRONTEND_PORT || 5173),
    },
  };
});
