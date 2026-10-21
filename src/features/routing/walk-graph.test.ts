// The walk network as a graph of costs (D34) and the cheapest walk over it. Seconds are worked by hand: 100 m at
// 1.3 m/s is 76.92 s; a street counts ×1.5 when choosing (115.38 s) but not in the time shown.
import { describe, expect, it } from 'vitest';
import type { XY } from '@/shared/data/route';
import { type Seg, walkOf } from './fixture';
import { buildWalkGraph, cheapestWalk, crossingWaits } from './walk-graph';

const graphOf = (segs: readonly Seg[]) => {
  const { walk, point } = walkOf(segs);
  return { g: buildWalkGraph(walk), point, walk };
};
const xy = (g: ReturnType<typeof buildWalkGraph>, points: readonly number[]): XY[] => points.map((p) => g.at(p));

describe('link costs', () => {
  it.each([
    ['path', 76.92, 76.92],
    ['sidewalk', 76.92, 76.92],
    ['door', 76.92, 76.92],
    ['crossing', 76.92, 76.92],
    ['street', 115.38, 76.92],
    ['steps', 92.31, 76.92],
  ] as const)('a 100 m %s costs %f s to choose and shows %f s', (kind, cost, seconds) => {
    const { g, point } = graphOf([[[0, 0], [100, 0], kind]]);
    const link = g.link(point([0, 0]), point([100, 0]));
    expect(link?.meters).toBe(100);
    expect(link?.cost).toBeCloseTo(cost, 2);
    expect(link?.seconds).toBeCloseTo(seconds, 2);
  });

  it('is the same both ways', () => {
    const { g, point } = graphOf([[[0, 0], [30, 40], 'street']]);
    expect(g.link(point([30, 40]), point([0, 0]))).toStrictEqual(g.link(point([0, 0]), point([30, 40])));
  });

  it('keeps the cheaper of two links between the same points', () => {
    const { g, point } = graphOf([
      [[0, 0], [100, 0], 'street'],
      [[0, 0], [100, 0], 'path'],
    ]);
    expect(g.link(point([0, 0]), point([100, 0]))?.cost).toBeCloseTo(76.92, 2);
  });
});

// Taft's two sidewalks meet only at crossings (D32). West side x = 0, east side x = 30.
const sidewalks: Seg[] = [
  [[0, 0], [0, 25], 'sidewalk'],
  [[0, 25], [0, 50], 'sidewalk'],
  [[30, 0], [30, 25], 'sidewalk'],
  [[30, 25], [30, 50], 'sidewalk'],
];

describe('crossingWaits (45 s per crossing of Taft, D34)', () => {
  it('puts 45 s on a crossing drawn as one link from sidewalk to sidewalk', () => {
    const { walk } = walkOf([...sidewalks, [[0, 25], [30, 25], 'crossing', 'Taft Avenue']]);
    expect([...crossingWaits(walk)]).toStrictEqual([[4, 45]]);
  });

  it('splits it over a crossing drawn in pieces through a median, so the whole crossing still waits 45 s', () => {
    const { walk } = walkOf([
      ...sidewalks,
      [[0, 25], [15, 25], 'crossing', 'Taft Avenue'],
      [[15, 25], [30, 25], 'crossing', 'Taft Avenue'],
    ]);
    expect([...crossingWaits(walk)]).toStrictEqual([
      [4, 22.5],
      [5, 22.5],
    ]);
  });

  it('puts nothing on a crossing-tagged footway that leaves one sidewalk without reaching the other', () => {
    const { walk } = walkOf([...sidewalks, [[30, 0], [40, 0], 'crossing', 'Taft Avenue']]);
    expect(crossingWaits(walk).size).toBe(0);
  });

  it('puts nothing on a small street’s crossing (Dagonoy)', () => {
    const { walk } = walkOf([...sidewalks, [[0, 25], [30, 25], 'crossing', 'Dagonoy Street']]);
    expect(crossingWaits(walk).size).toBe(0);
  });

  it('adds the wait to both the cost and the time shown', () => {
    const { g, point } = graphOf([...sidewalks, [[0, 25], [30, 25], 'crossing', 'Taft Avenue']]);
    const link = g.link(point([0, 25]), point([30, 25]));
    expect(link?.cost).toBeCloseTo(30 / 1.3 + 45, 6);
    expect(link?.seconds).toBeCloseTo(30 / 1.3 + 45, 6);
  });
});

