// data-src → public/data (ARCHITECTURE §4). Run by `npm run compile-data`, and first thing in `build` and `dev`, so
// a broken data constraint fails CI (ARCHITECTURE §3.4). Prints the compile report; exits 1 on any error and then
// writes nothing. The rules live in scripts/compile/ (pure, tested); this file only reads, writes and prints.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { z } from 'zod';
import { buildingSourcesSchema } from '../src/shared/data/buildings.ts';
import type { Campus } from '../src/shared/data/campus.ts';
import type { Rooms } from '../src/shared/data/rooms.ts';
import { floorSourceSchema, verticalSourcesSchema, type VerticalSource } from '../src/shared/data/floor-source.ts';
import { toPrefixTable } from '../src/shared/data/prefix-table.ts';
import { compileCampus, type Snapshot } from './compile/campus.ts';
import { entranceSourcesSchema, gateSourcesSchema } from './compile/campus-walk.ts';
import { compileIndoor, type FloorFile, type IndoorInputs } from './compile/indoor.ts';
import { compileRooms, type RoomList } from './compile/rooms.ts';

const root = new URL('../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');
const ROOMS_DIR = 'data-src/rooms/';
const FLOORS_DIR = 'data-src/floors/';
/** Beside a building's floor files: its stairs and elevators (8a). Every other .json there is a floor file. */
const VERTICALS = 'verticals.json';

/** The newest pinned snapshot: names sort by date (`snapshot-2026-10-20.geojson`). */
function latestSnapshot(): string {
  const dir = 'data-src/campus/osm/';
  const files = readdirSync(new URL(dir, root)).filter((f) => /^snapshot-\d{4}-\d{2}-\d{2}\.geojson$/.test(f));
  const latest = files.sort().at(-1);
  if (!latest) throw new Error(`no snapshot-<date>.geojson in ${dir}; run npm run fetch-osm`);
  return dir + latest;
}

/** Every `data-src/rooms/<building>.csv`, in name order. No folder means no lists (the build then fails: no rooms). */
function roomLists(): RoomList[] {
  if (!existsSync(new URL(ROOMS_DIR, root))) return [];
  return readdirSync(new URL(ROOMS_DIR, root))
    .filter((f) => f.endsWith('.csv'))
    .sort()
    .map((f) => ({ building: f.replace(/\.csv$/, ''), file: ROOMS_DIR + f, text: read(ROOMS_DIR + f) }));
}

/** Every .json in each data-src/floors/<building>/, in name order. */
function floorDirFiles(): string[] {
  if (!existsSync(new URL(FLOORS_DIR, root))) return [];
  return readdirSync(new URL(FLOORS_DIR, root), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(new URL(`${FLOORS_DIR}${d.name}/`, root))
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => `${FLOORS_DIR}${d.name}/${f}`),
    );
}

/** Every data-src/floors/<building>/<NN>.json, read with its schema; null if any is invalid (each one printed). */
function floorFiles(): FloorFile[] | null {
  const paths = floorDirFiles().filter((p) => !p.endsWith(`/${VERTICALS}`));
  const files: FloorFile[] = [];
  for (const path of paths) {
    const floor = readSource(path, floorSourceSchema);
    if (!floor) return null;
    files.push({ path, floor });
  }
  return files;
}

/** Every data-src/floors/<building>/verticals.json, read with its schema; null if any is invalid. */
function verticalFiles(): IndoorInputs['verticals'] | null {
  const files: { path: string; building: string; list: VerticalSource[] }[] = [];
  for (const path of floorDirFiles().filter((p) => p.endsWith(`/${VERTICALS}`))) {
    const list = readSource(path, verticalSourcesSchema);
    if (!list) return null;
    files.push({ path, building: path.split('/').at(-2) ?? '', list });
  }
  return files;
}

/** What floors are labelled against: the room list, the verticals and campus.json's entrances, in its order. */
function indoorInputs(campus: Campus, rooms: Rooms | null, verticals: IndoorInputs['verticals']): IndoorInputs {
  const points = campus.walk.points;
  return {
    rooms: rooms?.rooms ?? [],
    verticals,
    entrances: campus.entrances.map((e) => ({
      building: e.building,
      kind: e.kind,
      point: [points[2 * e.point] ?? 0, points[2 * e.point + 1] ?? 0] as const,
    })),
  };
}

