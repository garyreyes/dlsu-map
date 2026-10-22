// 5b: the route preview (S5) end to end on the real data (user-flows §3.6, D43). What it says is unit-tested in
// preview.test.ts, and which building files a trip loads in trip-places.test.ts; this proves the wiring, above all
// that the files reach the router: without them a route to ST311 still looks right but stops at STRC's door.
import { expect, test, type Page } from '@playwright/test';

const where = (page: Page) => page.getByRole('region', { name: 'Where are you?' });
const preview = (page: Page) => page.getByRole('region', { name: 'Your route' });
const player = (page: Page) => page.getByRole('region', { name: 'Steps' });
const card = (page: Page, name: string) => page.getByRole('region', { name });
const summary = (page: Page) => preview(page).getByText(/^About \d+ min/);
const modes = (page: Page) => preview(page).getByRole('group', { name: 'Stairs or elevator' });

/** Opens a room's card from a link, then sets From to a gate in Where are you, which opens the preview. */
async function fromGate(page: Page, to: string, gate = 'Gate 2 (North)') {
  await page.goto(`/?to=${to}`);
  await where(page).getByRole('button').filter({ hasText: 'I’m outside' }).click();
  await where(page).getByRole('button', { name: gate }).click();
  await expect(preview(page)).toBeVisible();
}

/** Picks a room in search, opened from wherever the caller left it. */
async function pickInSearch(page: Page, code: string) {
  await page.getByRole('textbox', { name: 'Room code or building' }).fill(code);
  await page.getByRole('dialog', { name: 'Search' }).getByRole('button').filter({ hasText: code }).click();
}

test('a route into STRC goes inside: Start plays the walk to ST311’s door', async ({ page }) => {
  await fromGate(page, 'ST311');
  await expect(preview(page)).toContainText('ST311 · STRC · 3rd floor (3F)');
  await expect(summary(page)).toHaveText(/^About \d+ min · \d+ m walk · via stairs$/);
  await expect(preview(page)).not.toContainText('no indoor map');
  await preview(page).getByRole('button', { name: 'Start' }).click();
  await expect(player(page).getByText(/^Step 1 of \d+$/)).toBeVisible();
  await page.goBack();
  await expect(summary(page)).toBeVisible();
  await page.goBack();
  await expect(preview(page)).toHaveCount(0);
  await expect(card(page, 'ST311').getByRole('button', { name: 'Directions' })).toBeVisible();
});

test('Route options re-route at once, and a new trip starts on Auto again', async ({ page }) => {
  await fromGate(page, 'ST311');
  await expect(modes(page)).toBeHidden();
  await preview(page).getByRole('button', { name: 'Route options' }).click();
  await expect(modes(page).getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
  await modes(page).getByRole('button', { name: 'Elevator' }).click();
  await expect(summary(page)).toContainText('via elevator');
  await modes(page).getByRole('button', { name: 'Stairs' }).click();
  await expect(summary(page)).toContainText('via stairs');

  // ST404 is 3 floors up, so Auto takes the elevator (PRD UC3).
  await preview(page)
    .getByRole('button', { name: /^To ST311/ })
    .click();
  await pickInSearch(page, 'ST404');
  await expect(summary(page)).toContainText('via elevator');
  await preview(page).getByRole('button', { name: 'Route options' }).click();
  await expect(modes(page).getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
});

test('the chips change either end: To reopens search, From reopens Where are you', async ({ page }) => {
  await fromGate(page, 'ST311');
  await preview(page)
    .getByRole('button', { name: /^To ST311/ })
    .click();
  await pickInSearch(page, 'VL305');
  await expect(preview(page).getByRole('button', { name: 'To VL305. Change where to' })).toBeVisible();
  await expect(preview(page).getByRole('button', { name: 'From Gate 2 (North). Change where you are' })).toBeVisible();
  await preview(page)
    .getByRole('button', { name: /^From / })
    .click();
  await expect(where(page)).toContainText('VL305 · Velasco');
});

test('a building with no indoor map yet says the directions stop at its door (O5)', async ({ page }) => {
  await fromGate(page, 'SM303');
  await expect(preview(page)).toContainText('Miguel has no indoor map yet, so directions stop at its door.');
  await expect(preview(page).getByRole('button', { name: 'Start' })).toBeEnabled();
});

test('the map shows where you are', async ({ page }) => {
  await fromGate(page, 'ST311');
  await expect(page.locator('[data-here-dot]')).toBeVisible();
});

test('Escape in search from the To chip closes only search, and Back still lands on the card', async ({ page }) => {
  await fromGate(page, 'ST311');
  await preview(page)
    .getByRole('button', { name: /^To ST311/ })
    .click();
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0);
  await expect(summary(page)).toBeVisible();
  await page.goBack();
  await expect(preview(page)).toHaveCount(0);
  await expect(card(page, 'ST311').getByRole('button', { name: 'Directions' })).toBeVisible();
});
