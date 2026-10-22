// 5d: the step player (S6) and Arrived (S9) end to end on the real data (user-flows §3.7–3.8, D44). Which step the
// card shows, where the map looks and what Find next room sets are unit-tested in player.test.ts; this proves the
// wiring: the screens stack so the phone's Back walks back one at a time, and nothing about the trip is lost.
import { expect, test, type Page } from '@playwright/test';

const where = (page: Page) => page.getByRole('region', { name: 'Where are you?' });
const preview = (page: Page) => page.getByRole('region', { name: 'Your route' });
const player = (page: Page) => page.getByRole('region', { name: 'Steps' });
const allSteps = (page: Page) => page.getByRole('region', { name: 'All steps' });
const arrived = (page: Page) => page.getByRole('region', { name: 'Arrived' });
const counter = (page: Page) => player(page).getByText(/^Step \d+ of \d+$/);

// Camera flights become cuts: CI draws the 3D in software, where a 650 ms flight per step made a walk through every
// step brush the 30 s test limit. The cut is the reduced-motion path students get too.
test.use({ reducedMotion: 'reduce' });

/** Gate 2 → ST311: opens the room from a link, sets From to the gate, then presses Start. */
async function start(page: Page) {
  await page.goto('/?to=ST311');
  await where(page).getByRole('button').filter({ hasText: 'I’m outside' }).click();
  await where(page).getByRole('button', { name: 'Gate 2 (North)' }).click();
  await preview(page).getByRole('button', { name: 'Start' }).click();
  await expect(counter(page)).toHaveText(/^Step 1 of \d+$/);
}

/** How many steps the route has, from the card's counter. */
async function total(page: Page) {
  const text = (await counter(page).textContent()) ?? '';
  return Number(/of (\d+)$/.exec(text)?.[1]);
}

/** Next through to the last step, then I'm here. */
async function arrive(page: Page) {
  const n = await total(page);
  for (let i = 1; i < n; i++) await player(page).getByRole('button', { name: 'Next' }).click();
  await player(page).getByRole('button', { name: 'I’m here' }).click();
  await expect(arrived(page)).toBeVisible();
}

test('Next and Back walk the steps, and the arrow keys do too', async ({ page }) => {
  await start(page);
  await expect(player(page)).toContainText('Start at Gate 2 (North)');
  await expect(player(page).getByRole('button', { name: 'Back' })).toBeDisabled();
  const n = await total(page);
  await player(page).getByRole('button', { name: 'Next' }).click();
  await expect(counter(page)).toHaveText(`Step 2 of ${String(n)}`);
  await player(page).getByRole('button', { name: 'Back' }).click();
  await expect(counter(page)).toHaveText(`Step 1 of ${String(n)}`);
  await page.keyboard.press('ArrowRight');
  await expect(counter(page)).toHaveText(`Step 2 of ${String(n)}`);
  await page.keyboard.press('ArrowLeft');
  await expect(counter(page)).toHaveText(`Step 1 of ${String(n)}`);
});

test('the last step reads I’m here, and only a tap on it opens Arrived', async ({ page }) => {
  await start(page);
  const n = await total(page);
  for (let i = 1; i < n; i++) await player(page).getByRole('button', { name: 'Next' }).click();
  await expect(counter(page)).toHaveText(`Step ${String(n)} of ${String(n)}`);
  await expect(player(page)).toContainText(/ST311 is (on your (left|right)|ahead)/);
  // → on the last step stays put: arriving is said only by tapping.
  await page.keyboard.press('ArrowRight');
  await expect(player(page).getByRole('button', { name: 'I’m here' })).toBeVisible();
  await expect(arrived(page)).toHaveCount(0);
  await player(page).getByRole('button', { name: 'I’m here' }).click();
  await expect(arrived(page)).toContainText('You’re at ST311');
  await expect(arrived(page)).toContainText('ST311 · STRC · 3rd floor (3F)');
  await expect(arrived(page)).not.toContainText('indoor map coming');

  // Back from Arrived returns to the last step.
  await page.goBack();
  await expect(counter(page)).toHaveText(`Step ${String(n)} of ${String(n)}`);
});

test('✕ goes back to the preview, and Start resumes at the same step', async ({ page }) => {
  await start(page);
  await player(page).getByRole('button', { name: 'Next' }).click();
  await expect(counter(page)).toHaveText(/^Step 2 of/);
  await player(page).getByRole('button', { name: 'End route' }).click();
  await expect(preview(page)).toBeVisible();
  await preview(page).getByRole('button', { name: 'Start' }).click();
  await expect(counter(page)).toHaveText(/^Step 2 of/);
  // The phone's Back does what ✕ does.
  await page.goBack();
  await expect(preview(page)).toBeVisible();
});

test('⋯ All steps jumps to a step, and Change where I am goes back through the preview', async ({ page }) => {
  await start(page);
  const menu = player(page).getByRole('button', { name: 'More' });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await player(page).getByRole('button', { name: 'All steps' }).click();
  await expect(allSteps(page).locator('[aria-current="step"]')).toContainText('Start at Gate 2 (North)');
  const second = allSteps(page).getByRole('listitem').nth(1);
  const title = (await second.locator('span.block').first().textContent()) ?? '';
  await second.getByRole('button').click();
  await expect(counter(page)).toHaveText(/^Step 2 of/);
  await expect(player(page).getByRole('heading')).toHaveText(title);

  await player(page).getByRole('button', { name: 'More' }).click();
  await player(page).getByRole('button', { name: 'Change where I am' }).click();
  await where(page).getByRole('button').filter({ hasText: 'I’m outside' }).click();
  await where(page)
    .getByRole('button', { name: /^Gate 1/ })
    .click();
  await expect(preview(page).getByRole('button', { name: /^From Gate 1/ })).toBeVisible();
  await preview(page).getByRole('button', { name: 'Start' }).click();
  await expect(counter(page)).toHaveText(/^Step 1 of/);
  await expect(player(page)).toContainText('Start at Gate 1');
});

test('Find next room opens search with From set to the room just reached', async ({ page }) => {
  await start(page);
  await arrive(page);
  await arrived(page).getByRole('button', { name: 'Find next room' }).click();
  await page.getByRole('textbox', { name: 'Room code or building' }).fill('ST404');
  await page.getByRole('dialog', { name: 'Search' }).getByRole('button').filter({ hasText: 'ST404' }).click();
  await expect(preview(page).getByRole('button', { name: /^From ST311/ })).toBeVisible();
});

test('Done goes back to the map, and From stays set for the next room', async ({ page }) => {
  await start(page);
  await arrive(page);
  await arrived(page).getByRole('button', { name: 'Done' }).click();
  await expect(arrived(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'ST311' })).toHaveCount(0);
  await page
    .getByRole('button', { name: /search/i })
    .first()
    .click();
  await page.getByRole('textbox', { name: 'Room code or building' }).fill('ST404');
  await page.getByRole('dialog', { name: 'Search' }).getByRole('button').filter({ hasText: 'ST404' }).click();
  await expect(preview(page).getByRole('button', { name: /^From Gate 2/ })).toBeVisible();
});
