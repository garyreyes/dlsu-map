// buildNetwork on small made-up maps, drawn in meters so every point can be checked by hand. A wrong rule here sends a
// student across Taft mid-block or leaves a building unreachable, and the output looks the same either way.
import { describe, expect, it } from 'vitest';
import { projection } from '../../src/shared/geo/project.ts';
import type { Feature, Tags } from '../osm-to-geojson.ts';
import { ORIGIN } from './campus.ts';
import { buildNetwork, components, keepLargest, type Network } from './walk.ts';

type Pt = [number, number];
const { toLonLat, toMeters } = projection(ORIGIN);
const extent = { minX: -500, minY: -500, maxX: 500, maxY: 500 };

const line = (id: string, tags: Tags, points: Pt[]): Feature => ({
  type: 'Feature',
  id,
  properties: { tags },
  geometry: { type: 'LineString', coordinates: points.map(toLonLat) },
});
const node = (id: string, tags: Tags, [x, y]: Pt): Feature => ({
  type: 'Feature',
  id,
  properties: { tags },
  geometry: { type: 'Point', coordinates: toLonLat([x, y]) },
});
const build = (...features: Feature[]) => buildNetwork(features, toMeters, extent);

/** The index of the point at x, y (to 1 cm), or -1. */
const at = (n: Network, [x, y]: Pt) =>
  n.points.findIndex((p) => Math.abs(p[0] - x) < 0.01 && Math.abs(p[1] - y) < 0.01);
/** Whether two points are joined by any chain of links. */
const joined = (n: Network, a: Pt, b: Pt) => {
  const comp = components(n);
  const [i, j] = [at(n, a), at(n, b)];
  return i >= 0 && j >= 0 && comp[i] === comp[j];
};
/** The way of the link between two points, either way round, or -1. */
const linkWay = (n: Network, p: Pt, q: Pt) => {
  const [i, j] = [at(n, p), at(n, q)];
  return n.links.find(([a, b]) => (a === i && b === j) || (a === j && b === i))?.[2] ?? -1;
};
const rounded = (n: Network) => n.points.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);

describe('buildNetwork: ways', () => {
  it('joins two footways where they share a point: 3 points, 2 links', () => {
    const { network } = build(
      line('way/1', { highway: 'footway' }, [
        [0, 0],
        [10, 0],
      ]),
      line('way/2', { highway: 'footway' }, [
        [10, 0],
        [10, 10],
      ]),
    );
    expect(rounded(network)).toStrictEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(network.links).toStrictEqual([
      [0, 1, 0],
      [1, 2, 0],
    ]);
    expect(network.ways).toStrictEqual([{ kind: 'path' }]);
  });

  it('keeps one link when two ways share a stretch', () => {
    const seg: Pt[] = [
      [0, 0],
      [10, 0],
    ];
    const { network } = build(line('way/1', { highway: 'footway' }, seg), line('way/2', { highway: 'footway' }, seg));
    expect(network.links).toHaveLength(1);
  });

  it('gives every walkable way its kind, name and cover, and shares one entry per kind of way', () => {
    const { network } = build(
      line('way/1', { highway: 'footway', covered: 'yes', name: 'SJ Walk' }, [
        [0, 0],
        [10, 0],
      ]),
      line('way/2', { highway: 'steps' }, [
        [10, 0],
        [20, 0],
      ]),
      line('way/3', { highway: 'service' }, [
        [20, 0],
        [30, 0],
      ]),
      line('way/4', { highway: 'residential', name: 'Fidel A. Reyes Street' }, [
        [30, 0],
        [30, 20],
        [30, 40],
      ]),
      line('way/5', { highway: 'footway', footway: 'crossing' }, [
        [20, 20],
        [30, 20],
        [40, 20],
      ]),
      line('way/6', { highway: 'pedestrian', name: 'Kalayaan Street' }, [
        [40, 20],
        [50, 20],
      ]),
      line('way/7', { highway: 'path' }, [
        [50, 20],
        [60, 20],
      ]),
      line('way/8', { highway: 'footway' }, [
        [60, 20],
        [70, 20],
      ]),
    );
    expect(network.ways).toStrictEqual([
      { kind: 'path', name: 'SJ Walk', covered: true },
      { kind: 'steps' },
      { kind: 'street' },
      { kind: 'street', name: 'Fidel A. Reyes Street' },
      { kind: 'crossing', name: 'Fidel A. Reyes Street' },
      { kind: 'path', name: 'Kalayaan Street' },
      { kind: 'path' },
    ]);
    // way/7 (path) and way/8 (footway) share the plain `path` entry.
    expect(network.links.filter((l) => l[2] === 6)).toHaveLength(2);
  });

  it.each<[string, Tags]>([
    ['a main road that is not Taft', { highway: 'secondary', name: 'Pablo Ocampo Street' }],
    ['the LRT', { railway: 'light_rail' }],
    ['a footway closed to walkers', { highway: 'footway', foot: 'no' }],
    ['a service road with no access', { highway: 'service', access: 'no' }],
    ['a building outline drawn as a line', { building: 'yes' }],
  ])('leaves out %s', (_label, tags) => {
    const { network } = build(
      line('way/1', tags, [
        [0, 0],
        [10, 0],
      ]),
    );
    expect(network.points).toStrictEqual([]);
    expect(network.links).toStrictEqual([]);
  });

  it('keeps a service road with no access when walkers are allowed', () => {
    const { network } = build(
      line('way/1', { highway: 'service', access: 'no', foot: 'yes' }, [
        [0, 0],
        [10, 0],
      ]),
    );
    expect(network.links).toHaveLength(1);
  });

  it('keeps a stretch reaching out of the map, and drops one wholly outside it', () => {
    const { network } = build(
      line('way/1', { highway: 'footway' }, [
        [490, 0],
        [520, 0],
        [560, 0],
      ]),
    );
    expect(rounded(network)).toStrictEqual([
      [490, 0],
      [520, 0],
    ]);
  });
});

