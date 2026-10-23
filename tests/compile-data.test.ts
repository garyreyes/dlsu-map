// The compiler on the real data-src: the numbers here were checked by hand against the OSM snapshot (2026-10-20).
// If a refresh or a rule change moves one, look at the map before updating the number.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildingSourcesSchema } from '../src/shared/data/buildings.ts';
import { campusSchema } from '../src/shared/data/campus.ts';
import sample from '../src/shared/data/campus.sample.json' with { type: 'json' };
import { toPrefixTable } from '../src/shared/data/prefix-table.ts';
import { compileCampus, type Snapshot } from '../scripts/compile/campus.ts';
import { entranceSourcesSchema, gateSourcesSchema } from '../scripts/compile/campus-walk.ts';

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const buildings = buildingSourcesSchema.parse(read('data-src/campus/buildings.json'));
const snapshot = read('data-src/campus/osm/snapshot-2026-10-23.geojson') as Snapshot;
const { campus, errors, notes } = compileCampus(buildings, snapshot);
const building = (slug: string) => campus?.buildings.find((b) => b.slug === slug);

describe('compiling the real campus', () => {
  it('has no errors and passes the schema the scene reads with', () => {
    expect(errors).toStrictEqual([]);
    expect(campusSchema.safeParse(campus).success).toBe(true);
  });

  it('has all 16 buildings, 10 of them full tier, in buildings.json order', () => {
    expect(campus?.buildings.map((b) => b.slug)).toStrictEqual(buildings.map((b) => b.slug));
    expect(campus?.buildings.filter((b) => b.tier === 'full')).toHaveLength(10);
  });

  it.each([
    ['andrew', 20, 90],
    ['strc', 4, 13.6],
    ['yuchengco', 9, 34], // its two OSM parts are 10 levels; the building is 9
    ['henry-sy', 15, 53.6],
    ['mutien', 2, 6.8],
  ])('%s has %i floors and is drawn %f m tall', (slug, levels, top) => {
    expect(building(slug)?.levels).toBe(levels);
    expect(Math.max(...(building(slug)?.volumes.map((v) => v.top) ?? []))).toBe(top);
  });

  it('joins the three connector parts that reach out of Yuchengco and Razon to them, not to the city', () => {
    const took = notes.filter((n) => n.includes('whose centre is in no listed building'));
    expect(took.map((n) => n.split(',')[0])).toStrictEqual([
      'yuchengco: took way/830571562',
      'yuchengco: took way/830571579',
      'razon: took way/830591486',
    ]);
  });

  it('keeps all 4 skybridges', () => {
    expect(campus?.bridges).toHaveLength(4);
  });

  it('keeps the 2 campus rings (main campus; STRC, Andrew and Razon across the side streets) and drops the 7 small patches', () => {
    expect(campus?.campus).toHaveLength(2);
    expect(notes).toContain('campus: dropped 7 boundary rings with no listed building in it');
  });

  // The schema says y is meters north; the prototype stored y as meters south. STRC is north of the origin.
  it('puts north up: STRC (north of Henry Sy) has the larger y', () => {
    const y = (slug: string) => building(slug)?.volumes[0]?.outline[1] ?? NaN;
    expect(y('strc')).toBeGreaterThan(150);
    expect(y('strc')).toBeGreaterThan(y('henry-sy'));
  });

  it('matches the sample 2c builds against, outline for outline', () => {
    for (const s of sample.buildings) {
      expect(building(s.slug)?.volumes[0], s.slug).toStrictEqual(s.volumes[0]);
    }
    expect(campus?.campus).toContainEqual(sample.campus[0]);
  });

  it('has the LRT line, Taft Avenue and walkways', () => {
    expect(campus?.paths.some((p) => p.kind === 'rail' && p.name === 'LRT Line 1')).toBe(true);
    expect(campus?.paths.some((p) => p.kind === 'road' && p.name === 'Taft Avenue')).toBe(true);
    expect(campus?.paths.filter((p) => p.kind === 'foot').length).toBeGreaterThan(20);
  });

  it('gives the parser the owner’s prefix table (ARCHITECTURE §3.3, D25, D51)', () => {
    expect(toPrefixTable(campus?.buildings ?? [])).toStrictEqual([
      { building: 'andrew', prefixes: ['AG'] },
      { building: 'gokongwei', prefixes: ['G'] },
      { building: 'velasco', prefixes: ['VL', 'VE', 'V'], suggestPrefixes: ['VH'] },
      { building: 'miguel', prefixes: ['SM'] },
      { building: 'yuchengco', prefixes: ['EY'] },
      { building: 'sj', prefixes: ['SJ'], suggestPrefixes: ['J'] },
      { building: 'ls', prefixes: ['LS'] },
      { building: 'razon', prefixes: ['ER'] },
      { building: 'mutien', prefixes: ['MM'] },
      { building: 'strc', prefixes: ['ST', 'C'] },
    ]);
  });
});

