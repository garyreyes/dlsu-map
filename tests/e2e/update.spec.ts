// 10a, O4 end to end: a newer service worker downloads, "Map updated." offers a reload, and Reload applies it. The
// toast stays away while a card is open. Build first: `npm run build && npm run e2e`.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const SAVED = { timeout: 30_000 };
const toast = (page: Page) => page.getByRole('status').filter({ hasText: 'Map updated.' });
const pill = (page: Page) => page.getByRole('button', { name: 'Search for a room or building' });

const SW_FILE = join(import.meta.dirname, '..', '..', 'dist', 'sw.js');

// Playwright's routes don't see a browser's own update check for the worker script, so the served file itself gets a
// trailing comment (a different worker, same behaviour) and is put back afterwards.
let original = '';
test.beforeAll(() => {
  original = readFileSync(SW_FILE, 'utf8');
});
test.afterEach(() => {
  writeFileSync(SW_FILE, original);
});
const changeWorker = () => {
  writeFileSync(
    SW_FILE,
    `${original}
// changed ${String(Date.now())}
`,
  );
};

const checkForUpdate = (page: Page) =>
  page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });

test('a newer version shows "Map updated.", Reload applies it, and a card keeps it away', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Ready offline' })).toBeVisible(SAVED);

  // Open a building's card first: the update must wait for the student to be back on the map.
  await pill(page).click();
  await page.getByRole('textbox', { name: 'Room code or building' }).fill('Gokongwei');
  await page.getByRole('dialog', { name: 'Search' }).getByRole('list').getByRole('button').first().click();
  const card = page.getByRole('region', { name: 'Gokongwei' });
  await expect(card).toBeVisible();

  changeWorker();
  // The dev server notices the changed file a moment later; only then can the browser's check find a new worker.
  await expect
    .poll(() =>
      page.evaluate(async () => (await (await fetch('/sw.js', { cache: 'no-store' })).text()).includes('// changed')),
    )
    .toBe(true);
  await checkForUpdate(page);
  // Give the new worker time to install and wait; the toast must still be hidden.
  await page.waitForTimeout(3000);
  await expect(page.getByText('Map updated.')).toHaveCount(0);

  await card.getByRole('button', { name: 'Close' }).click();
  await expect(card).toHaveCount(0);
  await expect(toast(page)).toBeVisible({ timeout: 15_000 });

  const navigated = page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
  await page.getByRole('button', { name: 'Reload' }).click();
  await navigated;
  await expect(pill(page)).toBeVisible();
  await expect(page.getByText('Map updated.')).toHaveCount(0);
});
