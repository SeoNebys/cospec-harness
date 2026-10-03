import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const shared = {
  globals: true,
  setupFiles: ["./tests/setup.ts"],
  restoreMocks: true,
  clearMocks: true,
};

export default defineConfig({
  resolve: {
    alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) },
  },
  test: {
    projects: [
      {
        test: {
          ...shared,
          name: "unit",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        test: {
          ...shared,
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
        },
      },
      {
        test: {
          ...shared,
          name: "security",
          environment: "node",
          include: ["tests/security/**/*.test.ts"],
        },
      },
      {
        test: {
          ...shared,
          name: "contract",
          environment: "node",
          include: ["tests/contract/**/*.test.ts"],
        },
      },
      {
        test: {
          ...shared,
          name: "performance",
          environment: "node",
          include: ["tests/performance/**/*.test.ts"],
        },
      },
    ],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
