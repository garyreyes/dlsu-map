// 1d: offline after the first open (D10, PRD §5 "Offline"). Workbox silently leaves out any file its globPatterns
// don't match or that is over its size limit (PLAN.md, gotchas), and nothing would look wrong until a student opened
// the app in a dead zone. So the precache list is checked file by file, and the saved copy is used for real.
// Build first: `npm run build && npm run e2e`.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const DIST = join(import.meta.dirname, '..', '..', 'dist');

/** Files that are served but never precached, each for a reason. */
const NOT_PRECACHED: Record<string, string> = {
  'sw.js': 'the service worker itself; the browser fetches it fresh to look for updates',
  _headers: 'read by Cloudflare, never served',
  'robots.txt': 'for search engines, not the app',
};
/** Workbox's own runtime, loaded by sw.js; and the empty files that keep public/'s folders in git. */
const isExempt = (file: string) => /^workbox-[\w-]+\.js$/.test(file) || file.endsWith('/.gitkeep');

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(DIST, join(entry.parentPath, entry.name)).replaceAll('\\', '/'));

/** The URLs in the generated precache manifest, from `precacheAndRoute([{url:"…",revision:…},…])` in sw.js. */
const precacheList = (): Set<string> => {
  const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
  return new Set([...sw.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)].map((m) => m[1] ?? ''));
};

const pill = (page: Page) => page.getByRole('button', { name: 'Search for a room or building' });

test('every file the app can load is in the offline copy', () => {
  const precached = precacheList();
  const missing = filesIn(DIST).filter((f) => !(f in NOT_PRECACHED) && !isExempt(f) && !precached.has(f));
  expect(missing).toEqual([]);
  // The data the map needs must be there by name, not just "everything that happened to match".
  expect(precached).toContain('index.html');
  expect(precached).toContain('data/campus.json');
  expect(precached).toContain('data/rooms.json');
});

test('after the first open it says "Ready offline", then opens and loads its data with no signal', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Ready offline' })).toBeVisible({ timeout: 30_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(pill(page)).toBeVisible();
  await expect(page.getByText('Open this once with internet')).toHaveCount(0);
  // The 3D map is a separate chunk: it must come from the saved copy too.
  await expect(page.getByText('Loading the campus…')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  // Saved already, so the line stays away on later opens.
  await expect(page.getByText(/Saving for offline|Ready offline/)).toHaveCount(0);
  const data = await page.evaluate(async () => {
    const res = await fetch('/data/campus.json');
    return { ok: res.ok, type: res.headers.get('content-type') ?? '' };
  });
  expect(data.ok).toBe(true);
  expect(data.type).toContain('application/json');
});

test('right after "Ready offline", the open page already uses the saved copy, with no reload', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Ready offline' })).toBeVisible({ timeout: 30_000 });

  await context.setOffline(true);
  // The worker takes over the page as it activates, a moment after the copy is complete.
  await expect
    .poll(() =>
      page.evaluate(() =>
        fetch('/data/rooms.json').then(
          (res) => res.ok,
          () => false,
        ),
      ),
    )
    .toBe(true);
});

const line = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });

test('losing signal after the app opened keeps it on screen, and the save finishes when signal returns', async ({
  page,
  context,
}) => {
  // Stands in for signal dropping mid-save: the precache download of one file fails.
  await context.route('**/data/rooms.json', (route) => route.abort());
  await page.goto('/');
  await expect(line(page, 'Not saved for offline')).toBeVisible({ timeout: 30_000 });

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(line(page, 'Saving paused')).toBeVisible();
  await expect(pill(page)).toBeVisible();
  await expect(page.getByText('Open this once with internet')).toHaveCount(0);

  // Signal back: the save is tried again in place, with no reload, and finishes.
  await context.unroute('**/data/rooms.json');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(line(page, 'Ready offline')).toBeVisible({ timeout: 30_000 });
});

test.describe('when nothing is saved', () => {
  // No service worker ever gets registered, so there is never a copy.
  test.use({ serviceWorkers: 'block' });

  test('opened with no signal, it shows "Open this once with internet", and signal brings the map', async ({
    page,
  }) => {
    // The page itself still has to load, so the phone's "no signal" is faked. A flag in localStorage survives the
    // reload that signal coming back triggers.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'onLine', {
        get: () => localStorage.getItem('e2e-online') === '1',
      });
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Open this once with internet to save the map' })).toBeVisible();
    await expect(pill(page)).toHaveCount(0);

    await page.evaluate(() => {
      localStorage.setItem('e2e-online', '1');
      window.dispatchEvent(new Event('online'));
    });
    await expect(pill(page)).toBeVisible();
    await expect(page.getByText('Open this once with internet')).toHaveCount(0);
  });

  test('a map that did not download says so, offers Try again only with signal, and search still works', async ({
    page,
    context,
  }) => {
    await context.route('**/assets/campus-scene-*.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.getByRole('alert').filter({ hasText: "The map didn't download" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

    // Wi-Fi with no internet: the phone says it has signal but the site doesn't answer, so no reload happens.
    await context.route('**/data/campus.json', (route) => route.abort());
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText("Still can't reach the site.")).toBeVisible();
    await expect(pill(page)).toBeVisible();

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
    await expect(page.getByText('Connect to Wi-Fi or mobile data to load it.')).toBeVisible();

    await pill(page).click();
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  });
});