const area = (id: string, tags: Tags, ring: Pt[]): Feature => ({
  type: 'Feature',
  id,
  properties: { tags },
  geometry: { type: 'Polygon', coordinates: [[...ring, ring[0] as Pt].map(toLonLat)] },
});

describe('buildNetwork: squares (pedestrian areas like Central Plaza)', () => {
  const into = line('way/1', { highway: 'footway' }, [
    [-10, 10],
    [0, 10],
  ]);
  const outOf = line('way/2', { highway: 'footway' }, [
    [20, 10],
    [30, 10],
  ]);

  it('walks straight across between the paths that reach it, and around its edge', () => {
    const plaza = area('way/9', { highway: 'pedestrian', area: 'yes', name: 'Central Plaza' }, [
      [0, 0],
      [20, 0],
      [20, 10],
      [20, 20],
      [0, 20],
      [0, 10],
    ]);
    const { network } = build(into, outOf, plaza);
    const across = network.ways.findIndex((w) => w.name === 'Central Plaza');
    expect(network.ways[across]).toStrictEqual({ kind: 'path', name: 'Central Plaza' });
    expect(linkWay(network, [0, 10], [20, 10])).toBe(across);
    // The 6 edges, plus the one link across.
    expect(network.links.filter((l) => l[2] === across)).toHaveLength(7);
  });

  it('does not cut across where a straight line would leave the square', () => {
    // An L: the two entries can't see each other across the missing corner.
    const plaza = area('way/9', { highway: 'pedestrian', name: 'L Plaza' }, [
      [0, 0],
      [10, 0],
      [10, 10],
      [20, 10],
      [20, 20],
      [0, 20],
    ]);
    const entry = line('way/1', { highway: 'footway' }, [
      [10, -10],
      [10, 0],
    ]);
    const exit = line('way/2', { highway: 'footway' }, [
      [30, 10],
      [20, 10],
    ]);
    const { network } = build(entry, exit, plaza);
    expect(linkWay(network, [10, 0], [20, 10])).toBe(-1);
    expect(joined(network, [10, -10], [30, 10])).toBe(true); // still joined, around the edge
  });
});

// Taft as OSM maps it here: two one-way carriageways, each with `sidewalk=right`, the LRT between them. The
// southbound one runs down x = 0, so its right is west; the northbound one runs up x = 16, so its right is east.
// 4 lanes → each sidewalk 4 × 3.2 / 2 + 1.5 = 7.9 m out from its carriageway's centre line.
const taftSouth = line('way/100', { highway: 'primary', name: 'Taft Avenue', lanes: '4', sidewalk: 'right' }, [
  [0, 100],
  [0, 50],
  [0, 0],
  [0, -50],
  [0, -100],
]);
const taftNorth = line('way/101', { highway: 'primary', name: 'Taft Avenue', lanes: '4', sidewalk: 'right' }, [
  [16, -100],
  [16, -50],
  [16, 0],
  [16, 50],
  [16, 100],
]);
const westPath = line('way/1', { highway: 'footway' }, [
  [-30, 0],
  [0, 0],
]);
const eastPath = line('way/2', { highway: 'footway' }, [
  [40, 0],
  [16, 0],
]);
const crosswalk = line('way/3', { highway: 'footway', footway: 'crossing' }, [
  [0, 50],
  [8, 50],
  [16, 50],
]);
const west: Pt = [-30, 0];
const east: Pt = [40, 0];

