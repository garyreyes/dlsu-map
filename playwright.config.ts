// End-to-end tests (ARCHITECTURE §2). They run against `wrangler dev` serving the built dist/, so they see the real
// public/_headers and the single-page fallback, the same as Cloudflare serves them (PROJECT_FACTS, "Cloudflare").
// Build first: `npm run build && npm run e2e`.
import { defineConfig, devices } from '@playwright/test';

const PORT = 8788;
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;

const PHONE = {
  ...devices['Pixel 7'],
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
};

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL: BASE_URL },
  // Phone first (PRD): a Pixel 7 profile on Chromium. Safari on iPhone is checked by hand on real phones.
  // PLAYWRIGHT_CHANNEL=chrome uses the installed Chrome instead of Playwright's own Chromium, for laptops where
  // `npx playwright install` can't download it (PROJECT_FACTS). CI leaves it unset.
  // update.spec.ts rewrites dist/sw.js to fake a new version, so it runs on its own after everything else: another
  // spec's page could otherwise pick up that version mid-test.
  projects: [
    { name: 'phone', use: PHONE, testIgnore: 'update.spec.ts' },
    { name: 'phone-update', use: PHONE, testMatch: 'update.spec.ts', dependencies: ['phone'] },
  ],
  webServer: {
    command: `npx wrangler dev --port ${String(PORT)} --ip 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
