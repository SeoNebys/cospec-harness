import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'data/**', 'prototypes/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], 'no-control-regex': 'off' } },
  { files: ['src/client/**/*.{ts,tsx}', 'tests/component/**/*.tsx'], languageOptions: { globals: globals.browser }, plugins: { 'react-hooks': hooks }, rules: hooks.configs.flat.recommended.rules },
  { files: ['src/server/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts'], languageOptions: { globals: globals.node } }
);