/** A data-src file read with its schema, or null after printing what is wrong with it. */
function readSource<T>(path: string, schema: z.ZodType<T>): T | null {
  const parsed = schema.safeParse(JSON.parse(read(path)));
  if (parsed.success) return parsed.data;
  console.error(`${path} is invalid:`);
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  return null;
}

function write(name: string, data: unknown): void {
  const json = JSON.stringify(data);
  const file = new URL(`public/data/${name}`, root);
  mkdirSync(new URL('.', file), { recursive: true });
  writeFileSync(file, json);
  console.log(`  wrote public/data/${name} (${(json.length / 1024).toFixed(0)} KB)`);
}

function printCampus(campus: Campus): void {
  const volumes = campus.buildings.reduce((n, b) => n + b.volumes.length, 0);
  const kinds = Object.entries(
    campus.paths.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] ?? 0) + 1 }), {}),
  );
  console.log(
    `  buildings: ${String(campus.buildings.length)} (${String(volumes)} volumes), bridges: ${String(campus.bridges.length)}`,
  );
  console.log(`  campus rings: ${String(campus.campus.length)}, city blocks: ${String(campus.city.length)}`);
  console.log(`  paths: ${kinds.map(([k, n]) => `${k} ${String(n)}`).join(', ')}`);
  const verified = campus.entrances.filter((e) => e.verified).length;
  console.log(
    `  walk: ${String(campus.walk.points.length / 2)} points, ${String(campus.walk.links.length)} links; ` +
      `gates: ${String(campus.gates.length)}; entrances: ${String(campus.entrances.length)} (${String(verified)} verified)`,
  );
}

function main(): number {
  const sources = readSource('data-src/campus/buildings.json', buildingSourcesSchema);
  const gates = readSource('data-src/campus/gates.json', gateSourcesSchema);
  const entrances = readSource('data-src/campus/entrances.json', entranceSourcesSchema);
  const floors = floorFiles();
  const verticals = verticalFiles();
  if (!sources || !gates || !entrances || !floors || !verticals) return 1;
  const snapshotPath = latestSnapshot();
  const campusResult = compileCampus(sources, JSON.parse(read(snapshotPath)) as Snapshot, { gates, entrances });
  // Rooms and floors are checked against the same buildings the campus has: prefixes from buildings.json, floors and
  // outlines from OSM. Without a campus there is nothing to check them against: report the campus errors alone.
  const buildings = campusResult.campus?.buildings;
  const roomsResult = buildings
    ? compileRooms(roomLists(), toPrefixTable(buildings), new Map(buildings.map((b) => [b.slug, b.levels])))
    : { rooms: null, errors: [], notes: ['rooms: not checked, because the campus has errors'] };
  const indoorResult = campusResult.campus
    ? compileIndoor(
        floors,
        campusResult.campus.buildings,
        indoorInputs(campusResult.campus, roomsResult.rooms, verticals),
      )
    : { buildings: [], errors: [], notes: [] };

  console.log(`compile-data: ${snapshotPath}, ${ROOMS_DIR}*.csv, ${FLOORS_DIR}*/*.json`);
  const notes = [...campusResult.notes, ...roomsResult.notes, ...indoorResult.notes];
  for (const note of notes) console.log(`  note: ${note}`);
  const errors = [...campusResult.errors, ...roomsResult.errors, ...indoorResult.errors];
  if (!campusResult.campus || !roomsResult.rooms || errors.length > 0) {
    for (const error of errors) console.error(`  error: ${error}`);
    console.error(`compile-data failed: ${String(errors.length)} error(s); public/data was not written`);
    return 1;
  }
  printCampus(campusResult.campus);
  write('campus.json', campusResult.campus);
  write('rooms.json', roomsResult.rooms);
  // A building whose floor files were all removed must not keep a stale file.
  rmSync(new URL('public/data/buildings/', root), { recursive: true, force: true });
  for (const b of indoorResult.buildings) write(`buildings/${b.building}.json`, b);
  return 0;
}

process.exitCode = main();
