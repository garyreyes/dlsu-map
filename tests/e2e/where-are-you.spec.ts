// 5a: Where are you (S4) end to end on the real data (user-flows §3.5, D23, D42). The choices are unit-tested in
// choose.test.ts and places.test.ts; this proves the wiring: S4 opens by itself only under a room card, every way in
// sets From and opens the route preview (S5, 5b), Back unwinds in order, and From never leaves memory: not in the
// address bar, history, Recent or storage (PRD §6).
import { expect, test, type Page } from '@playwright/test';

const where = (page: Page) => page.getByRole('region', { name: 'Where are you?' });
const card = (page: Page, name: string) => page.getByRole('region', { name });
const preview = (page: Page) => page.getByRole('region', { name: 'Your route' });
const codeBox = (page: Page) => where(page).getByRole('textbox', { name: 'The room you’re in' });
const row = (page: Page, text: string) => where(page).getByRole('button').filter({ hasText: text }).first();

/** The route preview shows this From → To, on its two chips. */
async function expectTrip(page: Page, from: string, to: string) {
  await expect(preview(page).getByRole('button', { name: `From ${from}. Change where you are` })).toBeVisible();
  await expect(preview(page).getByRole('button', { name: `To ${to}. Change where to` })).toBeVisible();
}

/** Opens ST311's card from a link, which brings up Where are you under it, and waits for the buildings. */
async function openST311(page: Page) {
  await page.goto('/?to=ST311');
  await expect(where(page)).toContainText('ST311 · STRC · 3rd floor (3F)');
  await expect(row(page, 'Velasco')).toBeVisible();
}

test('a room card brings up Where are you at once, without the keyboard', async ({ page }) => {
  await openST311(page);
  await expect(where(page).getByRole('heading', { name: 'Where are you?' })).toBeVisible();
  await expect(codeBox(page)).not.toBeFocused();
  await expect(row(page, 'I’m outside')).toBeVisible();
});

test('typing the room you are in sets From and opens the route preview', async ({ page }) => {
  await openST311(page);
  await codeBox(page).fill('VL305');
  await row(page, 'VL305').click();
  await expectTrip(page, 'VL305', 'ST311');
});

test('Enter takes an exact room, but never a suggestion', async ({ page }) => {
  await openST311(page);
  await codeBox(page).fill('VH305');
  await expect(where(page).getByText('Did you mean')).toBeVisible();
  await codeBox(page).press('Enter');
  await expect(preview(page)).toHaveCount(0);
  await codeBox(page).fill('vl305');
  await expect(row(page, 'VL305')).toBeVisible();
  await codeBox(page).press('Enter');
  await expectTrip(page, 'VL305', 'ST311');
});

test('the room you are going to says so instead of routing', async ({ page }) => {
  await openST311(page);
  await codeBox(page).fill('C311');
  await row(page, 'ST311').click();
  await expect(where(page).getByRole('status')).toHaveText('You’re already at ST311.');
  await expect(preview(page)).toHaveCount(0);
});

test('a building with no room list yet goes on to its floors, never to a guessed room', async ({ page }) => {
  await openST311(page);
  await codeBox(page).fill('AG1104');
  await expect(where(page)).toContainText('rooms aren’t in the app yet');
  await row(page, 'Andrew').click();
  await expect(where(page).getByRole('group', { name: /which floor/ })).toBeVisible();
  await expect(
    where(page)
      .getByRole('group', { name: /which floor/ })
      .getByRole('button'),
  ).toHaveCount(22); // + Change spot + back
});

test('a building tapped on the map picks it here, and the card stays the destination', async ({ page }) => {
  await openST311(page);
  // Just under its label plate, which floats over the middle of its roof (as in building-card.spec.ts).
  const label = page.locator('[data-map-label]').filter({ hasText: 'Mutien-Marie', visible: true });
  await expect(label).toBeVisible();
  const box = await label.boundingBox();
  if (!box) throw new Error('no box for Mutien-Marie');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 10);
  await expect(where(page).getByRole('group', { name: 'Mutien-Marie Hall: which floor?' })).toBeVisible();
  await expect(where(page)).toContainText('ST311 · STRC');
});

test('a building, then a floor with its own label, sets From', async ({ page }) => {
  await openST311(page);
  await row(page, 'Velasco').click();
  const floors = where(page).getByRole('group', { name: 'Velasco Hall: which floor?' });
  await expect(floors.getByRole('button', { name: 'G', exact: true })).toBeVisible();
  await expect(floors).toContainText('G starts at the main entrance; other floors at the elevator lobby.');
  await floors.getByRole('button', { name: 'Pick another building' }).click();
  await row(page, 'Velasco').click();
  await floors.getByRole('button', { name: '3F', exact: true }).click();
  await expectTrip(page, 'Velasco 3F', 'ST311');
});

