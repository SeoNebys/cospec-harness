import { defineConfig } from "@playwright/test";

// E2E tests assume the frontend dev server (which proxies /api to the backend)
// is running on port 5173. Start both servers before running `npm run test:e2e`.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
});
