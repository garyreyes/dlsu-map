// compileCampus on a small made-up campus, drawn in meters so every expected value can be checked by hand. Each rule
// here decides what the phone draws; a wrong one drops a building, floats it or puts it in the wrong place silently.
import { describe, expect, it } from 'vitest';
import { projection } from '../../src/shared/geo/project.ts';
import type { BuildingSource } from '../../src/shared/data/buildings.ts';
import type { Feature, Tags } from '../osm-to-geojson.ts';
import { compileCampus, CAMPUS_RELATION, ORIGIN, type Snapshot } from './campus.ts';

type Pt = [number, number];
const { toLonLat } = projection(ORIGIN);
const close = (ring: Pt[]) => [...ring, ring[0] as Pt].map(toLonLat);
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const flat = (ring: Pt[]) => ring.flat();

const polygon = (id: string, tags: Tags, ...rings: Pt[][]): Feature => ({
  type: 'Feature',
  id,
  properties: { tags },
  geometry: { type: 'Polygon', coordinates: rings.map(close) },
});
const line = (id: string, tags: Tags, points: Pt[]): Feature => ({
  type: 'Feature',
  id,
  properties: { tags },
  geometry: { type: 'LineString', coordinates: points.map(toLonLat) },
});

const strc: BuildingSource = {
  slug: 'strc',
  osm: ['way/1'],
  name: 'Science & Technology Research Center',
  short: 'STRC',
  aliases: ['STRC'],
  tier: 'full',
  prefixes: ['ST', 'C'],
  floorLabels: { '1': 'G' },
};
const henrySy: BuildingSource = {
  slug: 'henry-sy',
  osm: ['way/3'],
  name: 'Henry Sy Sr. Hall',
  short: 'Henry Sy',
  aliases: ['Henry Sy'],
  tier: 'block',
  prefixes: [],
};

const features: Feature[] = [
  {
    type: 'Feature',
    id: CAMPUS_RELATION,
    properties: { tags: { amenity: 'university' } },
    geometry: { type: 'MultiPolygon', coordinates: [[close(box(0, 0, 100, 100))], [close(box(500, 500, 504, 504))]] },
  },
  polygon('way/1', { building: 'university', 'building:levels': '4' }, box(10, 10, 30, 30)),
  polygon('way/2', { 'building:part': 'yes', 'building:levels': '6' }, box(12, 12, 18, 18)),
  polygon(
    'way/3',
    { building: 'university', 'building:levels': '15', 'building:min_level': '2', height: '53.6' },
    box(50, 10, 70, 30),
  ),
  polygon(
    'way/4',
    { 'building:part': 'bridge', 'building:levels': '3', 'building:min_level': '2' },
    box(28, 15, 52, 20),
  ),
  polygon(
    'way/5',
    { 'building:part': 'bridge', 'building:levels': '3', 'building:min_level': '2' },
    box(200, 200, 210, 205),
  ),
  // Touches STRC and Henry Sy only along their walls: no corner of one is inside the other.
  polygon(
    'way/21',
    { 'building:part': 'bridge', 'building:levels': '3', 'building:min_level': '2' },
    box(30, 22, 50, 24),
  ),
  // Mostly outside STRC, one corner inside: its centre is in no listed building.
  polygon('way/20', { 'building:part': 'yes', 'building:levels': '9', 'building:min_level': '7' }, box(25, 25, 40, 40)),
  // Raised, near no listed building: the city has no base, so it would stand as a pillar from the ground.
  polygon(
    'way/22',
    { 'building:part': 'yes', 'building:levels': '5', 'building:min_level': '3' },
    box(150, 150, 160, 160),
  ),
  polygon('way/23', { highway: 'pedestrian', area: 'yes' }, box(60, 60, 70, 70)),
  polygon('way/6', { building: 'house' }, box(200, 50, 210, 60)),
  polygon('way/7', { building: 'yes', 'building:levels': '3' }, box(1000, 1000, 1010, 1010)),
  polygon('way/8', { building: 'roof' }, box(40, 40, 45, 45)),
  polygon('way/9', { building: 'yes', 'building:levels': '1' }, box(80, 80, 90, 90)),
  line('way/10', { highway: 'primary', name: 'Taft Avenue' }, [
    [-1000, 50],
    [50, 50],
  ]),
  line('way/11', { highway: 'footway' }, [
    [20, 40],
    [60, 40],
  ]),
  line('way/12', { highway: 'service' }, [
    [0, 95],
    [100, 95],
  ]),
  line('way/13', { railway: 'light_rail', name: 'LRT Line 1' }, [
    [-5, -1000],
    [-5, 1000],
  ]),
  line('way/14', { highway: 'construction' }, [
    [0, 0],
    [10, 10],
  ]),
];
const snapshot: Snapshot = { snapshot: '2026-10-20', features };

