// Size gate (10c, D49): fails `npm run build`, and so CI, when the first load or any one chunk grows past its budget.
// Plain Node with no dependencies, run after `vite build`. Sizes are gzip, which is what a phone downloads.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// D49: the budgets. Raise one only with a new decision, never to get a build green.
const FIRST_LOAD_BUDGET_KB = 200; // entry script plus every <link rel="modulepreload"> in index.html
const CHUNK_BUDGET_KB = 300; // every other .js file in dist/assets (the lazy 3D map, the three.js vendor chunk)

const DIST = 'dist';

const gzipKb = (file) => gzipSync(readFileSync(file)).length / 1000;
const rawKb = (file) => readFileSync(file).length / 1000;

/** The .js files index.html loads before the first screen: its module script and its modulepreload links. */
function firstLoadFiles(html) {
  const found = new Set();
  const tags = html.match(/<(?:script|link)\b[^>]*>/g) ?? [];
  for (const tag of tags) {
    const isScript = /^<script\b/.test(tag) && /\btype=["']module["']/.test(tag);
    const isPreload = /^<link\b/.test(tag) && /\brel=["']modulepreload["']/.test(tag);
    const url = tag.match(/\b(?:src|href)=["']([^"']+)["']/)?.[1];
    if ((isScript || isPreload) && url) found.add(join(DIST, url.replace(/^\//, '')));
  }
  return [...found];
}

const row = (name, raw, gz, budget, over) =>
  `${name.padEnd(46)}${raw.toFixed(1).padStart(10)}${gz.toFixed(1).padStart(10)}  ${budget.padEnd(14)}${over ? 'OVER' : 'ok'}`;

function main() {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const first = firstLoadFiles(html);
  if (first.length === 0) {
    console.error('check-size: found no entry script in dist/index.html. Did the build run?');
    process.exit(1);
  }

  const failures = [];
  const lines = [`${'file'.padEnd(46)}${'raw kB'.padStart(10)}${'gzip kB'.padStart(10)}  budget (gzip)`];

  const firstGz = first.reduce((sum, f) => sum + gzipKb(f), 0);
  const firstRaw = first.reduce((sum, f) => sum + rawKb(f), 0);
  const firstOver = firstGz > FIRST_LOAD_BUDGET_KB;
  if (firstOver) failures.push(`first load is ${firstGz.toFixed(1)} kB gzip, budget ${FIRST_LOAD_BUDGET_KB} kB`);
  lines.push(
    row(
      `first load (${first.length} file${first.length === 1 ? '' : 's'})`,
      firstRaw,
      firstGz,
      `<= ${FIRST_LOAD_BUDGET_KB} kB`,
      firstOver,
    ),
  );

  const names = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js'));
  for (const name of names) {
    const file = join(DIST, 'assets', name);
    const gz = gzipKb(file);
    const over = gz > CHUNK_BUDGET_KB;
    if (over) failures.push(`${name} is ${gz.toFixed(1)} kB gzip, budget ${CHUNK_BUDGET_KB} kB per chunk`);
    const note = first.includes(file) ? '  (in first load)' : '';
    lines.push(row(name, rawKb(file), gz, `<= ${CHUNK_BUDGET_KB} kB`, over) + note);
  }

  console.log(lines.join('\n'));
  if (failures.length > 0) {
    console.error(`\ncheck-size: over budget (D49):\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log('\ncheck-size: within budget.');
}

main();
