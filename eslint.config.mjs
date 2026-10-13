import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      '.yarn/',
      'example-app/dist/',
      'example-app/ios/',
      'example-app/android/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['scripts/**', '**/*.cjs', '**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  prettierRecommended,
]);
