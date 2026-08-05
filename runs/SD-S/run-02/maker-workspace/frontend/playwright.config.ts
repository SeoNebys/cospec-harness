import { defineConfig } from "@playwright/test";

// E2E runs against a locally running backend + frontend.
// Start both (`npm run dev` in backend and frontend) or rely on the webServer below.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    headless: true,
  },
});
