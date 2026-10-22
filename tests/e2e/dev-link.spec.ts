// 5c: the dev-only link `?from=…&to=…` opens a route's all-steps list under `npm run dev`, and must never reach the
// shipped app: there it would route on a guess, skipping the From → To confirm (CLAUDE.md). These run against the
// production build, so they prove it's absent. The list itself is checked under `npm run dev`.
// Build first: `npm run build && npm run e2e`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const DIST = join(import.meta.dirname, '..', '..', 'dist');

test('the built app has no dev-link code', () => {
  const scripts = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js'));
  expect(scripts.length).toBeGreaterThan(0);
  const withDevCode = scripts.filter((f) => readFileSync(join(DIST, 'assets', f), 'utf8').includes('Dev link'));
  expect(withDevCode).toEqual([]);
});

test('a dev link in the built app is only a ?to= link: the room card, no route and no From (D40)', async ({ page }) => {
  await page.goto('/?from=gate-1&to=ST311');
  // From wasn't read, so Where are you asks for it over the ST311 card (D23, D42).
  await expect(page.getByRole('region', { name: 'Where are you?' })).toContainText('ST311 · STRC');
  await expect(page.getByRole('region', { name: 'All steps' })).toHaveCount(0);
  // From is never read from a link, and the address bar no longer holds it either.
  await expect(page).toHaveURL(/\/$/);
});