// 4a: the same compile with the gates and the entrance pins (D31). Pins are Charles's, dropped on openstreetmap.org
// on 2026-10-20; the Yuchengco–Connon walkway they rely on was added to OSM the same day.
describe('compiling the real walk network', () => {
  const walkSources = {
    gates: gateSourcesSchema.parse(read('data-src/campus/gates.json')),
    entrances: entranceSourcesSchema.parse(read('data-src/campus/entrances.json')),
  };
  const walked = compileCampus(buildings, snapshot, walkSources);
  const c = walked.campus;
  const linked = new Set(c?.walk.links.flatMap(([a, b]) => [a, b]));

  it('has no errors: every full building has a main entrance reachable from every gate', () => {
    expect(walked.errors).toStrictEqual([]);
    expect(campusSchema.safeParse(c).success).toBe(true);
  });

  it('has the 9 gates students use, in gates.json order, each on the network', () => {
    expect(c?.gates.map((g) => g.id)).toStrictEqual([
      'gate-1',
      'gate-2',
      'gate-3',
      'gate-4a',
      'gate-4b',
      'gate-5a',
      'gate-5b',
      'gate-6',
      'agno',
    ]);
    expect(c?.gates.filter((g) => !linked.has(g.point))).toStrictEqual([]);
  });

  it('has 17 entrances, all unverified until the on-site check (11a), each on the network', () => {
    expect(c?.entrances).toHaveLength(17);
    expect(c?.entrances.filter((e) => e.verified)).toStrictEqual([]);
    expect(c?.entrances.filter((e) => !linked.has(e.point))).toStrictEqual([]);
  });

  it('gives every full building a main entrance, and Yuchengco both of its doors', () => {
    const mains = new Set(c?.entrances.filter((e) => e.kind === 'main').map((e) => e.building));
    expect(buildings.filter((b) => b.tier === 'full' && !mains.has(b.slug))).toStrictEqual([]);
    expect(c?.entrances.filter((e) => e.building === 'yuchengco')).toHaveLength(2);
  });

  // 510 and 576 until Velasco's south main pin moved to its lobby door (9b): its door now joins a path mid-segment.
  // 511 and 577 until St. Joseph's south side pin moved to the TO CHAPEL passage (9c), the same way.
  it('keeps its size: 515 points, 582 links', () => {
    expect((c?.walk.points.length ?? 0) / 2).toBe(515);
    expect(c?.walk.links).toHaveLength(582);
  });

  it('walks Taft on its sidewalks and crosses at crosswalks (D32)', () => {
    const ways = c?.walk.ways ?? [];
    expect(ways).toContainEqual({ kind: 'sidewalk', name: 'Taft Avenue' });
    expect(ways).toContainEqual({ kind: 'crossing', name: 'Taft Avenue' });
    expect(ways.some((w) => w.kind === 'street' && w.name === 'Taft Avenue')).toBe(false);
  });
});
