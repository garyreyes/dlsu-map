// Whether the site answers right now. Its own module, apart from load.ts, so the first-load bundle doesn't pull in
// Zod and the schemas: Zod 4 probes for `eval` when a schema is built, which the CSP blocks (PROJECT_FACTS).

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/**
 * For "Try again" before it reloads: `navigator.onLine` is true on Wi-Fi with no internet, and a reload then lands on
 * the browser's error page with the app gone. A HEAD request skips the body, and `no-store` skips the browser cache.
 * A Wi-Fi login page answering instead isn't JSON, so it counts as unreachable.
 */
export async function canReachSite(fetchImpl: Fetch = (input, init) => fetch(input, init)): Promise<boolean> {
  try {
    const res = await fetchImpl(`${import.meta.env.BASE_URL}data/campus.json`, { method: 'HEAD', cache: 'no-store' });
    const type = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    return res.ok && type === 'application/json';
  } catch {
    return false;
  }
}
