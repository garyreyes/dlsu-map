import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/** The short commit being built, for the ⓘ sheet's version line (10b). CI sets APP_COMMIT to the PR's own head,
 *  because a PR checkout's HEAD is a merge commit nobody can look up. Outside a git checkout it reads "dev". */
function commit(): string {
  if (process.env.APP_COMMIT) return process.env.APP_COMMIT.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // The version the ⓘ sheet shows (10b): the commit and the build date, so nobody has to remember to bump a number.
  define: {
    __APP_COMMIT__: JSON.stringify(commit()),
    // Manila's date, so a build after midnight there isn't dated the day before.
    __APP_BUILT__: JSON.stringify(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })),
  },
  plugins: [
    react(),
    tailwindcss(),
    // Offline after the first open (D10, 1d). tests/e2e/offline.spec.ts fails if any built file is left out.
    VitePWA({
      // A new version waits until every tab is closed; the "Map updated. Reload?" prompt comes in 10a (O4).
      registerType: 'prompt',
      // src/features/offline registers it through virtual:pwa-register, so no script is added to index.html.
      injectRegister: false,
      // The web app manifest: the name, icon and standalone window the phone uses once the app is installed (10a).
      // The icons are rendered from public/icons/icon.svg by `npm run icons` and committed. White is the DESIGN.md surface.
      manifest: {
        name: 'DLSU 3D Campus Navigator',
        short_name: 'DLSU Map',
        description: 'A free, offline 3D map of De La Salle University (Manila) that routes you to any room.',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
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
  build: {
    // The three chunk is ~950 kB and can't be split smaller, so 1000 is the smallest round limit it fits under (D49).
    // Anything else past 1000 still warns; scripts/check-size.mjs holds the real budgets and fails CI.
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // three.js and its React bindings get their own chunk, apart from the app's map code, so they are cached
        // and fetched separately and only after the first screen (D49). Nothing in the first load imports them.
        codeSplitting: {
          groups: [
            // What both the first screen and the 3D map import (React, zustand, and react-use-measure for the sheet) goes
            // in its own chunk. Left to the rule below, rolldown puts it in the three chunk, which would then be
            // downloaded on the first load.
            {
              name: 'vendor',
              test: /node_modules[\\/](?:react|react-dom|scheduler|zustand|react-use-measure|use-sync-external-store|@babel[\\/]runtime)[\\/]/,
              priority: 2,
            },
            {
              name: 'three',
              test: /node_modules[\\/](?:three|@react-three|camera-controls|its-fine|suspend-react)[\\/]/,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Playwright owns tests/e2e (1b); Vitest runs everything else.
    exclude: ['**/node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
});