describe('buildNetwork: Taft sidewalks (D31)', () => {
  it('draws each sidewalk 7.9 m out on its own side, named Taft Avenue', () => {
    const { network } = build(taftSouth, taftNorth);
    expect(at(network, [-7.9, 100])).toBeGreaterThanOrEqual(0);
    expect(at(network, [-7.9, -100])).toBeGreaterThanOrEqual(0);
    expect(at(network, [23.9, -100])).toBeGreaterThanOrEqual(0);
    expect(at(network, [23.9, 100])).toBeGreaterThanOrEqual(0);
    expect(network.ways).toStrictEqual([{ kind: 'sidewalk', name: 'Taft Avenue' }]);
    // 4 stretches on each side; nothing along the carriageways themselves.
    expect(network.links).toHaveLength(8);
    expect(at(network, [0, 0])).toBe(-1);
  });

  it('joins a path meeting the carriageway to the sidewalk on its own side', () => {
    const { network } = build(taftSouth, taftNorth, westPath, eastPath);
    const w = at(network, [-7.9, 0]);
    const e = at(network, [23.9, 0]);
    expect(network.links).toContainEqual([at(network, west), w, expect.any(Number) as number]);
    expect(network.links).toContainEqual([at(network, east), e, expect.any(Number) as number]);
  });

  it('never joins the two sides without a crosswalk', () => {
    const { network } = build(taftSouth, taftNorth, westPath, eastPath);
    expect(joined(network, west, east)).toBe(false);
  });

  it('joins them over a crosswalk, from sidewalk to sidewalk, named for Taft', () => {
    const { network } = build(taftSouth, taftNorth, westPath, eastPath, crosswalk);
    expect(joined(network, west, east)).toBe(true);
    const crossing = network.ways.findIndex((w) => w.kind === 'crossing');
    expect(network.ways[crossing]).toStrictEqual({ kind: 'crossing', name: 'Taft Avenue' });
    const ends = network.links.filter((l) => l[2] === crossing).flatMap(([a, b]) => [a, b]);
    expect(new Set(ends)).toStrictEqual(
      new Set([at(network, [-7.9, 50]), at(network, [8, 50]), at(network, [23.9, 50])]),
    );
  });

  it('crosses only on crosswalk links: no other link has its ends on opposite sides', () => {
    const { network } = build(taftSouth, taftNorth, westPath, eastPath, crosswalk);
    const crossing = network.ways.findIndex((w) => w.kind === 'crossing');
    const across = network.links.filter(([a, b]) => {
      const [xa, xb] = [network.points[a]?.[0] ?? 0, network.points[b]?.[0] ?? 0];
      return (xa < 0 && xb > 0) || (xa > 0 && xb < 0) || (xa < 16 && xb > 16) || (xa > 16 && xb < 16);
    });
    expect(across.every((l) => l[2] === crossing)).toBe(true);
    expect(across).toHaveLength(2);
  });

  it('does not let a street running straight over Taft join the sides', () => {
    const street = line('way/4', { highway: 'residential', name: 'Castro Street' }, [
      [-30, -50],
      [0, -50],
      [16, -50],
      [40, -50],
    ]);
    const { network, notes } = build(taftSouth, taftNorth, street);
    expect(joined(network, [-30, -50], [40, -50])).toBe(false);
    expect(joined(network, [-30, -50], [-7.9, -50])).toBe(true);
    expect(joined(network, [40, -50], [23.9, -50])).toBe(true);
    expect(notes).toStrictEqual([]); // the stretch between the carriageways is road, not a path left stranded
  });

  it('joins both sidewalks where a crosswalk passes over a two-sided street, not only to its own side', () => {
    const twoWay = line('way/102', { highway: 'primary', name: 'Taft Avenue', lanes: '2', sidewalk: 'both' }, [
      [0, -50],
      [0, 0],
      [0, 50],
    ]);
    const over = line('way/6', { highway: 'footway', footway: 'crossing' }, [
      [-10, 0],
      [0, 0],
      [10, 0],
    ]);
    const { network } = build(twoWay, over);
    expect(joined(network, [-10, 0], [10, 0])).toBe(true);
    const crossing = network.ways.findIndex((w) => w.kind === 'crossing');
    expect(network.links).toContainEqual([at(network, [-4.7, 0]), at(network, [4.7, 0]), crossing]);
  });

  it('joins a crosswalk that starts off the road to the sidewalk on its own side first', () => {
    // As way/676717186: from beside the northbound carriageway, over it, then over the southbound one.
    const over = line('way/7', { highway: 'footway', footway: 'crossing' }, [
      [30, -50],
      [16, -50],
      [0, -50],
    ]);
    const { network } = build(taftSouth, taftNorth, over);
    expect(joined(network, [30, -50], [-7.9, -50])).toBe(true);
    expect(network.links).toContainEqual([at(network, [30, -50]), at(network, [23.9, -50]), 1]);
  });

  it('drops a path that meets a carriageway on its side with no sidewalk, and says so', () => {
    const median = line('way/5', { highway: 'service' }, [
      [8, 0],
      [0, 0],
    ]);
    const { network, notes } = build(taftSouth, taftNorth, median);
    expect(at(network, [8, 0])).toBe(-1);
    expect(notes).toContain('walk: 1 stretch meets Taft Avenue where it has no sidewalk (way/5)');
  });

  it('joins both sidewalks of a two-way street at a crossing point', () => {
    const twoWay = line('way/102', { highway: 'primary', name: 'Taft Avenue', lanes: '2', sidewalk: 'both' }, [
      [0, -50],
      [0, 0],
      [0, 50],
    ]);
    // 2 lanes → 2 × 3.2 / 2 + 1.5 = 4.7 m.
    const { network } = build(twoWay, node('node/1', { highway: 'crossing' }, [0, 0]));
    expect(joined(network, [-4.7, 50], [4.7, -50])).toBe(true);
    const crossing = network.ways.findIndex((w) => w.kind === 'crossing');
    expect(network.links.filter((l) => l[2] === crossing)).toStrictEqual([
      [at(network, [-4.7, 0]), at(network, [4.7, 0]), crossing],
    ]);
  });

  it('keeps a bend in the sidewalk 7.9 m from both stretches of the carriageway', () => {
    const bend = line('way/103', { highway: 'primary', name: 'Taft Avenue', lanes: '4', sidewalk: 'right' }, [
      [0, 100],
      [0, 0],
      [100, 0],
    ]);
    // Heading south, then east: the right side is west, then south. The corner sits on the outside of the bend.
    const { network } = build(bend);
    expect(at(network, [-7.9, -7.9])).toBeGreaterThanOrEqual(0);
  });

  it('carries a sidewalk on over the join of two pieces of a street, even one drawn the other way', () => {
    const north = line('way/105', { highway: 'primary', name: 'Taft Avenue', lanes: '4', sidewalk: 'right' }, [
      [0, 100],
      [0, 0],
    ]);
    // Drawn northward, so its sidewalk is on its left to be on the same (west) side.
    const south = line('way/106', { highway: 'primary', name: 'Taft Avenue', lanes: '4', sidewalk: 'left' }, [
      [0, -100],
      [0, 0],
    ]);
    const { network } = build(north, south);
    expect(rounded(network)).toStrictEqual([
      [-7.9, 100],
      [-7.9, 0],
      [-7.9, -100],
    ]);
    expect(network.links).toHaveLength(2);
  });

  it('uses a width tag over lanes', () => {
    const wide = line('way/104', { highway: 'primary', name: 'Taft Avenue', width: '10', sidewalk: 'left' }, [
      [0, 0],
      [0, 50],
    ]);
    // Heading north, left is west: 10 / 2 + 1.5 = 6.5 m.
    const { network } = build(wide);
    expect(at(network, [-6.5, 0])).toBeGreaterThanOrEqual(0);
  });
});

describe('keepLargest', () => {
  it('keeps the biggest piece and says how much it dropped', () => {
    const { network } = build(
      line('way/1', { highway: 'footway' }, [
        [0, 0],
        [10, 0],
        [20, 0],
      ]),
      line('way/2', { highway: 'footway' }, [
        [100, 100],
        [110, 100],
      ]),
    );
    const kept = keepLargest(network);
    expect(rounded(kept.network)).toStrictEqual([
      [0, 0],
      [10, 0],
      [20, 0],
    ]);
    expect(kept.network.links).toStrictEqual([
      [0, 1, 0],
      [1, 2, 0],
    ]);
    expect(kept.note).toBe('walk: dropped 1 piece not joined to the rest (2 points)');
    expect(kept.dropped.map((piece) => piece.map(([x, y]) => [Math.round(x), Math.round(y)]))).toStrictEqual([
      [
        [100, 100],
        [110, 100],
      ],
    ]);
  });

  it('keeps the node ids of the points it keeps, so gates can find theirs', () => {
    const { network } = build(
      line('way/1', { highway: 'footway' }, [
        [0, 0],
        [10, 0],
      ]),
    );
    expect(keepLargest(network).network.keys).toStrictEqual(network.keys);
  });
});
