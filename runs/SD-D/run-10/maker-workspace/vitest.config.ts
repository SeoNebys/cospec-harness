import { defineConfig } from 'vitest/config';

const common = {
  globals: true,
  coverage: { reporter: ['text', 'json', 'html'] },
};

export default defineConfig({
  test: {
    ...common,
    projects: [
      { test: { ...common, name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      { test: { ...common, name: 'integration', include: ['tests/integration/**/*.test.ts'] } },
      { test: { ...common, name: 'contract', include: ['tests/contract/**/*.test.ts'] } },
      { test: { ...common, name: 'performance', include: ['tests/performance/**/*.test.ts'] } },
    ],
  },
});
