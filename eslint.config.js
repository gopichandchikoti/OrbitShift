import js from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

const limits = {
  'max-len': ['error', { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
  complexity: ['error', 10],
  'max-depth': ['error', 3],
  'max-params': ['error', 4],
  'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
  'no-console': 'error',
  eqeqeq: 'error',
};

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'android/**', 'tests/e2e/output/**', 'artifacts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'scripts/**/*.ts', 'vite.config.ts'],
    plugins: { sonarjs },
    rules: {
      ...limits,
      'sonarjs/cognitive-complexity': ['error', 15],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-empty': 'error',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: { 'max-lines-per-function': 'off', 'max-lines': 'off' },
  },
  {
    // Narrow, documented exception: these files are machine-written level data (JSON-shaped literals), not logic.
    // They stay type-checked against `Level` and linted for everything except length.
    files: ['src/game/levels/data/**/*.ts'],
    rules: { 'max-lines': 'off' },
  },
  {
    // Level generation and QA tools print their report to the terminal on purpose.
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // Node build helpers and the browser e2e runner: same limits, plus the globals they use.
    files: ['scripts/**/*.mjs', 'tests/e2e/**/*.mjs', 'tests/android/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        // Used inside page.evaluate callbacks, which run in the browser.
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        Event: 'readonly',
        URL: 'readonly',
      },
    },
    rules: { ...limits, 'no-console': 'off', 'max-lines-per-function': 'off' },
  },
);
