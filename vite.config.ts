import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Offline after the first open (D10, 1d). tests/e2e/offline.spec.ts fails if any built file is left out.
    VitePWA({
      // A new version waits until every tab is closed; the "Map updated. Reload?" prompt comes in 10a (O4).
      registerType: 'prompt',
      // src/features/offline registers it through virtual:pwa-register, so no script is added to index.html.
      injectRegister: false,
      // The web app manifest and icons come in 10a.
      manifest: false,
      workbox: {
        // Workbox's default saves only js/wasm/css/html, silently leaving out the map data, fonts and models.
        globPatterns: ['**/*.{js,css,html,json,woff2,glb,svg,png,webp}'],
        // The default 2 MiB limit also skips files silently; the data budget is 15 MB in all (ARCHITECTURE §3.5).
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Opening any app URL with no signal (a shared ?to= link) gets the saved page.
        navigateFallback: 'index.html',
        // The page open during the first save starts using it at once, so "Ready offline" is true without a reload
        // (a lazy chunk fetched after that comes from the copy). Updates still wait for every tab to close.
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      // No service worker in `npm run dev`: a stale cache there only confuses (PLAN.md, gotchas).
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Playwright owns tests/e2e (1b); Vitest runs everything else.
    exclude: ['**/node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
});