/** Every scroll box in the sheet that is wider inside than out: rows that bleed into the gutter must not make one. */
async function sidewaysScrollers(page: Page) {
  return where(page).evaluate((el) => {
    const sheet = el.closest('.react-modal-sheet-content-scroller') ?? el;
    return [sheet, ...sheet.querySelectorAll('*')].filter(
      (e) => getComputedStyle(e).overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 0.5,
    ).length;
  });
}

test('the sheet never scrolls sideways, at any step (8▸)', async ({ page }) => {
  await openST311(page);
  expect(await sidewaysScrollers(page)).toBe(0);
  await row(page, 'Velasco').click();
  await expect(where(page).getByRole('group', { name: 'Velasco Hall: which floor?' })).toBeVisible();
  expect(await sidewaysScrollers(page)).toBe(0);
  await where(page).getByRole('button', { name: 'Pick another building' }).click();
  await row(page, 'I’m outside').click();
  await expect(where(page).getByRole('button', { name: 'Gate 2 (North)' })).toBeVisible();
  expect(await sidewaysScrollers(page)).toBe(0);
});

test("I'm outside: a gate, or next to a building", async ({ page }) => {
  await openST311(page);
  await row(page, 'I’m outside').click();
  await where(page).getByRole('button', { name: 'Gate 2 (North)' }).click();
  await expectTrip(page, 'Gate 2 (North)', 'ST311');

  await preview(page)
    .getByRole('button', { name: /^From / })
    .click();
  await row(page, 'I’m outside').click();
  await row(page, 'Razon').click();
  await expectTrip(page, 'Razon 1F', 'ST311'); // Razon's signs have no G
});

test('Back from the preview lands on the card; Directions then goes straight to the preview', async ({ page }) => {
  await openST311(page);
  await row(page, 'I’m outside').click();
  await where(page).getByRole('button', { name: 'Gate 1 (South)' }).click();
  await expect(preview(page)).toBeVisible();
  await page.goBack();
  await expect(preview(page)).toHaveCount(0);
  await expect(where(page)).toHaveCount(0);
  await card(page, 'ST311').getByRole('button', { name: 'Directions' }).click();
  await expectTrip(page, 'Gate 1 (South)', 'ST311');
});

test('From carries to the next room: its preview opens without asking again (user-flows §3.1)', async ({ page }) => {
  await openST311(page);
  await row(page, 'I’m outside').click();
  await where(page).getByRole('button', { name: 'Gate 1 (South)' }).click();
  await preview(page).getByRole('button', { name: 'Close Your route' }).click();
  await card(page, 'ST311').getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Search for a room or building' }).click();
  await page.getByRole('textbox', { name: 'Room code or building' }).fill('VL305');
  await page.getByRole('dialog', { name: 'Search' }).getByRole('button').filter({ hasText: 'VL305' }).click();
  await expectTrip(page, 'Gate 1 (South)', 'VL305');
  await expect(where(page)).toHaveCount(0);
  await page.goBack();
  await expect(card(page, 'VL305').getByRole('button', { name: 'Directions' })).toBeVisible();
});

test('a building card waits for Directions before asking', async ({ page }) => {
  await page.goto('/?to=Velasco');
  await expect(card(page, 'Velasco').getByRole('heading', { name: 'Velasco' })).toBeVisible();
  await expect(where(page)).toHaveCount(0);
  await card(page, 'Velasco').getByRole('button', { name: 'Directions' }).click();
  await expect(where(page)).toContainText('Velasco Hall');
});

test('From never leaves memory: not in the address bar, history, Recent or storage (PRD §6)', async ({ page }) => {
  // From search, not a link, so Recent holds ST311 (D40): the destination is kept, From never is.
  await page.goto('/');
  await page.getByRole('button', { name: 'Search for a room or building' }).click();
  await page.getByRole('textbox', { name: 'Room code or building' }).fill('ST311');
  await page.getByRole('dialog', { name: 'Search' }).getByRole('button').filter({ hasText: 'ST311' }).click();
  await expect(row(page, 'Velasco')).toBeVisible();
  await codeBox(page).fill('VL305');
  await row(page, 'VL305').click();
  await expectTrip(page, 'VL305', 'ST311');
  const kept = await page.evaluate(() => ({
    url: window.location.href,
    history: JSON.stringify(window.history.state),
    local: JSON.stringify(Object.entries(window.localStorage)),
    session: JSON.stringify(Object.entries(window.sessionStorage)),
  }));
  expect(kept.url).toBe(new URL('/', page.url()).href);
  for (const text of [kept.history, kept.local, kept.session]) expect(text).not.toContain('VL305');
  expect(kept.local).toContain('ST311');
});
