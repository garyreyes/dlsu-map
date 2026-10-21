// The real room lists through the compiler. The numbers were counted by hand on each lobby directory photo
// (2026-10-20), then corrected from the doors (owner, 2026-10-21). STRC: G 13, 2F 19, 3F 18, 4F 12. Velasco, St. Joseph
// and St. Miguel: see below. If one moves, check the CSV against the photo before changing it.
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
    ['ST102', 1, 'Room'], // not the testing lab; its name is not known yet (owner, 2026-10-21)
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

describe('Velasco, St. Joseph and St. Miguel (D33: a dash on these signs is a range)', () => {
  it.each([
    ['velasco', 72, [14, 12, 16, 17, 13]],
    ['sj', 78, [15, 13, 11, 9, 12, 18]],
    ['miguel', 69, [24, 18, 15, 12]],
  ])('%s has %i rooms, floor by floor as the directory lists them', (building, total, perFloor) => {
    const list = all.filter((r) => r.building === building);
    expect(list).toHaveLength(total);
    expect(perFloor.map((_, i) => list.filter((r) => r.floor === i + 1).length)).toStrictEqual(perFloor);
  });

  it.each([
    ['velasco', /^VL\d/],
    ['sj', /^SJ\d/],
    ['miguel', /^SM\d/],
  ])('stores every %s code with its canonical prefix, never VH or J', (building, prefix) => {
    expect(all.filter((r) => r.building === building).every((r) => prefix.test(r.code))).toBe(true);
  });

  it.each([
    ['VL305', 'velasco', 3, 'Classrooms'],
    ['VL308', 'velasco', 3, 'Classrooms'],
    ['VL502', 'velasco', 5, 'Classrooms'],
    ['VL508', 'velasco', 5, 'Classrooms'],
    ['VL406', 'velasco', 4, 'Classrooms'],
    ['VL201A', 'velasco', 2, 'Classrooms'],
    ['VL201B', 'velasco', 2, 'Classrooms'],
    ['VL206', 'velasco', 2, 'Classrooms'],
    ['VL208B', 'velasco', 2, 'Computer Lab'],
    ['VL106', 'velasco', 1, 'Computer Numerical Control Lab / MEM Computer Integrated Manufacturing Lab'],
    ['SJ305', 'sj', 3, 'General Chemistry Lab'],
    ['SJ303', 'sj', 3, 'Classrooms'],
    ['SJ404', 'sj', 4, 'Classrooms'],
    ['SJ512', 'sj', 5, 'Instrument Room'],
    ['SJ111', 'sj', 1, 'Classrooms'],
    ['SJ118B', 'sj', 1, 'NSTP & Foundation Office'],
    ['SJ601', 'sj', 6, 'Chemical Room'],
    ['SJ602B', 'sj', 6, 'Devt. Biology Research Room'],
    ['SJ209', 'sj', 2, 'Comparative Anatomy Lab'],
    ['SM101B', 'miguel', 1, 'Hydrology Laboratory'],
    ['SM115B', 'miguel', 1, 'Biosensing and Phenotyping'],
    ['SM315', 'miguel', 3, 'Classrooms'],
    ['SM407', 'miguel', 4, 'Classrooms'],
    ['SM402C', 'miguel', 4, 'Electric Circuit Laboratory'],
    ['SM212B', 'miguel', 2, 'Department of Communication Laboratory'],
  ])('%s (%s) is on floor %i: %s', (code, building, floor, name) => {
    expect(room(code)).toStrictEqual({ code, building, floor, name });
  });

  it('keeps Velasco 151 and 153 on the ground-floor mezzanine', () => {
    expect(room('VL151')).toMatchObject({ floor: 1, floorLabel: 'G Mezz' });
    expect(room('VL153')).toStrictEqual({
      code: 'VL153',
      building: 'velasco',
      floor: 1,
      floorLabel: 'G Mezz',
      name: 'CAD/CAM Lab',
    });
  });

  it.each(['VL201', 'SJ102', 'SJ301', 'SM301', 'SM302'])('has no %s (the directory skips it)', (code) => {
    expect(room(code)).toBeUndefined();
  });
});
