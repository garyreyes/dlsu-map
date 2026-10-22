import { describe, expect, it } from 'vitest';
import type { Frame } from '../../scripts/compile/fit.ts';
import { fitPoint } from '../../scripts/compile/fit.ts';
import { farFromWalls, signPointOf } from './far.ts';

/** A sign stretched onto a 10 × 4 m box, turned a little, with its top-left at (2, 1). */
const frame: Frame = { tl: [2, 1], tr: [11.9, 2.4], br: [11.3, -1.6], bl: [1.4, -3] };

describe('signPointOf', () => {
  it('undoes fitPoint anywhere on and past the sign', () => {
    for (const [x, y] of [
      [0, 0],
      [1, 1],
      [0.3, 0.7],
      [-0.05, 1.08],
    ] as const) {
      const [sx, sy] = signPointOf(frame, fitPoint(frame, x, y));
      expect(sx).toBeCloseTo(x, 6);
      expect(sy).toBeCloseTo(y, 6);
    }
  });
});

describe('farFromWalls', () => {
  /** A 10 × 4 m outline with walls on three sides; the side x = 10 has none. */
  const ring = [
    [0, 0],
    [10, 0],
    [10, 4],
    [0, 4],
  ] as const;
  const square: Frame = { tl: [0, 4], tr: [10, 4], br: [10, 0], bl: [0, 0] };
  const walls = [
    [0, 0, 1, 0],
    [0, 1, 1, 1],
    [0, 0, 0, 1],
  ];

  it('gives the outline points further than the limit from every wall, on the sign, with their distance', () => {
    const far = farFromWalls(ring, square, walls, 1);
    // Every 0.5 m up the bare side x = 10 lies on the sign's right edge, x = 1. Only y 1.5, 2 and 2.5 m are more
    // than 1 m from the top and bottom walls; the sign's y runs down from the top, so they are 0.625, 0.5, 0.375.
    expect(far.map((p) => [p.x, p.y])).toStrictEqual([
      [1, 0.625],
      [1, 0.5],
      [1, 0.375],
    ]);
    expect(far.map((p) => p.meters)).toStrictEqual([1.5, 2, 1.5]);
  });

  it('gives nothing when every wall is drawn', () => {
    expect(farFromWalls(ring, square, [...walls, [1, 0, 1, 1]], 1)).toStrictEqual([]);
  });
});
