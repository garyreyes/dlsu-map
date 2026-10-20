// data-src → public/data (ARCHITECTURE §4). Run by `npm run compile-data`, and first thing in `build` and `dev`, so
// a broken data constraint fails CI (ARCHITECTURE §3.4). Prints the compile report; exits 1 on any error and then
// writes nothing. The rules live in scripts/compile/ (pure, tested); this file only reads, writes and prints.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildingSourcesSchema } from '../src/shared/data/buildings.ts';
import { compileCampus, type Snapshot } from './compile/campus.ts';

const root = new URL('../', import.meta.url);
const readJson = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

/** The newest pinned snapshot: names sort by date (`snapshot-2026-10-20.geojson`). */
function latestSnapshot(): string {
  const dir = 'data-src/campus/osm/';
  const files = readdirSync(new URL(dir, root)).filter((f) => /^snapshot-\d{4}-\d{2}-\d{2}\.geojson$/.test(f));
  const latest = files.sort().at(-1);
  if (!latest) throw new Error(`no snapshot-<date>.geojson in ${dir}; run npm run fetch-osm`);
  return dir + latest;
}

function main(): number {
  const sources = buildingSourcesSchema.safeParse(readJson('data-src/campus/buildings.json'));
  if (!sources.success) {
    console.error('data-src/campus/buildings.json is invalid:');
    for (const issue of sources.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    return 1;
  }
  const snapshotPath = latestSnapshot();
  const { campus, errors, notes } = compileCampus(sources.data, readJson(snapshotPath) as Snapshot);

  console.log(`compile-data: ${snapshotPath}`);
  for (const note of notes) console.log(`  note: ${note}`);
  if (!campus || errors.length > 0) {
    for (const error of errors) console.error(`  error: ${error}`);
    console.error(`compile-data failed: ${String(errors.length)} error(s); public/data was not written`);
    return 1;
  }

  const json = JSON.stringify(campus);
  mkdirSync(new URL('public/data/', root), { recursive: true });
  writeFileSync(new URL('public/data/campus.json', root), json);
  const volumes = campus.buildings.reduce((n, b) => n + b.volumes.length, 0);
  const kinds = Object.entries(
    campus.paths.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] ?? 0) + 1 }), {}),
  );
  console.log(
    `  buildings: ${String(campus.buildings.length)} (${String(volumes)} volumes), bridges: ${String(campus.bridges.length)}`,
  );
  console.log(`  campus rings: ${String(campus.campus.length)}, city blocks: ${String(campus.city.length)}`);
  console.log(`  paths: ${kinds.map(([k, n]) => `${k} ${String(n)}`).join(', ')}`);
  console.log(`  wrote public/data/campus.json (${(json.length / 1024).toFixed(0)} KB)`);
  return 0;
}

process.exitCode = main();
