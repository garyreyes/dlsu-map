// 10b: the ⓘ sheet (S10, user-flows §5). It opens from the pill over whatever the sheet showed, Back closes it
// without leaving the app, and search opened from it lands on the picked room instead of staying hidden under it.
import { expect, test, type Page } from '@playwright/test';

const infoButton = (page: Page) => page.getByRole('button', { name: 'About and offline status' });
const info = (page: Page) => page.getByRole('region', { name: 'DLSU 3D Campus Navigator' });

test('ⓘ shows the credits, the beta label and the version, and Back closes it', async ({ page }) => {
  await page.goto('/');
  const url = page.url();
  await infoButton(page).click();
  await expect(info(page)).toContainText('Map data © OpenStreetMap contributors');
  await expect(info(page)).toContainText('Student project, not an official DLSU app.');
  await expect(info(page)).toContainText('Beta');
  await expect(info(page)).toContainText(/Version \S+ · built \d{1,2} [A-Z][a-z]{2} \d{4}/);
  await expect(info(page)).toContainText(/Campus map as of \d{1,2} [A-Z][a-z]{2} \d{4}/);
  await page.goBack();
  await expect(info(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
});

test('searching from the ⓘ sheet closes it, so the picked room shows', async ({ page }) => {
  await page.goto('/');
  await infoButton(page).click();
  await expect(info(page)).toBeVisible();
  await page.getByRole('button', { name: 'Search for a room or building' }).click();
  await page.getByRole('textbox', { name: 'Room code or building' }).fill('ST311');
  await page.getByRole('button', { name: /^ST311 / }).click();
  await expect(page.getByRole('region', { name: 'Where are you?' })).toContainText('ST311');
  await expect(info(page)).toHaveCount(0);
});

test('Escape closes the ⓘ sheet', async ({ page }) => {
  await page.goto('/');
  await infoButton(page).click();
  await expect(info(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(info(page)).toHaveCount(0);
  expect(await page.evaluate(() => history.state as unknown)).toBeNull();
});

test('a tap on the map closes the ⓘ sheet instead of picking a building behind it', async ({ page }) => {
  await page.goto('/');
  // The map takes taps once it has drawn.
  await expect(page.locator('[data-map-label]').filter({ visible: true }).first()).toBeVisible();
  await infoButton(page).click();
  await expect(info(page)).toBeVisible();
  const header = await page.locator('header').boundingBox();
  await page.mouse.click(200, (header?.y ?? 0) + (header?.height ?? 60) + 24);
  await expect(info(page)).toHaveCount(0);
  // Nothing was picked, and info's history entry is gone, so one Back isn't spent on an empty step.
  await expect(page.getByRole('region', { name: 'Where are you?' })).toHaveCount(0);
  expect(await page.evaluate(() => history.state as unknown)).toBeNull();
});
