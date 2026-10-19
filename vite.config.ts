import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Playwright owns tests/e2e (1b); Vitest runs everything else.
    exclude: ['**/node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
});
