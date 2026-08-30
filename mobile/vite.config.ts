import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  optimizeDeps: {
    entries: ["index.html"],
  },
  server: {
    watch: {
      ignored: ["**/android/**", "**/dist/**", "**/www/**"],
    },
  },
  build: {
    outDir: "www",
    emptyOutDir: true,
    rollupOptions: {
      input: "index.html",
    },
  },
});
