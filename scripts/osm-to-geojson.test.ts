// The converter decides every outline the map draws and every gate the router will use. A wrong ring silently draws
// a broken building, and a dropped gate silently removes an entrance, so each case asserts exact output.
// Real cases come from a cut of the 2026-10-20 download (scripts/fixtures, © OpenStreetMap contributors, ODbL).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  incompleteRelations,
  osmToGeoJson,
  type Feature,
  type OsmElement,
  type OsmNode,
  type OsmRelation,
  type OsmWay,
  type Position,
  type Tags,
} from './osm-to-geojson.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/osm-campus-sample.json', import.meta.url), 'utf8')) as {
  elements: OsmElement[];
};
const real = osmToGeoJson(fixture.elements);

function feature(id: string): Feature {
  const found = real.features.find((f) => f.id === id);
  if (!found) throw new Error(`no feature ${id}`);
  return found;
}
function element<T extends OsmElement['type']>(type: T, id: number): Extract<OsmElement, { type: T }> {
  const found = fixture.elements.find((e) => e.type === type && e.id === id);
  if (!found) throw new Error(`no ${type}/${String(id)} in fixture`);
  return found as Extract<OsmElement, { type: T }>;
}
/** Shoelace area in degrees²: positive = counterclockwise (RFC 7946 wants outer rings CCW, holes CW). */
function signedArea(ring: Position[]): number {
  let sum = 0;
  for (let i = 0; i + 1 < ring.length; i++) {
    const [x1, y1] = ring[i] ?? [0, 0];
    const [x2, y2] = ring[i + 1] ?? [0, 0];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}
const position = (n: OsmNode): Position => [n.lon, n.lat];
const wayPositions = (w: OsmWay): Position[] => w.nodes.map((id) => position(element('node', id)));
const isClosed = (ring: Position[]) => JSON.stringify(ring[0]) === JSON.stringify(ring.at(-1));

describe('real campus data', () => {
  it('keeps exactly the map features and drops everything else', () => {
    const expected = [
      'way/22480439', // STRC
      'relation/6095002', // Miguel Hall, with its courtyard
      'relation/11126048', // the campus boundary
      'way/156307540', // Taft Avenue
      'way/614459905', // a zebra crossing footway
      'way/406883428', // a skybridge
      'way/576201878', // the LRT line
      'way/814040306', // Central Plaza (area=yes)
      // gates and entrances, most of them on the campus boundary
      'node/7604181170',
      'node/7604181112',
      'node/7604181115',
      'node/7604181123',
      'node/7604181139',
      'node/7604181140',
      'node/821585690',
      'node/1385443464',
      'node/821585671',
      'node/7604181171',
      'node/9837352817',
      'node/1120041127',
      'node/7755097912', // an elevator
      // street crossings
      'node/7604181116',
      'node/7604181142',
      'node/6337006019',
      'node/5812305183',
      'node/5812305184',
    ];
    expect(real.features.map((f) => f.id).sort()).toStrictEqual([...expected].sort());
    expect(real.warnings).toStrictEqual([]);
  });

  it('STRC is one closed counterclockwise ring through its own nodes, tags kept as-is', () => {
    const strc = feature('way/22480439');
    const way = element('way', 22480439);
    expect(strc.properties.tags).toStrictEqual(way.tags);
    expect(strc.geometry.type).toBe('Polygon');
    if (strc.geometry.type !== 'Polygon') return;
    const [ring, ...holes] = strc.geometry.coordinates;
    expect(holes).toStrictEqual([]);
    expect(ring).toHaveLength(way.nodes.length);
    expect(isClosed(ring ?? [])).toBe(true);
    expect(signedArea(ring ?? [])).toBeGreaterThan(0);
    expect(new Set(ring?.map((p) => p.join()))).toStrictEqual(new Set(wayPositions(way).map((p) => p.join())));
  });

  it('Miguel Hall has its outline plus the courtyard as a hole', () => {
    const miguel = feature('relation/6095002');
    expect(miguel.geometry.type).toBe('Polygon');
    if (miguel.geometry.type !== 'Polygon') return;
    const [outer, inner, ...more] = miguel.geometry.coordinates;
    expect(more).toStrictEqual([]);
    expect(outer).toHaveLength(9);
    expect(inner).toHaveLength(5);
    expect(signedArea(outer ?? [])).toBeGreaterThan(0);
    expect(signedArea(inner ?? [])).toBeLessThan(0);
    const holeNodes = new Set(wayPositions(element('way', 406883426)).map((p) => p.join()));
    expect(new Set(inner?.map((p) => p.join()))).toStrictEqual(holeNodes);
  });

  it('the campus boundary is 9 closed counterclockwise rings', () => {
    const campus = feature('relation/11126048');
    expect(campus.geometry.type).toBe('MultiPolygon');
    if (campus.geometry.type !== 'MultiPolygon') return;
    expect(campus.geometry.coordinates).toHaveLength(9);
    for (const [ring, ...holes] of campus.geometry.coordinates) {
      expect(holes).toStrictEqual([]);
      expect(isClosed(ring ?? [])).toBe(true);
      expect(signedArea(ring ?? [])).toBeGreaterThan(0);
    }
  });

  it('Taft Avenue is a line through its nodes in order', () => {
    expect(feature('way/156307540').geometry).toStrictEqual({
      type: 'LineString',
      coordinates: wayPositions(element('way', 156307540)),
    });
  });

  it('a highway with area=yes is a polygon', () => {
    expect(feature('way/814040306').geometry.type).toBe('Polygon');
  });

  it('a gate is a point at its node, tags kept as-is', () => {
    const gate = element('node', 821585690); // Gate 1 (South)
    expect(feature('node/821585690')).toStrictEqual({
      type: 'Feature',
      id: 'node/821585690',
      properties: { tags: gate.tags },
      geometry: { type: 'Point', coordinates: position(gate) },
    });
  });
});

// Small made-up shapes for the cases the real cut doesn't contain.
const node = (id: number, lon: number, lat: number, tags?: Tags): OsmNode => ({ type: 'node', id, lon, lat, tags });
const way = (id: number, nodes: number[], tags?: Tags): OsmWay => ({ type: 'way', id, nodes, tags });
const multipolygon = (id: number, members: [number, string][]): OsmRelation => ({
  type: 'relation',
  id,
  members: members.map(([ref, role]) => ({ type: 'way', ref, role })),
  tags: { type: 'multipolygon', building: 'yes' },
});
// Unit square 0..1 (nodes 1–4), a hole inside it (5–8), and a second square 2..3 (11–14) with a hole (15–18).
const nodes = [
  node(1, 0, 0),
  node(2, 1, 0),
  node(3, 1, 1),
  node(4, 0, 1),
  node(5, 0.25, 0.25),
  node(6, 0.75, 0.25),
  node(7, 0.75, 0.75),
  node(8, 0.25, 0.75),
  node(11, 2, 0),
  node(12, 3, 0),
  node(13, 3, 1),
  node(14, 2, 1),
  node(15, 2.25, 0.25),
  node(16, 2.75, 0.25),
  node(17, 2.75, 0.75),
  node(18, 2.25, 0.75),
  // A second square sharing node 1 (figure 8), and three nested squares 0..10, 3..7, 4..5.
  node(21, -1, 0),
  node(22, -1, -1),
  node(23, 0, -1),
  node(31, 0, 0.001),
  node(32, 10, 0.001),
  node(33, 10, 10),
  node(34, 0, 10),
  node(35, 3, 3),
  node(36, 7, 3),
  node(37, 7, 7),
  node(38, 3, 7),
  node(39, 4, 4),
  node(40, 5, 4),
  node(41, 5, 5),
  node(42, 4, 5),
  node(53, 2, 2),
];
const square: Position[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
];
const run = (...elements: OsmElement[]) => osmToGeoJson([...nodes, ...elements]);

describe('multipolygon rings', () => {
  it('joins open outer ways end to end, reversing one, into a single ring', () => {
    const out = run(
      way(101, [1, 2]),
      way(102, [3, 2]),
      way(103, [3, 4, 1]),
      multipolygon(9, [
        [101, 'outer'],
        [102, 'outer'],
        [103, 'outer'],
      ]),
    );
    expect(out.features.map((f) => f.geometry)).toStrictEqual([{ type: 'Polygon', coordinates: [square] }]);
    expect(out.warnings).toStrictEqual([]);
  });

  it('puts each hole in the outline that contains it, holes clockwise', () => {
    const out = run(
      way(101, [1, 2, 3, 4, 1]),
      way(102, [11, 12, 13, 14, 11]),
      way(103, [15, 16, 17, 18, 15]),
      multipolygon(9, [
        [101, 'outer'],
        [102, 'outer'],
        [103, 'inner'],
      ]),
    );
    expect(out.features.map((f) => f.geometry)).toStrictEqual([
      {
        type: 'MultiPolygon',
        coordinates: [
          [square],
          [
            [
              [2, 0],
              [3, 0],
              [3, 1],
              [2, 1],
              [2, 0],
            ],
            [
              [2.25, 0.25],
              [2.25, 0.75],
              [2.75, 0.75],
              [2.75, 0.25],
              [2.25, 0.25],
            ],
          ],
        ],
      },
    ]);
  });

  it('an empty role counts as outer', () => {
    const out = run(way(101, [1, 2, 3, 4, 1]), multipolygon(9, [[101, '']]));
    expect(out.features.map((f) => f.geometry)).toStrictEqual([{ type: 'Polygon', coordinates: [square] }]);
  });

  it('turns a clockwise outline counterclockwise', () => {
    const out = run(way(101, [1, 4, 3, 2, 1], { building: 'yes' }));
    expect(out.features.map((f) => f.geometry)).toStrictEqual([{ type: 'Polygon', coordinates: [square] }]);
  });
});

describe('what gets reported instead of guessed', () => {
  it.each<[string, OsmElement[], string]>([
    ['a ring that never closes', [way(101, [1, 2, 3]), multipolygon(9, [[101, 'outer']])], 'relation/9'],
    [
      'a member way that is missing',
      [
        way(101, [1, 2, 3, 4, 1]),
        multipolygon(9, [
          [101, 'outer'],
          [999, 'outer'],
        ]),
      ],
      'relation/9',
    ],
    ['a node that is missing', [way(101, [1, 2, 99, 1], { building: 'yes' })], 'way/101'],
    ['a building way that is not closed', [way(101, [1, 2, 3], { building: 'yes' })], 'way/101'],
  ])('%s', (_label, elements, culprit) => {
    const out = run(...elements);
    expect(out.features).toStrictEqual([]);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toContain(culprit);
  });

  it('a hole outside every outline is dropped with a warning, the outline kept', () => {
    const out = run(
      way(101, [1, 2, 3, 4, 1]),
      way(103, [15, 16, 17, 18, 15]),
      multipolygon(9, [
        [101, 'outer'],
        [103, 'inner'],
      ]),
    );
    expect(out.features.map((f) => f.geometry)).toStrictEqual([{ type: 'Polygon', coordinates: [square] }]);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toContain('relation/9');
  });
});

describe('what is kept', () => {
  it.each<[string, OsmElement, Feature['geometry']['type'] | null]>([
    [
      'a closed highway without area=yes (a roundabout) is a line',
      way(101, [1, 2, 3, 4, 1], { highway: 'primary' }),
      'LineString',
    ],
    ['building=no is dropped', way(101, [1, 2, 3, 4, 1], { building: 'no' }), null],
    ['building:part=no is dropped', way(101, [1, 2, 3, 4, 1], { 'building:part': 'no' }), null],
    ['an untagged way is dropped', way(101, [1, 2, 3, 4, 1]), null],
    ['a landuse area is dropped', way(101, [1, 2, 3, 4, 1], { landuse: 'commercial' }), null],
    ['a building:part is a polygon', way(101, [1, 2, 3, 4, 1], { 'building:part': 'yes' }), 'Polygon'],
    ['a railway=light_rail way is a line', way(101, [1, 2, 3], { railway: 'light_rail' }), 'LineString'],
    ['a traffic signal node is dropped', node(50, 0, 0, { highway: 'traffic_signals' }), null],
    ['a crossing node is a point', node(50, 0, 0, { highway: 'crossing' }), 'Point'],
    ['an entrance node is a point', node(50, 0, 0, { entrance: 'main' }), 'Point'],
    [
      'a type=building relation adds no shape of its own',
      {
        type: 'relation',
        id: 9,
        members: [{ type: 'way', ref: 1, role: 'outline' }],
        tags: { type: 'building', building: 'yes' },
      },
      null,
    ],
  ])('%s', (_label, element, geometryType) => {
    const out = run(element);
    expect(out.features.map((f) => f.geometry.type)).toStrictEqual(geometryType ? [geometryType] : []);
    expect(out.warnings).toStrictEqual([]);
  });
});

describe('incompleteRelations', () => {
  it('finds nothing when every member way is there', () => {
    expect(incompleteRelations(fixture.elements)).toStrictEqual([]);
  });

  it('finds the campus boundary when an area request cut two of its ways (as on 2026-10-20)', () => {
    const cut = fixture.elements.filter((e) => !(e.type === 'way' && [806659689, 806659690].includes(e.id)));
    expect(incompleteRelations(cut)).toStrictEqual([11126048]);
  });

  it('ignores relations the map does not keep', () => {
    const route: OsmRelation = {
      type: 'relation',
      id: 7,
      members: [{ type: 'way', ref: 999, role: '' }],
      tags: { type: 'route', route: 'bus' },
    };
    expect(incompleteRelations([route])).toStrictEqual([]);
  });
});

describe('review findings (2a): reported, not guessed', () => {
  const warnsOnly = (out: ReturnType<typeof run>, culprit: string) => {
    expect(out.features).toStrictEqual([]);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toContain(culprit);
  };

  it('two loops joined at one node are not merged into a figure 8', () => {
    const out = run(
      way(101, [1, 2, 3, 4]),
      way(102, [4, 1, 21, 22]),
      way(103, [22, 23, 1]),
      multipolygon(9, [
        [101, 'outer'],
        [102, 'outer'],
        [103, 'outer'],
      ]),
    );
    warnsOnly(out, 'relation/9');
  });

  it('a member listed twice', () => {
    warnsOnly(
      run(
        way(101, [1, 2, 3, 4, 1]),
        multipolygon(9, [
          [101, 'outer'],
          [101, 'outer'],
        ]),
      ),
      'relation/9',
    );
  });

  it('a member role other than outer, inner or empty', () => {
    warnsOnly(run(way(101, [1, 2, 3, 4, 1]), multipolygon(9, [[101, 'outline']])), 'relation/9');
  });

  it('an outline with no area (points on one line)', () => {
    warnsOnly(run(way(101, [1, 3, 53, 1], { building: 'yes' })), 'way/101');
  });

  it('a hole goes to the innermost outline that contains it, whatever the member order', () => {
    for (const order of [
      [301, 302],
      [302, 301],
    ]) {
      const out = run(
        way(301, [31, 32, 33, 34, 31]),
        way(302, [35, 36, 37, 38, 35]),
        way(303, [39, 40, 41, 42, 39]),
        multipolygon(9, [...order.map((ref): [number, string] => [ref, 'outer']), [303, 'inner']]),
      );
      const geometry = out.features[0]?.geometry;
      expect(geometry?.type).toBe('MultiPolygon');
      if (geometry?.type !== 'MultiPolygon') return;
      const withHole = geometry.coordinates.find((p) => p.length === 2);
      expect(withHole?.[0]).toContainEqual([3, 3]); // the 3..7 square, not the 0..10 one
      expect(geometry.coordinates.filter((p) => p.length === 1)).toHaveLength(1);
    }
  });

  it('an area highway mapped as a multipolygon is kept, like the same thing mapped as a way', () => {
    const plaza: OsmRelation = {
      type: 'relation',
      id: 9,
      members: [{ type: 'way', ref: 101, role: 'outer' }],
      tags: { type: 'multipolygon', highway: 'pedestrian', area: 'yes' },
    };
    const out = run(way(101, [1, 2, 3, 4, 1]), plaza);
    expect(out.features.map((f) => f.geometry)).toStrictEqual([{ type: 'Polygon', coordinates: [square] }]);
  });
});
