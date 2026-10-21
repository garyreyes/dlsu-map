// 3d: the room card (S3), its floor band and chip, Share, and the deep link `?to=` (user-flows §3.4, §3.9, D40). The
// rules are unit-tested (deep-link.test.ts, floor-band.test.ts, floor-words.test.ts); this proves the wiring on the
// real data: a link opens the right card or search, the address bar is cleaned, Back stays in the app, and Share
// sends only the destination.
import { expect, test, type Page } from '@playwright/test';

const card = (page: Page, name: string) => page.getByRole('region', { name });
const searchDialog = (page: Page) => page.getByRole('dialog', { name: 'Search' });
const field = (page: Page) => page.getByRole('textbox', { name: 'Room code or building' });
const chip = (page: Page) => page.locator('[data-floor-chip]');

test('a link to a room opens its card, and the address bar is cleaned', async ({ page }) => {
  await page.goto('/?to=ST311');
  await expect(card(page, 'ST311').getByRole('heading', { name: 'ST311' })).toBeVisible();
  await expect(card(page, 'ST311')).toContainText('Surface Physics Lab');
  await expect(card(page, 'ST311')).toContainText('STRC · 3rd floor (3F)');
  await expect(card(page, 'ST311')).not.toContainText('Also written');
  await expect(page).toHaveURL(/\/$/);
});

test('the floor band gets its chip on the map, and the chip goes when the card closes', async ({ page }) => {
  await page.goto('/?to=ST311');
  await expect(chip(page)).toHaveText('3F');
  await expect(chip(page)).toBeVisible();
  await card(page, 'ST311').getByRole('button', { name: 'Close' }).click();
  await expect(chip(page)).toHaveCount(0);
});

test('a link typed with the alias says "Also written"', async ({ page }) => {
  await page.goto('/?to=C311');
  await expect(card(page, 'ST311')).toContainText('Also written C311');
});

test("Back closes a card a link opened, and the app doesn't go back to the link", async ({ page }) => {
  await page.goto('/?to=ST311');
  await expect(card(page, 'ST311')).toBeVisible();
  await page.goBack();
  await expect(card(page, 'ST311')).toHaveCount(0);
  await expect(page.getByText('Type a room, like')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('a link to a building opens its building card', async ({ page }) => {
  await page.goto('/?to=Velasco');
  await expect(card(page, 'Velasco').getByRole('heading', { name: 'Velasco' })).toBeVisible();
});

test('a link to a code not in the list opens search with it typed, and Did you mean', async ({ page }) => {
  await page.goto('/?to=ST350');
  await expect(searchDialog(page)).toBeVisible();
  await expect(field(page)).toHaveValue('ST350');
  await expect(searchDialog(page).getByText('ST350 isn’t in our list.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('Share opens the share sheet with only the destination', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: ShareData[] = [];
    Object.assign(window, { shareCalls: calls });
    Object.defineProperty(navigator, 'share', {
      value: (data: ShareData) => {
        calls.push(data);
        return Promise.resolve();
      },
    });
  });
  await page.goto('/?to=ST311');
  await card(page, 'ST311').getByRole('button', { name: 'Share' }).click();
  const calls = await page.evaluate(() => (window as unknown as { shareCalls: ShareData[] }).shareCalls);
  const origin = new URL(page.url()).origin;
  expect(calls).toStrictEqual([{ text: 'ST311 · Surface Physics Lab · STRC 3F', url: `${origin}/?to=ST311` }]);
});

test('Closing the share sheet without sharing says nothing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      value: () => Promise.reject(new DOMException('Share canceled', 'AbortError')),
    });
  });
  await page.goto('/?to=ST311');
  await card(page, 'ST311').getByRole('button', { name: 'Share' }).click();
  await expect(card(page, 'ST311').getByText('Link copied')).toHaveCount(0);
  await expect(card(page, 'ST311').getByText('Couldn’t copy')).toHaveCount(0);
});

test('with no share sheet, Share copies the link and says so for a moment', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    // A browser without the Web Share API, like most desktop ones.
    delete (Navigator.prototype as { share?: unknown }).share;
  });
  await page.goto('/?to=ST311');
  await card(page, 'ST311').getByRole('button', { name: 'Share' }).click();
  await expect(card(page, 'ST311').getByText('Link copied')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`${new URL(page.url()).origin}/?to=ST311`);
  await expect(card(page, 'ST311').getByText('Link copied')).toHaveCount(0, { timeout: 4000 });
});
