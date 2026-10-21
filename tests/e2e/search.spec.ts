// 3c: search (S2) end to end on the real data (user-flows §3.2–3.3, D38). The matching rules are unit-tested in
// search-results.test.ts; this proves the wiring: a tap opens the right card, Go opens only an exact match, Back
// closes the card without bringing search back, and Recent survives a reload.
import { expect, test, type Page } from '@playwright/test';

const pill = (page: Page) => page.getByRole('button', { name: 'Search for a room or building' });
const searchDialog = (page: Page) => page.getByRole('dialog', { name: 'Search' });
const field = (page: Page) => page.getByRole('textbox', { name: 'Room code or building' });
const row = (page: Page, text: string) =>
  searchDialog(page).getByRole('list').getByRole('button').filter({ hasText: text });
const card = (page: Page, name: string) => page.getByRole('region', { name });

async function typeInSearch(page: Page, text: string) {
  await pill(page).click();
  await field(page).fill(text);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('tapping a room opens its card: code, name, building and floor', async ({ page }) => {
  await typeInSearch(page, 'c-311');
  await expect(row(page, 'ST311')).toContainText('Surface Physics Lab · STRC 3F');
  await expect(row(page, 'ST311')).toContainText('Also written C311');
  await row(page, 'ST311').click();
  await expect(searchDialog(page)).toHaveCount(0);
  await expect(card(page, 'ST311').getByRole('heading', { name: 'ST311' })).toBeVisible();
  await expect(card(page, 'ST311')).toContainText('Surface Physics Lab');
  await expect(card(page, 'ST311')).toContainText('STRC · 3F');
});

test("Back closes the card from search and doesn't bring search back", async ({ page }) => {
  const url = page.url();
  await typeInSearch(page, 'ST311');
  await row(page, 'ST311').click();
  await expect(card(page, 'ST311')).toBeVisible();
  await page.goBack();
  await expect(card(page, 'ST311')).toHaveCount(0);
  await expect(searchDialog(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
});

test('Go opens an exact match', async ({ page }) => {
  await typeInSearch(page, 'ST311');
  await field(page).press('Enter');
  await expect(card(page, 'ST311')).toBeVisible();
});

test('Go never accepts a suggestion (D25, D38)', async ({ page }) => {
  await typeInSearch(page, 'VH501');
  await expect(searchDialog(page).getByText('Did you mean')).toBeVisible();
  await expect(row(page, 'VL501')).toBeVisible();
  await field(page).press('Enter');
  await expect(searchDialog(page)).toBeVisible();
  await expect(card(page, 'VL501')).toHaveCount(0);
});

test('a code not in the list is rejected with Did you mean', async ({ page }) => {
  await typeInSearch(page, 'ST350');
  await expect(searchDialog(page).getByText('ST350 isn’t in our list.', { exact: true })).toBeVisible();
  await expect(searchDialog(page).getByRole('list').getByRole('button')).toHaveText([/^ST305/, /^ST310/]);
});

test('a building opens its building card', async ({ page }) => {
  await typeInSearch(page, 'Velasco');
  await row(page, 'Velasco').click();
  await expect(card(page, 'Velasco').getByRole('heading', { name: 'Velasco' })).toBeVisible();
});

test('Recent: home and search list what was picked, newest first, after a reload', async ({ page }) => {
  await expect(page.getByText('Type a room, like')).toBeVisible(); // first open: the hint
  await typeInSearch(page, 'ST311');
  await row(page, 'ST311').click();
  await card(page, 'ST311').getByRole('button', { name: 'Close' }).click();
  await typeInSearch(page, 'Velasco');
  await row(page, 'Velasco').click();
  await page.reload();

  const recent = page.getByRole('region', { name: 'Recent' });
  await expect(recent.getByRole('button')).toHaveText([/^Velasco/, /^ST311/]);
  await recent.getByRole('button', { name: /ST311/ }).click();
  await expect(card(page, 'ST311')).toBeVisible();

  await card(page, 'ST311').getByRole('button', { name: 'Close' }).click();
  await pill(page).click();
  await expect(searchDialog(page).getByText('Recent')).toBeVisible();
  await expect(searchDialog(page).getByRole('list').getByRole('button')).toHaveText([/^ST311/, /^Velasco/]);
});

test('a double tap on a result opens the card once, and Back still closes it', async ({ page }) => {
  const url = page.url();
  await typeInSearch(page, 'ST311');
  await row(page, 'ST311').dblclick();
  await expect(card(page, 'ST311')).toBeVisible();
  await expect(searchDialog(page)).toHaveCount(0);
  await page.goBack();
  await expect(card(page, 'ST311')).toHaveCount(0);
  await expect(searchDialog(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
});

test('Go on a suggestion moves focus to the list, and Down reaches the first row', async ({ page }) => {
  await typeInSearch(page, 'ST350');
  await field(page).press('Enter');
  await expect(field(page)).not.toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(row(page, 'ST305')).toBeFocused();
  await expect(searchDialog(page).getByRole('status')).toHaveText('ST350 isn’t in our list. 2 suggestions.');
});
