import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share an in-memory DB per file; run files in isolation.
    fileParallelism: false,
  },
});
