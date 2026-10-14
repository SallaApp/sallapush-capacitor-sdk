import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // The plugin's sources, so the example runs without building dist/; the consumer apps test the built package.
    alias: {
      '@salla.sa/sallapush-capacitor': fileURLToPath(
        new URL('../src/index.ts', import.meta.url)
      ),
    },
    // One copy of Capacitor's core: the plugin's sources would otherwise import the repository root's.
    dedupe: ['@capacitor/core'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
