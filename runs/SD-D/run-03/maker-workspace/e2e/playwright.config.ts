import { defineConfig } from "@playwright/test";

// E2E scenarios mirror quickstart.md. They assume the app is already running
// at http://localhost:8765 (backend serving the built frontend).
export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:8765",
  },
});
