// 1c: the home screen's states and its one way in and out of search (user-flows §1, §3.2, §4). These have one right
// answer each: a phone without WebGL must get a clear message, not "Loading" forever, and Back must close search
// rather than leave the app.
import { expect, test, type Page } from '@playwright/test';

const pill = (page: Page) => page.getByRole('button', { name: 'Search for a room or building' });
const searchDialog = (page: Page) => page.getByRole('dialog', { name: 'Search' });

test('the search pill is the first thing Tab reaches', async ({ page }) => {
  await page.goto('/');
  await expect(pill(page)).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(pill(page)).toBeFocused();
});

test('without WebGL the map says this phone cannot show it, and search still works', async ({ page }) => {
  await page.addInitScript(() => {
    type GetContext = (this: HTMLCanvasElement, type: string, ...rest: unknown[]) => RenderingContext | null;
    const original = Reflect.get(HTMLCanvasElement.prototype, 'getContext') as GetContext;
    const blocked: GetContext = function (type, ...rest) {
      return type.startsWith('webgl') ? null : original.call(this, type, ...rest);
    };
    Reflect.set(HTMLCanvasElement.prototype, 'getContext', blocked);
  });
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: "This phone can't show the 3D map" })).toBeVisible();
  await expect(page.getByText('You can still search for rooms and buildings.')).toBeVisible();
  // Reloading can't fix a phone without WebGL, so nothing offers to.
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(page.getByText('Loading the campus…')).toHaveCount(0);
  await pill(page).click();
  await expect(searchDialog(page)).toBeVisible();
});

test("the phone's back button closes search and stays in the app", async ({ page }) => {
  await page.goto('/');
  const url = page.url();
  await pill(page).click();
  await expect(searchDialog(page)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Room code or building' })).toBeFocused();
  await page.goBack();
  await expect(searchDialog(page)).toHaveCount(0);
  await expect(pill(page)).toBeVisible();
  expect(page.url()).toBe(url);
});

test('Escape and the back arrow close search without leaving history behind', async ({ page }) => {
  await page.goto('/');
  await pill(page).click();
  await page.keyboard.press('Escape');
  await expect(searchDialog(page)).toHaveCount(0);
  await page.getByRole('button', { name: /Type a room/ }).click();
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await expect(searchDialog(page)).toHaveCount(0);
  // Each open pushed one entry and each close popped it, so the current entry is the page itself again.
  expect(await page.evaluate(() => history.state as unknown)).toBeNull();
});

test('search is modal: the map behind it is inert, and focus returns to the pill on close', async ({ page }) => {
  await page.goto('/');
  await pill(page).focus();
  await page.keyboard.press('Enter');
  await expect(searchDialog(page)).toBeVisible();
  await expect(page.locator('#root')).toHaveJSProperty('inert', true);
  await page.keyboard.press('Escape');
  await expect(searchDialog(page)).toHaveCount(0);
  await expect(page.locator('#root')).toHaveJSProperty('inert', false);
  await expect(pill(page)).toBeFocused();
});

test('a double Escape or a double tap on the pill never leaves the app', async ({ page }) => {
  await page.goto('/');
  const url = page.url();
  await pill(page).dblclick();
  await expect(searchDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(searchDialog(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
  // One open pushed one entry, so we're back on the page's own entry, not one more step back.
  expect(await page.evaluate(() => history.state as unknown)).toBeNull();
  await expect(pill(page)).toBeVisible();
});
