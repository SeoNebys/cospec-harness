import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": `${import.meta.dirname}/src` } },
  test: {
    include: ["tests/{unit,component,integration,contract,performance}/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
});
