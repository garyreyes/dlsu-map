// The drone view's maths (D61) has one right answer each: which way is up, and how far the walk reaches from the dot. A
// sign slip would turn the walk down the screen, or fit the wrong side of it, and still look plausible. Exact values.
import { describe, expect, it } from 'vitest';
import type { XY } from '@/shared/data/route';
import { boxAround, reachFrom, tripAzimuth } from './drone';

const EAST_UP = -Math.PI / 2;
const NORTH_UP = 0;
const NORTH_EAST_UP = -Math.PI / 4;

/** Compares headings the short way round, so -π and π count as the same. */
const closeAngle = (actual: number | null, expected: number, within = 1e-9) => {
  expect(actual).not.toBeNull();
  const d = (actual ?? NaN) - expected;
  expect(Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))).toBeLessThan(within);
};

describe('reachFrom', () => {
  it('measures points due north along the screen when north is up', () => {
    const r = reachFrom([[10, 50]], [10, 20], NORTH_UP);
    expect(r.along).toBeCloseTo(30, 9);
    expect(r.across).toBeCloseTo(0, 9);
  });

  it('measures the same points across the screen when east is up', () => {
    const r = reachFrom([[10, 50]], [10, 20], EAST_UP);
    expect(r.across).toBeCloseTo(30, 9);
    expect(r.along).toBeCloseTo(0, 9);
  });

  it('counts points behind the dot as well, since the dot is in the middle', () => {
    const r = reachFrom([[10, 0]], [10, 20], NORTH_UP);
    expect(r.along).toBeCloseTo(20, 9);
    expect(r.across).toBeCloseTo(0, 9);
  });

  it('takes the most either way, left or right, up or down', () => {
    const r = reachFrom(
      [
        [13, 24],
        [7, 15],
      ],
      [10, 20],
      NORTH_UP,
    );
    expect(r.across).toBeCloseTo(3, 9);
    expect(r.along).toBeCloseTo(5, 9);
  });

  it('is zero both ways with no points', () => {
    expect(reachFrom([], [10, 20], 1)).toEqual({ across: 0, along: 0 });
  });
});

describe('boxAround', () => {
  it('is the plain bounding box when north is up', () => {
    const box = boxAround(
      [
        [0, 0],
        [10, 4],
        [4, -2],
      ],
      NORTH_UP,
    );
    expect(box?.centre[0]).toBeCloseTo(5, 9);
    expect(box?.centre[1]).toBeCloseTo(1, 9);
    expect(box?.across).toBeCloseTo(5, 9);
    expect(box?.along).toBeCloseTo(3, 9);
  });

  it('is the box in the turned screen, centred where that box is on the ground', () => {
    // Facing north-east, the hypotenuse of this triangle runs across the screen: 2 × 7.07 m wide, 7.07 m tall.
    const pts: XY[] = [
      [0, 0],
      [10, 0],
      [0, 10],
    ];
    const box = boxAround(pts, NORTH_EAST_UP);
    expect(box?.across).toBeCloseTo(Math.SQRT2 * 5, 9);
    expect(box?.along).toBeCloseTo(Math.SQRT2 * 2.5, 9);
    expect(box?.centre[0]).toBeCloseTo(2.5, 9);
    expect(box?.centre[1]).toBeCloseTo(2.5, 9);
  });

  it('is a point for a single point', () => {
    const box = boxAround([[3, 4]], 1.234);
    expect(box?.centre[0]).toBeCloseTo(3, 9);
    expect(box?.centre[1]).toBeCloseTo(4, 9);
    expect(box?.across).toBeCloseTo(0, 9);
    expect(box?.along).toBeCloseTo(0, 9);
  });

  it('is null with no points', () => {
    expect(boxAround([], 0)).toBeNull();
  });
});

describe('tripAzimuth', () => {
  const southToNorth: XY[] = [
    [0, 0],
    [3, 100],
    [0, 200],
  ];

  it('puts the end at the top: a north-south route walked south to north keeps north up', () => {
    closeAngle(tripAzimuth(southToNorth, 0), 0);
  });

  it('turns the map over for the same route walked north to south', () => {
    closeAngle(tripAzimuth([...southToNorth].reverse(), 0), Math.PI);
  });

  it('runs an east-west route up the screen, from the start at the bottom', () => {
    const westToEast: XY[] = [
      [0, 0],
      [100, 4],
      [200, 0],
    ];
    closeAngle(tripAzimuth(westToEast, 0), EAST_UP);
    closeAngle(tripAzimuth([...westToEast].reverse(), 0), Math.PI / 2);
  });

  it('runs a diagonal route up the screen along its length', () => {
    closeAngle(
      tripAzimuth(
        [
          [0, 0],
          [50, 50],
          [100, 100],
        ],
        0,
      ),
      NORTH_EAST_UP,
    );
  });

  it('uses the long axis, not the first and last points, when a route has a clear long side', () => {
    // Out 200 m north, then 30 m east: weighed by length, the long side leans 2.4° east of north (first → last would
    // lean 8.5°). Worked by hand from the stretches' moments: sxx 8119.6, syy 927565, sxy 39123.
    const bent: XY[] = [
      [0, 0],
      [0, 100],
      [0, 200],
      [30, 200],
    ];
    expect(tripAzimuth(bent, 0)).toBeCloseTo(-0.0425, 3);
  });

  it('weighs the walk by its length, not by how many points draw it', () => {
    // 300 m east in one stretch, then 80 m north drawn with 41 points. Extra points along a straight stretch change
    // nothing about the walk, so they mustn't change the heading either (unweighted, they pull it 59° off).
    const sparse: XY[] = [
      [0, 0],
      [300, 0],
      [300, 80],
    ];
    const dense: XY[] = [[0, 0], ...Array.from({ length: 41 }, (_, i): XY => [300, i * 2])];
    const heading = tripAzimuth(sparse, 0);
    expect(heading).not.toBeNull();
    closeAngle(tripAzimuth(dense, 0), heading ?? 0, 1e-9);
  });

  it('falls back to the first-to-last direction when there is no clear long side', () => {
    // A square walked round three sides: both spreads are equal, so start → end (east) decides.
    const square: XY[] = [
      [0, 10],
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    closeAngle(tripAzimuth(square, 0), EAST_UP);
  });

  it('answers the short way round from the current heading', () => {
    expect(tripAzimuth(southToNorth, 2 * Math.PI)).toBeCloseTo(2 * Math.PI, 9);
    expect(tripAzimuth([...southToNorth].reverse(), 0.1)).toBeCloseTo(Math.PI, 9);
    expect(tripAzimuth([...southToNorth].reverse(), -3)).toBeCloseTo(-Math.PI, 9);
  });

  it('is null with fewer than two distinct points', () => {
    expect(tripAzimuth([], 0)).toBeNull();
    expect(tripAzimuth([[1, 1]], 0)).toBeNull();
    expect(
      tripAzimuth(
        [
          [1, 1],
          [1, 1],
        ],
        0,
      ),
    ).toBeNull();
  });

  it('is null for a square walked back to its start, which points nowhere', () => {
    expect(
      tripAzimuth(
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        0,
      ),
    ).toBeNull();
  });
});
