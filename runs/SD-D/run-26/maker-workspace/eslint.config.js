import eslint from '@eslint/js';
export default [
  {
    ignores: [
      '**/*.ts',
      '**/*.tsx',
      'dist/**',
      'data/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**'
    ]
  },
  { ...eslint.configs.recommended, files: ['**/*.js'], languageOptions: { sourceType: 'module' } }
];
