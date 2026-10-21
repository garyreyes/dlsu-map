// The real campus, room lists and building files, compiled from data-src as the build does, for the tests that route
// over them (routing.test.ts, indoor-routing.test.ts). Throws if any of it doesn't compile: the compile tests say why.
import { readdirSync, readFileSync } from 'node:fs';
import { buildingSourcesSchema } from '../src/shared/data/buildings.ts';
import { floorSourceSchema, verticalSourcesSchema } from '../src/shared/data/floor-source.ts';
import type { Indoor } from '../src/shared/data/indoor.ts';
import { toPrefixTable } from '../src/shared/data/prefix-table.ts';
import { compileCampus, type Snapshot } from '../scripts/compile/campus.ts';
import { entranceSourcesSchema, gateSourcesSchema } from '../scripts/compile/campus-walk.ts';
import { compileIndoor } from '../scripts/compile/indoor.ts';
import { compileRooms } from '../scripts/compile/rooms.ts';

const text = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path: string): unknown => JSON.parse(text(path));
const list = (dir: string) => readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true });

const compiled = compileCampus(
  buildingSourcesSchema.parse(json('data-src/campus/buildings.json')),
  json('data-src/campus/osm/snapshot-2026-10-20.geojson') as Snapshot,
  {
    gates: gateSourcesSchema.parse(json('data-src/campus/gates.json')),
    entrances: entranceSourcesSchema.parse(json('data-src/campus/entrances.json')),
  },
);
if (compiled.campus === null) throw new Error('the real campus did not compile; see tests/compile-data.test.ts');
export const campus = compiled.campus;

const lists = list('data-src/rooms/')
  .filter((f) => f.name.endsWith('.csv'))
  .map((f) => ({ building: f.name.replace(/\.csv$/, ''), file: f.name, text: text(`data-src/rooms/${f.name}`) }));
const roomsResult = compileRooms(
  lists,
  toPrefixTable(campus.buildings),
  new Map(campus.buildings.map((b) => [b.slug, b.levels])),
);
if (roomsResult.rooms === null) throw new Error('the real rooms did not compile; see tests/compile-rooms.test.ts');
export const rooms = roomsResult.rooms;

/** Every building file the build writes, by slug. */
export const indoor: ReadonlyMap<string, Indoor> = (() => {
  const dirs = list('data-src/floors/').filter((d) => d.isDirectory());
  const files = dirs.flatMap((d) =>
    list(`data-src/floors/${d.name}/`)
      .filter((f) => /^\d\d\.json$/.test(f.name))
      .map((f) => `data-src/floors/${d.name}/${f.name}`)
      .map((path) => ({ path, floor: floorSourceSchema.parse(json(path)) })),
  );
  const verticals = dirs
    .filter((d) => list(`data-src/floors/${d.name}/`).some((f) => f.name === 'verticals.json'))
    .map((d) => {
      const path = `data-src/floors/${d.name}/verticals.json`;
      return { path, building: d.name, list: verticalSourcesSchema.parse(json(path)) };
    });
  const points = campus.walk.points;
  const entrances = campus.entrances.map((e) => ({
    building: e.building,
    kind: e.kind,
    point: [points[2 * e.point] ?? 0, points[2 * e.point + 1] ?? 0] as const,
  }));
  const result = compileIndoor(files, campus.buildings, { rooms: rooms.rooms, verticals, entrances });
  if (result.errors.length > 0) throw new Error(`the real floors did not compile:\n${result.errors.join('\n')}`);
  return new Map(result.buildings.map((b) => [b.building, b]));
})();
