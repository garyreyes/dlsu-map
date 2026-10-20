// Downloads the campus area from the OpenStreetMap main API and saves a pinned, committed snapshot (D4, D27).
// Run by hand with `npm run fetch-osm`, never at build time or in the app. Overpass was down on 2026-10-19 and
// 2026-10-20; the main API is fine for one small area request now and then (OSM API usage policy).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { incompleteRelations, osmToGeoJson, type Feature, type OsmElement } from './osm-to-geojson.ts';

const API = 'https://api.openstreetmap.org/api/0.6';
// About 400 m around the campus, including Andrew and Razon across the street (checked 2026-10-20).
const BBOX = [120.9895, 14.5612, 120.9968, 14.5682] as const; // west, south, east, north
const USER_AGENT = 'dlsu-map/0.1 (student project; https://github.com/garyreyes/dlsu-map)';
const OUT_DIR = new URL('../data-src/campus/osm/', import.meta.url);

async function get(path: string): Promise<OsmElement[]> {
  const response = await fetch(`${API}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(60_000), // a stuck connection fails instead of hanging the run
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${String(response.status)} ${response.statusText}`);
  const body = (await response.json()) as { elements?: OsmElement[] };
  if (!Array.isArray(body.elements)) throw new Error(`${path}: no elements in the response`);
  return body.elements;
}

/** One line per feature, sorted by id, so a re-download shows up in git as a readable diff. */
function serialize(date: string, features: readonly Feature[]): string {
  const header = {
    type: 'FeatureCollection',
    snapshot: date,
    source: `${API}/map?bbox=${BBOX.join(',')}`,
    attribution: '© OpenStreetMap contributors',
    license: 'ODbL 1.0, https://opendatacommons.org/licenses/odbl/1-0/',
    // The area asked for, not the data's extent: ways come back whole (the LRT line runs far past it).
    requestedBbox: BBOX,
  };
  const sorted = [...features].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const head = JSON.stringify(header).slice(0, -1);
  return `${head},"features":[\n${sorted.map((f) => JSON.stringify(f)).join(',\n')}\n]}\n`;
}

async function main(): Promise<void> {
  // The date in Manila, not UTC: a run before 08:00 must not be stamped with yesterday.
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  const out = new URL(`snapshot-${date}.geojson`, OUT_DIR);
  if (existsSync(out))
    throw new Error(`${out.pathname} exists. Snapshots are pinned: delete it by hand to redo today's.`);

  const byKey = new Map((await get(`/map.json?bbox=${BBOX.join(',')}`)).map((e) => [`${e.type}/${String(e.id)}`, e]));
  const missing = incompleteRelations([...byKey.values()]);
  for (const id of missing) {
    for (const e of await get(`/relation/${String(id)}/full.json`)) byKey.set(`${e.type}/${String(e.id)}`, e);
  }

  const { features, warnings } = osmToGeoJson([...byKey.values()]);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(out, serialize(date, features));

  const counts = new Map<string, number>();
  for (const f of features) counts.set(f.geometry.type, (counts.get(f.geometry.type) ?? 0) + 1);
  console.log(`Wrote ${out.pathname}: ${String(features.length)} features`);
  for (const [type, n] of counts) console.log(`  ${type}: ${String(n)}`);
  console.log(`Relations fetched in full: ${missing.join(', ') || 'none'}`);
  for (const w of warnings) console.warn(`  warning: ${w}`);
}

await main();
