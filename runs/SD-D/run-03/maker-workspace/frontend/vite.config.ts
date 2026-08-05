import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build output is served by the FastAPI backend (single deployable).
// During dev, proxy /api to the local backend.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/api": "http://localhost:8765",
    },
  },
});
