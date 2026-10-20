// ESLint 10 flat config (D2): typescript-eslint strictTypeChecked + react-hooks + Prettier, plus the layer rules.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import boundaries from './eslint.boundaries.js';

export default defineConfig([
  // prototypes/ loads three.js from a CDN on purpose and is reference only (ROADMAP notes).
  globalIgnores([
    'dist/',
    'coverage/',
    '.wrangler/',
    'test-results/',
    'playwright-report/',
    'prototypes/',
    'public/',
    'docs/',
    'data-src/',
  ]),
  {
    files: ['**/*.{ts,tsx,js}'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.{js,ts}', 'tests/**', 'scripts/**', 'tools/**'],
    languageOptions: { globals: globals.node },
  },
  ...boundaries,
  prettier,
]);
