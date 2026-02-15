import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("matrix-js-sdk")) {
            return "vendor-matrix";
          }
          if (id.includes("/src/features/admin/")) {
            return "feature-admin";
          }
          if (id.includes("/src/components/CallDock")) {
            return "feature-calls";
          }
          return undefined;
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
