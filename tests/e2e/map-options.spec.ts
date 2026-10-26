// v2-A3: the map options button and its card (D57, D58). Choices apply at once and are saved; Escape closes the card
// and gives focus back, and only the card; in 2D the compass is hidden while browsing.
import { expect, test, type Page } from '@playwright/test';

const optionsButton = (page: Page) => page.getByRole('button', { name: 'Map options', exact: true });
const card = (page: Page) => page.getByRole('dialog', { name: 'Map options', exact: true });

test('a colour choice shows as pressed and is still there after a reload', async ({ page }) => {
  await page.goto('/');
  await optionsButton(page).click();
  await expect(card(page)).toBeVisible();
  await card(page).getByRole('button', { name: 'Black' }).click();
  await expect(card(page).getByRole('button', { name: 'Black' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await optionsButton(page).click();
  await expect(card(page).getByRole('button', { name: 'Black' })).toHaveAttribute('aria-pressed', 'true');
});

test('Escape closes the card and focus goes back to the button', async ({ page }) => {
  await page.goto('/');
  await optionsButton(page).click();
  await expect(optionsButton(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
  await expect(optionsButton(page)).toBeFocused();
});

test('the button closes the card again', async ({ page }) => {
  await page.goto('/');
  await optionsButton(page).click();
  await expect(card(page)).toBeVisible();
  await optionsButton(page).click();
  await expect(card(page)).toHaveCount(0);
});

test('2D keeps the compass away while browsing', async ({ page }) => {
  await page.goto('/');
  await optionsButton(page).click();
  await card(page).getByRole('button', { name: '2D' }).click();
  await expect(card(page).getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Turn the map back to its usual direction' })).toHaveCount(0);
});

test('Escape on the card closes only the card, not the route under it', async ({ page }) => {
  await page.goto('/?to=ST311');
  await page
    .getByRole('region', { name: 'Where are you?' })
    .getByRole('button')
    .filter({ hasText: 'I’m outside' })
    .click();
  await page.getByRole('region', { name: 'Where are you?' }).getByRole('button', { name: 'Gate 2 (North)' }).click();
  await page.getByRole('region', { name: 'Your route' }).getByRole('button', { name: 'Start' }).click();
  const steps = page.getByRole('region', { name: 'Steps' });
  await expect(steps).toBeVisible();
  await optionsButton(page).click();
  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
  await expect(steps).toBeVisible();
});
