import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy API calls to the local backend. For the packaged app the built assets
// are emitted into the backend's static dir and served same-origin (no proxy needed).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../backend/src/static",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
