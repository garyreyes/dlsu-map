// 1b: what the host serves (D5, D19, ARCHITECTURE §8). If a header silently went missing, or a library started
// loading something from a CDN, the app would still look fine on screen; these tests are how we'd find out.
import { expect, test, type Page } from '@playwright/test';

// The exact policy from D5. Changing it needs the owner's yes (CLAUDE.md), so the test pins every character.
const CSP =
  "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; " +
  "base-uri 'self'; frame-ancestors 'none'";

const HEADERS: Record<string, string> = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-robots-tag': 'noindex',
};

/** Requests the app tried to make to another site, and CSP violations the browser reported. */
interface Guard {
  offsite: string[];
  violations: () => Promise<string[]>;
}

/**
 * Blocks every request to another origin (so the test never reaches the internet) and records it, and records
 * every CSP violation. A request the CSP blocks never reaches the network, so it shows up as a violation instead.
 *
 * Known gaps, to close when they become real:
 * - 1d (service worker): the worker's own fetches bypass `context.route`, and its CSP violations never reach
 *   `document`. Add a test for the worker's requests then.
 * - `<link rel=preconnect>` / `dns-prefetch` to another origin are seen by neither half. Review catches those.
 */
async function guard(page: Page, baseURL: string): Promise<Guard> {
  const origin = new URL(baseURL).origin;
  const offsite: string[] = [];
  await page.context().route('**/*', async (route) => {
    const url = route.request().url();
    if (new URL(url).origin === origin) {
      await route.continue();
    } else {
      offsite.push(url);
      await route.abort('blockedbyclient');
    }
  });
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.defineProperty(window, '__cspViolations', { value: seen });
    document.addEventListener('securitypolicyviolation', (e) => {
      seen.push(`${e.effectiveDirective} blocked ${e.blockedURI}`);
    });
  });
  const violations = () =>
    page.evaluate(() => [...(window as unknown as { __cspViolations: string[] }).__cspViolations]);
  return { offsite, violations };
}

test('the app page is served with the security and noindex headers', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  const headers = res.headers();
  for (const [name, value] of Object.entries(HEADERS)) {
    expect.soft(headers[name], name).toBe(value);
  }
});

test('a deep link gets the app, with the same headers', async ({ page }) => {
  const res = await page.goto('/some/deep/link?to=ST311');
  expect(res?.status()).toBe(200);
  expect(res?.headers()['content-security-policy']).toBe(CSP);
  await expect(page.locator('#root')).toBeAttached();
});

test('robots.txt disallows every crawler (D19)', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/plain');
  expect(await res.text()).toBe('User-agent: *\nDisallow: /\n');
});

test('the _headers file itself is not served', async ({ request }) => {
  const body = await (await request.get('/_headers')).text();
  expect(body).not.toContain('Content-Security-Policy:');
});

test('the app loads nothing from another site and breaks no CSP rule', async ({ page, baseURL }) => {
  const { offsite, violations } = await guard(page, baseURL ?? '');
  await page.goto('/');
  // The home screen with the 3D map running, so WebGL, the sheet and the icons are all inside the check.
  await expect(page.getByRole('button', { name: 'Search for a room or building' })).toBeVisible();
  await expect(page.locator('canvas')).toBeAttached();
  await expect(page.getByRole('button', { name: 'Show the whole campus' })).toBeVisible();
  // Map ready: building labels only show once campus.json has loaded and passed its Zod check, which is the step that
  // would trip the CSP's eval rule (PROJECT_FACTS, Zod and the CSP). Any label will do; which ones fit depends on
  // the screen.
  await expect(page.locator('[data-map-label]').filter({ visible: true }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(offsite).toStrictEqual([]);
  expect(await violations()).toStrictEqual([]);
  // No map failure message of either kind (MapProblem is the only alert on home).
  await expect(page.getByRole('alert')).toHaveCount(0);
});

// Self-checks: prove each half of the guard can fail. Without them, a guard that silently stopped seeing requests
// would keep passing forever.
test('the guard records a request the CSP blocks', async ({ page, baseURL }) => {
  const { violations } = await guard(page, baseURL ?? '');
  await page.goto('/');
  await page.evaluate(async () => {
    await fetch('https://example.com/csp-probe').catch(() => undefined);
  });
  expect(await violations()).toContain('connect-src blocked https://example.com/csp-probe');
});

// A top-level navigation isn't covered by the CSP, so only the route block can catch it.
test('the guard records an off-site request the CSP lets through', async ({ page, baseURL }) => {
  const { offsite } = await guard(page, baseURL ?? '');
  await page.goto('/');
  await page.evaluate(() => {
    window.location.href = 'https://example.com/route-probe';
  });
  await expect.poll(() => offsite).toContain('https://example.com/route-probe');
});
