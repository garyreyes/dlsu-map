// `floor-extract shots <building>`: a screenshot of P1 (the dev floor preview, 6d) for each of the building's floor
// files, so Claude can catch an obviously wrong floor before the owner looks. Compiles the data, starts Vite itself
// (and stops it, so no dev server is left holding a port), and fails on a page error, a failed load, or a request to
// another site.
// Playwright's own browsers aren't installed on our laptops: Edge by default, PLAYWRIGHT_CHANNEL=chrome for Chrome.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/shots/', import.meta.url));
/** The 3D view has no "done drawing" signal; 3.5 s was enough for every STRC floor in 6d. */
const SETTLE_MS = 3500;

function floorsOf(building: string): number[] {
  const dir = join(ROOT, 'data-src', 'floors', building);
  if (!existsSync(dir)) throw new Error(`no data-src/floors/${building}/: is "${building}" a building slug?`);
  const names = readdirSync(dir).filter((n) => /^\d{2}\.json$/.test(n));
  if (names.length === 0) throw new Error(`${dir} has no floor files`);
  return names.map((n) => Number(n.slice(0, 2)));
}

/** What went wrong on the page: anything here fails the run. */
function watch(page: Page, origin: string, building: string): string[] {
  const problems: string[] = [];
  // data: and blob: URLs are the page's own; only a network request can reach another site.
  const offsite = (url: string) => /^(https?|wss?):/.test(url) && new URL(url).origin.replace(/^ws/, 'http') !== origin;
  page.on('request', (r) => {
    if (offsite(r.url())) problems.push(`asked another site: ${r.url()}`);
  });
  page.on('websocket', (w) => {
    if (offsite(w.url())) problems.push(`opened a socket to another site: ${w.url()}`);
  });
  page.on('response', (r) => {
    // P1 probes every full-tier building for floor files; another building with none yet answers 404.
    const other = /\/data\/buildings\/([a-z0-9-]+)\.json$/.exec(new URL(r.url()).pathname)?.[1];
    if (r.status() >= 400 && !(r.status() === 404 && other && other !== building)) {
      problems.push(`${String(r.status())} for ${r.url()}`);
    }
  });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => {
    // A failed load is logged too; the response handler above has already judged it.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problems.push(m.text());
  });
  return problems;
}

async function capture(base: string, building: string, floors: readonly number[]): Promise<void> {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const problems = watch(page, new URL(base).origin, building);
    mkdirSync(OUT, { recursive: true });
    for (const floor of floors) {
      await page.goto(`${base}preview.html?building=${building}&floor=${String(floor)}`);
      await page.waitForSelector('canvas');
      await page.waitForTimeout(SETTLE_MS);
      const file = join(OUT, `${building}-${String(floor).padStart(2, '0')}.png`);
      await page.screenshot({ path: file });
      console.log(`  ${file}`);
    }
    if (problems.length > 0) throw new Error(`the preview had problems:\n  ${problems.join('\n  ')}`);
    console.log(`${building}: ${String(floors.length)} floors, no errors, nothing asked of another site`);
  } finally {
    await browser.close();
  }
}

export async function shots(building: string): Promise<void> {
  const floors = floorsOf(building);
  execFileSync(process.execPath, ['scripts/compile-data.ts'], { cwd: ROOT, stdio: 'inherit' });
  const server = await createServer({ root: ROOT, logLevel: 'warn', server: { port: 5199 } });
  await server.listen();
  try {
    const base = server.resolvedUrls?.local[0];
    if (!base) throw new Error('Vite started without a local URL');
    await capture(base, building, floors);
  } finally {
    await server.close();
  }
}
