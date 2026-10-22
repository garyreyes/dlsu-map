// 10a: the web app manifest and icons, the iPhone "Add to Home Screen" hint, and a second tab opened while
// the first save is still running. Build first: `npm run build && npm run e2e`.
import { expect, test, type Page } from '@playwright/test';

const line = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });
const SAVED = { timeout: 30_000 };

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

test('a second tab opened during the first save ends on the saved state too', async ({ context, page }) => {
  // Slows two precache downloads so the first save is still running when the second tab opens.
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  await context.route('**/data/rooms.json', async (route) => {
    held = true;
    await gate;
    await route.continue();
  });

  await page.goto('/');
  await expect(line(page, 'Saving for offline')).toBeVisible(SAVED);
  await expect.poll(() => held, SAVED).toBe(true);

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('button', { name: 'Search for a room or building' })).toBeVisible();

  await expect(line(second, 'Saving for offline')).toBeVisible(SAVED);

  release();
  await expect(line(page, 'Ready offline')).toBeVisible(SAVED);
  // The second tab never saw the install start, so it must pick the finished copy up on its own.
  await expect(line(second, 'Ready offline')).toBeVisible(SAVED);
});

test('the page links a manifest whose name, display and icons all load', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifestUrl = new URL(href ?? '', page.url()).toString();
  const res = await request.get(manifestUrl);
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as { name: string; display: string; icons: { src: string }[] };
  expect(manifest.name).toBe('DLSU 3D Campus Navigator');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThan(0);

  const urls = [
    ...manifest.icons.map((icon) => new URL(icon.src, manifestUrl).toString()),
    '/icons/apple-touch-icon.png',
  ];
  for (const url of urls) {
    const icon = await request.get(url);
    expect(icon.status(), url).toBe(200);
    expect(icon.headers()['content-type'], url).toContain('image/png');
  }
});

test.describe('on an iPhone', () => {
  test.use({ userAgent: IPHONE_UA });

  test('the hint comes after "Ready offline", closes for good, and stays away after a reload', async ({ page }) => {
    await page.goto('/');
    await expect(line(page, 'Ready offline')).toBeVisible(SAVED);
    // Only once the confirmation is gone (3 s), never together with it.
    await expect(page.getByText('Add to Home Screen').first()).toBeVisible({ timeout: 15_000 });
    await expect(line(page, 'Ready offline')).toHaveCount(0);

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText('Add to Home Screen')).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Search for a room or building' })).toBeVisible();
    // The 3 s note and the first save are long gone on a reload, so give a late hint time to show up.
    await page.waitForTimeout(2000);
    await expect(page.getByText('Add to Home Screen')).toHaveCount(0);
  });
});

test.describe('on desktop Chrome', () => {
  test.use({ userAgent: DESKTOP_UA, hasTouch: false, isMobile: false });

  test('the hint never appears', async ({ page }) => {
    await page.goto('/');
    await expect(line(page, 'Ready offline')).toBeVisible(SAVED);
    await expect(line(page, 'Ready offline')).toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(1000);
    await expect(page.getByText('Add to Home Screen')).toHaveCount(0);
  });
});
