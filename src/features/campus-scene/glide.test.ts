import { describe, expect, it } from 'vitest';
import { climbPath, easeOut, glidePath, levelPath, pointAlong } from './glide';

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

describe('levelPath', () => {
  it('follows the line, its height changing evenly by length (a door on the ground to a spot on G)', () => {
    // 8 m east then 6 m north: the corner is 8/14 of the way, so its height is 8 of 14.
    expect(levelPath([2, 0, 0], [10, 6, 14], [ELL])).toStrictEqual([
      [2, 0, 0],
      [10, 0, 8],
      [10, 6, 14],
    ]);
  });

  it('keeps the height on one floor, and is just the spot when the dot stays put', () => {
    expect(levelPath([1, 0, 7], [8, 0, 7], [ELL])).toStrictEqual([
      [1, 0, 7],
      [8, 0, 7],
    ]);
    expect(levelPath([3, 0, 7], [3, 0, 7], [ELL])).toStrictEqual([[3, 0, 7]]);
  });
});

describe('climbPath', () => {
  // The new floor's hallway from the stairs (0, 0) to a room at (10, 5), 7 m up.
  const HALL = [
    [0, 0],
    [10, 0],
    [10, 5],
  ] as const;

  it('on Next rises at the stairs, then walks the new floor’s line', () => {
    expect(climbPath([0, 0, 0], [10, 5, 7], [], [HALL])).toStrictEqual([
      [0, 0, 0],
      [0, 0, 7],
      [10, 0, 7],
      [10, 5, 7],
    ]);
  });

  it('on Back walks the old floor’s line to the stairs, then drops', () => {
    expect(climbPath([10, 5, 7], [0, 0, 0], [HALL], [])).toStrictEqual([
      [10, 5, 7],
      [10, 0, 7],
      [0, 0, 7],
      [0, 0, 0],
    ]);
  });

  it('finds the new floor’s line from stairs traced up to 8 m away on the floor below', () => {
    // Each floor's stairs were traced on their own: St. Joseph's sit up to 6.6 m apart from floor to floor.
    expect(climbPath([-5, 0, 0], [10, 5, 7], [], [HALL])).toStrictEqual([
      [-5, 0, 0],
      [-5, 0, 7],
      [10, 0, 7],
      [10, 5, 7],
    ]);
    expect(climbPath([10, 5, 7], [-5, 0, 0], [HALL], [])).toStrictEqual([
      [10, 5, 7],
      [10, 0, 7],
      [-5, 0, 7],
      [-5, 0, 0],
    ]);
    expect(climbPath([-9, 0, 0], [10, 5, 7], [], [HALL])).toStrictEqual([
      [-9, 0, 0],
      [-9, 0, 7],
      [10, 5, 7],
    ]);
  });

  it('rises, then goes straight, when neither floor has a line through both spots', () => {
    expect(climbPath([0, 0, 0], [3, 4, 7], [], [])).toStrictEqual([
      [0, 0, 0],
      [0, 0, 7],
      [3, 4, 7],
    ]);
  });

  it('is measured with its climb, so pointAlong rises before it walks', () => {
    // 7 m up, then 10 m and 5 m along: 22 m in all, so halfway (11 m) is 4 m along the hallway.
    expect(pointAlong(climbPath([0, 0, 0], [10, 5, 7], [], [HALL]), 0.5)).toStrictEqual([4, 0, 7]);
  });
});