describe('compileCampus on a made-up campus', () => {
  const { campus, errors, notes } = compileCampus([strc, henrySy], snapshot);

  it('compiles without errors into a file the scene accepts', () => {
    expect(errors).toStrictEqual([]);
    expect(campus).not.toBeNull();
    expect(campus?.snapshot).toBe('2026-10-20');
    expect(campus?.origin).toStrictEqual(ORIGIN);
  });

  it('keeps the campus ring with a building in it and drops the empty one', () => {
    expect(campus?.campus).toStrictEqual([flat(box(0, 0, 100, 100))]);
    expect(notes).toContain('campus: dropped 1 boundary ring with no listed building in it');
  });

  it('draws a building as its outline plus each part inside it', () => {
    expect(campus?.buildings[0]).toStrictEqual({
      slug: 'strc',
      name: 'Science & Technology Research Center',
      short: 'STRC',
      aliases: ['STRC'],
      tier: 'full',
      prefixes: ['ST', 'C'],
      floorLabels: { '1': 'G' },
      levels: 4,
      volumes: [
        { outline: flat(box(10, 10, 30, 30)), base: 0, top: 13.6 },
        { outline: flat(box(12, 12, 18, 18)), base: 0, top: 20.4 },
        { outline: flat(box(25, 25, 40, 40)), base: 23.8, top: 30.6 },
      ],
    });
  });

  it('gives a part that reaches outside every building to the one holding its corners, and says so', () => {
    expect(notes).toContain('strc: took way/20, whose centre is in no listed building (1 of its 4 corners is in strc)');
  });

  it('never stands a raised block on the ground as a city pillar', () => {
    expect(notes).toContain(
      'city: skipped 1 raised block (the city layer has no base, so it would stand on the ground)',
    );
  });

  it('notes a pedestrian area, which is not a line to draw', () => {
    expect(notes).toContain('paths: skipped 1 area (way/23)');
  });

  it('lifts a building on stilts off the ground (Henry Sy)', () => {
    expect(campus?.buildings[1]?.volumes).toStrictEqual([{ outline: flat(box(50, 10, 70, 30)), base: 6.8, top: 53.6 }]);
    expect(campus?.buildings[1]?.levels).toBe(15);
  });

  it('keeps the skybridge that touches a campus building and drops the one that touches none', () => {
    expect(campus?.bridges).toStrictEqual([
      { outline: flat(box(28, 15, 52, 20)), base: 6.8, top: 10.2 },
      { outline: flat(box(30, 22, 50, 24)), base: 6.8, top: 10.2 },
    ]);
    expect(notes).toContain('bridges: dropped way/5 (touches no listed building)');
  });

  it('puts unlisted buildings within 300 m in the city, never roofs or far-away ones', () => {
    expect(campus?.city).toStrictEqual([
      { outline: flat(box(200, 50, 210, 60)), top: 9 },
      { outline: flat(box(80, 80, 90, 90)), top: 3.4 },
    ]);
  });

  it('sorts paths into kinds and cuts them 300 m out from the campus', () => {
    expect(campus?.paths).toStrictEqual([
      { kind: 'road', name: 'Taft Avenue', line: [-300, 50, 50, 50] },
      { kind: 'foot', line: [20, 40, 60, 40] },
      { kind: 'street', line: [0, 95, 100, 95] },
      { kind: 'rail', name: 'LRT Line 1', line: [-5, -300, -5, 400] },
    ]);
  });

  it('reaches every path kind', () => {
    expect(new Set(campus?.paths.map((p) => p.kind))).toStrictEqual(new Set(['street', 'road', 'foot', 'rail']));
  });
});

describe('compileCampus errors (the build fails on each)', () => {
  it('names a listed OSM id missing from the snapshot', () => {
    const { errors } = compileCampus([{ ...strc, osm: ['way/1', 'way/99'] }, henrySy], snapshot);
    expect(errors).toStrictEqual(['strc: way/99 is not in the snapshot']);
  });

  it('names a prefix two buildings share', () => {
    const { errors, campus } = compileCampus([strc, { ...henrySy, tier: 'full', prefixes: ['C'] }], snapshot);
    expect(errors).toStrictEqual(['prefix C: strc, henry-sy']);
    expect(campus).toBeNull();
  });

  it('names a building OSM gives no level count', () => {
    const noLevels = features.map((f) =>
      f.id === 'way/3' ? polygon('way/3', { building: 'yes' }, box(50, 10, 70, 30)) : f,
    );
    const { errors } = compileCampus([strc, henrySy], { ...snapshot, features: noLevels });
    expect(errors).toStrictEqual(['henry-sy: no building:levels in OSM']);
  });

  it('names a height tag on a listed building it cannot read, instead of guessing', () => {
    const feet = features.map((f) =>
      f.id === 'way/1'
        ? polygon('way/1', { building: 'yes', 'building:levels': '4', height: '45 ft' }, box(10, 10, 30, 30))
        : f,
    );
    const { errors } = compileCampus([strc, henrySy], { ...snapshot, features: feet });
    expect(errors).toStrictEqual(['strc: way/1 has height="45 ft", which is not meters or a whole level count']);
  });

  it('only notes an unreadable height in the city', () => {
    const feet = features.map((f) =>
      f.id === 'way/6' ? polygon('way/6', { building: 'house', height: '20 ft' }, box(200, 50, 210, 60)) : f,
    );
    const { errors, notes } = compileCampus([strc, henrySy], { ...snapshot, features: feet });
    expect(errors).toStrictEqual([]);
    expect(notes).toContain('city: way/6 has height="20 ft", which is not meters or a whole level count');
  });

  it('notes a courtyard it cannot draw yet', () => {
    const withHole = features.map((f) =>
      f.id === 'way/1'
        ? polygon('way/1', { building: 'yes', 'building:levels': '4' }, box(10, 10, 30, 30), box(15, 15, 25, 25))
        : f,
    );
    const { errors, notes } = compileCampus([strc, henrySy], { ...snapshot, features: withHole });
    expect(errors).toStrictEqual([]);
    expect(notes).toContain('strc: 1 courtyard not drawn (campus.json has no holes yet)');
  });
});
