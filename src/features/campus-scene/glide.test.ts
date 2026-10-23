import { describe, expect, it } from 'vitest';
import { easeOut, glidePath, pointAlong } from './glide';

// An L along a walk: 10 m east, then 10 m north.
const ELL = [
  [0, 0],
  [10, 0],
  [10, 10],
] as const;

describe('glidePath', () => {
  it('follows the line from one spot to the next, round the corner', () => {
    expect(glidePath([2, 0], [10, 6], [ELL])).toStrictEqual([
      [2, 0],
      [10, 0],
      [10, 6],
    ]);
  });

  it('runs the same line backwards for Back', () => {
    expect(glidePath([10, 6], [2, 0], [ELL])).toStrictEqual([
      [10, 6],
      [10, 0],
      [2, 0],
    ]);
  });

  it('takes a spot within a metre of the line as on it, and starts and ends at the spots themselves', () => {
    expect(glidePath([2, 0.5], [10, 6], [ELL])).toStrictEqual([
      [2, 0.5],
      [10, 0],
      [10, 6],
    ]);
  });

  it('keeps no corner when both spots are on one stretch', () => {
    expect(glidePath([1, 0], [8, 0], [ELL])).toStrictEqual([
      [1, 0],
      [8, 0],
    ]);
  });

  it('goes straight when no one line has both spots', () => {
    const east = [
      [0, 0],
      [10, 0],
    ] as const;
    const north = [
      [10, 0],
      [10, 10],
    ] as const;
    expect(glidePath([2, 0], [10, 6], [east, north])).toStrictEqual([
      [2, 0],
      [10, 6],
    ]);
    expect(glidePath([2, 0], [10, 6], [])).toStrictEqual([
      [2, 0],
      [10, 6],
    ]);
  });

  it('passes a repeated corner and a zero-length stretch without losing its way', () => {
    const doubled = [
      [0, 0],
      [10, 0],
      [10, 0],
      [10, 10],
    ] as const;
    const path = glidePath([2, 0], [10, 6], [doubled]);
    expect(path).toStrictEqual([
      [2, 0],
      [10, 0],
      [10, 0],
      [10, 6],
    ]);
    // 8 m east, nothing, then 6 m north: halfway (7 m) is still on the first stretch.
    expect(pointAlong(path, 0.5)).toStrictEqual([9, 0]);
    expect(pointAlong(path, 1)).toStrictEqual([10, 6]);
  });

  it('is just the spot when the dot stays put', () => {
    expect(glidePath([3, 0], [3, 0], [ELL])).toStrictEqual([[3, 0]]);
  });
});

describe('pointAlong', () => {
  it.each([
    [0, [0, 0]],
    [0.25, [5, 0]],
    [0.5, [10, 0]],
    [0.75, [10, 5]],
    [1, [10, 10]],
  ] as const)('at %s of the length is %j', (t, at) => {
    expect(pointAlong(ELL, t)).toStrictEqual(at);
  });

  it('holds the ends outside 0..1, and a one-point path stays put', () => {
    expect(pointAlong(ELL, -1)).toStrictEqual([0, 0]);
    expect(pointAlong(ELL, 2)).toStrictEqual([10, 10]);
    expect(pointAlong([[3, 4]], 0.5)).toStrictEqual([3, 4]);
  });
});

describe('easeOut', () => {
  it('is the cut slide’s cubic ease-out, held to 0..1', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(0.5)).toBe(0.875);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(-0.5)).toBe(0);
    expect(easeOut(1.5)).toBe(1);
  });
});
