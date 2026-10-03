import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    setupFiles: ["tests/setup/server.ts", "tests/setup/client.ts"],
    environmentMatchGlobs: [["tests/component/**", "jsdom"]],
    coverage: { reporter: ["text", "html"] }
  }
});
