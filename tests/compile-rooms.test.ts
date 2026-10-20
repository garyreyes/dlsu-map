// The real room lists through the compiler. The numbers were counted by hand on STRC's lobby directory photo
// (2026-10-20): G 13, 2F 19, 3F 18, 4F 12. If one moves, check the CSV against the photo before changing it.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildingSourcesSchema } from '../src/shared/data/buildings.ts';
import { toPrefixTable } from '../src/shared/data/prefix-table.ts';
import { roomsSchema } from '../src/shared/data/rooms.ts';
import { compileCampus, type Snapshot } from '../scripts/compile/campus.ts';
import { compileRooms } from '../scripts/compile/rooms.ts';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sources = buildingSourcesSchema.parse(JSON.parse(read('data-src/campus/buildings.json')));
const { campus } = compileCampus(
  sources,
  JSON.parse(read('data-src/campus/osm/snapshot-2026-10-20.geojson')) as Snapshot,
);
const buildings = campus?.buildings ?? [];
const lists = readdirSync(new URL('../data-src/rooms/', import.meta.url))
  .filter((f) => f.endsWith('.csv'))
  .map((f) => ({ building: f.replace(/\.csv$/, ''), file: f, text: read(`data-src/rooms/${f}`) }));
const { rooms, errors } = compileRooms(
  lists,
  toPrefixTable(buildings),
  new Map(buildings.map((b) => [b.slug, b.levels])),
);
const all = rooms?.rooms ?? [];
const room = (code: string) => all.find((r) => r.code === code);

describe('compiling the real room lists', () => {
  it('has no errors and passes the schema search reads with', () => {
    expect(errors).toStrictEqual([]);
    expect(roomsSchema.safeParse(rooms).success).toBe(true);
  });

  it('has STRC’s 62 rooms, floor by floor as the directory lists them', () => {
    const strc = all.filter((r) => r.building === 'strc');
    expect(strc).toHaveLength(62);
    expect([1, 2, 3, 4].map((f) => strc.filter((r) => r.floor === f).length)).toStrictEqual([13, 19, 18, 12]);
  });

  it('stores every STRC code with the canonical ST prefix, never C', () => {
    expect(all.filter((r) => r.building === 'strc').every((r) => /^ST\d/.test(r.code))).toBe(true);
  });

  it.each([
    ['ST404', 4, 'Biology Lab'],
    ['ST406', 4, 'Biology Lab'],
    ['ST102', 1, 'Structural and Materials Testing Lab'],
    ['ST104', 1, 'Structural and Materials Testing Lab'],
    ['ST106', 1, 'Structural and Materials Testing Lab'],
    ['ST105', 1, 'Mechatronics Lab'],
    ['ST107', 1, 'Energy Laboratory'],
    ['ST107B', 1, 'Biomaterials and Tissue Engineering Laboratory 1'],
    ['ST315A', 3, 'Computational Materials Design (CMD) Lab'],
    ['ST315B', 3, 'Instrumentation Lab'],
    ['ST302', 3, 'Computation Chemistry Research Laboratory'],
    ['ST402', 4, 'Stock Room'],
    ['ST219', 2, 'Biomaterials and Tissue Eng. Laboratory 2'],
  ])('%s is on floor %i: %s', (code, floor, name) => {
    expect(room(code)).toStrictEqual({ code, building: 'strc', floor, name });
  });

  it('has no room 103 (the directory skips it)', () => {
    expect(room('ST103')).toBeUndefined();
  });
});
