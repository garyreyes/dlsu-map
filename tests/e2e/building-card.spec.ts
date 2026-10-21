// 2c: tapping a building opens its card (user-flows §3.1, S3b). Each case has one right answer: a tap selects, and
// Back or a tap elsewhere closes the card without leaving the app or closing anything else. Tap versus pan is proved
// in gestures.test.ts: here the camera's smoothing lags the pointer, so a pan test passes with or without the rule.
import { expect, test, type Page } from '@playwright/test';

const label = (page: Page, name: string) => page.locator('[data-map-label]').filter({ hasText: name, visible: true });
const card = (page: Page, name: string) => page.getByRole('region', { name });

/** A point on the building just under its label plate: the plate floats 2 m above the middle of its roof. */
async function underLabel(page: Page, name: string) {
  await expect(label(page, name)).toBeVisible();
  const box = await label(page, name).boundingBox();
  if (!box) throw new Error(`no box for ${name}`);
  return { x: box.x + box.width / 2, y: box.y + box.height + 10 };
}

async function tapBuilding(page: Page, name: string) {
  const at = await underLabel(page, name);
  await page.mouse.click(at.x, at.y);
}

/** Somewhere off campus: high on the screen, in the haze, just under the pill. */
async function tapAway(page: Page) {
  const header = await page.locator('header').boundingBox();
  await page.mouse.click(200, (header?.y ?? 0) + (header?.height ?? 60) + 24);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-map-label]').filter({ visible: true }).first()).toBeVisible();
});

test('tapping a building opens its card with its short and full names, and its label turns green', async ({ page }) => {
  await tapBuilding(page, 'Gokongwei');
  await expect(card(page, 'Gokongwei')).toBeVisible();
  await expect(card(page, 'Gokongwei').getByRole('heading', { name: 'Gokongwei' })).toBeVisible();
  await expect(card(page, 'Gokongwei').getByText('John Gokongwei Hall')).toBeVisible();
  await expect(page.locator('[data-map-label]').filter({ hasText: 'Gokongwei' })).toHaveClass(/bg-accent/);
  // Its card replaces the home hint.
  await expect(page.getByText('Type a room, like')).toHaveCount(0);
});

test('Close puts home back and the label back to white', async ({ page }) => {
  await tapBuilding(page, 'Gokongwei');
  await card(page, 'Gokongwei').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Type a room, like')).toBeVisible();
  await expect(page.locator('[data-map-label]').filter({ hasText: 'Gokongwei' })).not.toHaveClass(/bg-accent/);
});

test("the phone's back button closes the card and stays in the app", async ({ page }) => {
  const url = page.url();
  await tapBuilding(page, 'Gokongwei');
  await expect(card(page, 'Gokongwei')).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Type a room, like')).toBeVisible();
  expect(page.url()).toBe(url);
});

test('tapping off campus closes the card', async ({ page }) => {
  await tapBuilding(page, 'Gokongwei');
  await expect(card(page, 'Gokongwei')).toBeVisible();
  await tapAway(page);
  await expect(page.getByText('Type a room, like')).toBeVisible();
});

test('with search open over a card, Back closes only search', async ({ page }) => {
  await tapBuilding(page, 'Gokongwei');
  await expect(card(page, 'Gokongwei')).toBeVisible();
  await page.getByRole('button', { name: 'Search for a room or building' }).click();
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0);
  await expect(card(page, 'Gokongwei')).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Type a room, like')).toBeVisible();
});