describe('cheapestWalk', () => {
  it('takes a longer path over a shorter street when the street costs more (×1.5)', () => {
    const { g, point } = graphOf([
      [[0, 0], [100, 0], 'street'],
      [[0, 0], [50, 30], 'path'],
      [[50, 30], [100, 0], 'path'],
    ]);
    const walk = cheapestWalk(g, [point([0, 0])], [point([100, 0])]);
    expect(xy(g, walk?.points ?? [])).toStrictEqual([
      [0, 0],
      [50, 30],
      [100, 0],
    ]);
    expect(walk?.meters).toBeCloseTo(116.62, 2);
    expect(walk?.seconds).toBeCloseTo(89.71, 2);
  });

  it('takes the street when the path round it costs more, and shows real walking time', () => {
    const { g, point } = graphOf([
      [[0, 0], [100, 0], 'street'],
      [[0, 0], [50, 60], 'path'],
      [[50, 60], [100, 0], 'path'],
    ]);
    const walk = cheapestWalk(g, [point([0, 0])], [point([100, 0])]);
    expect(walk?.points).toStrictEqual([point([0, 0]), point([100, 0])]);
    expect(walk?.meters).toBe(100);
    expect(walk?.seconds).toBeCloseTo(76.92, 2);
  });

  it.each([
    ['takes a 116.6 m path (89.7 s) over 100 m of steps (×1.2: 92.3 s)', 30, 'path'],
    ['takes 100 m of steps (92.3 s) over a 128.1 m path (98.5 s)', 40, 'steps'],
  ] as const)('%s', (_label, detourY, chosen) => {
    const { g, point } = graphOf([
      [[0, 0], [100, 0], 'steps'],
      [[0, 0], [50, detourY], 'path'],
      [[50, detourY], [100, 0], 'path'],
    ]);
    const walk = cheapestWalk(g, [point([0, 0])], [point([100, 0])]);
    expect(walk?.points.length).toBe(chosen === 'steps' ? 2 : 3);
  });

  it('crosses Taft once and counts its 45 s, but not the footway past the curb', () => {
    const { g, point } = graphOf([
      ...sidewalks,
      [[0, 25], [30, 25], 'crossing', 'Taft Avenue'],
      [[30, 0], [40, 0], 'crossing', 'Taft Avenue'],
    ]);
    const walk = cheapestWalk(g, [point([0, 0])], [point([40, 0])]);
    expect(xy(g, walk?.points ?? [])).toStrictEqual([
      [0, 0],
      [0, 25],
      [30, 25],
      [30, 0],
      [40, 0],
    ]);
    expect(walk?.meters).toBe(90);
    expect(walk?.seconds).toBeCloseTo(90 / 1.3 + 45, 6);
  });

  it('picks the cheapest of several starts and targets, path first point at the start', () => {
    const { g, point } = graphOf([
      [[0, 0], [100, 0], 'path'],
      [[100, 0], [200, 0], 'path'],
      [[200, 0], [300, 0], 'path'],
    ]);
    const walk = cheapestWalk(g, [point([0, 0]), point([100, 0])], [point([300, 0]), point([200, 0])]);
    expect(walk?.points).toStrictEqual([point([100, 0]), point([200, 0])]);
    expect(walk?.meters).toBe(100);
  });

  it('is a single point when a start is a target', () => {
    const { g, point } = graphOf([[[0, 0], [100, 0], 'path']]);
    expect(cheapestWalk(g, [point([0, 0])], [point([0, 0])])).toStrictEqual({
      points: [point([0, 0])],
      meters: 0,
      seconds: 0,
    });
  });

  it('is null when nothing joins them, or there is no start or no target', () => {
    const { g, point } = graphOf([
      [[0, 0], [100, 0], 'path'],
      [[500, 0], [600, 0], 'path'],
    ]);
    expect(cheapestWalk(g, [point([0, 0])], [point([600, 0])])).toBeNull();
    expect(cheapestWalk(g, [], [point([600, 0])])).toBeNull();
    expect(cheapestWalk(g, [point([0, 0])], [])).toBeNull();
  });
});
