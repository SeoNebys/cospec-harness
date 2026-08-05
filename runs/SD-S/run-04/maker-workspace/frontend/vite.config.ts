import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend talks to the backend API. In dev we proxy /api to the backend
// server so the browser makes same-origin requests.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
