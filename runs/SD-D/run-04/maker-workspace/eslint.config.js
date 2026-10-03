// Minimal flat ESLint config.
export default [
  {
    ignores: ['node_modules/**', 'data/**', 'dist/**', 'build/**', 'coverage/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
    },
    rules: {},
  },
];
