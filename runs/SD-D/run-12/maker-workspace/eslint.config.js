import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['**/*.ts', '**/*.tsx', 'node_modules/**', 'dist/**', 'coverage/**', 'var/**', 'playwright-report/**', 'test-results/**', '.specify/**']),
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: { 'no-undef': 'off', 'no-unused-vars': 'off' },
  },
]);
