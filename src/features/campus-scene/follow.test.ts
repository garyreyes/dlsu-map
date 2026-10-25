import { describe, expect, it } from 'vitest';
import type { XYH } from './glide';
import {
  easeInOut,
  followAt,
  followMs,
  followsStep,
  isNext,
  planFollow,
  poseAt,
  turnWindow,
  type Follow,
  type Lens,
} from './follow';
import { facingAzimuth } from './gestures';

const NORTH = 0;
const EAST = -Math.PI / 2;
const WEST = Math.PI / 2;
const deg = (d: number) => (d * Math.PI) / 180;

const lens = (azimuth: number): Lens => ({ azimuth, polar: deg(40), distance: 300 });
const STEP = { polar: deg(40), distance: 300 };

/** The biggest change in heading from one centimetre to the next along the whole follow, as frames would draw it. */
function biggestStep(f: Follow): number {
  let near = f.from.azimuth;
  let biggest = 0;
  for (let s = 0; s <= f.length; s += 0.01) {
    const { azimuth } = poseAt(f, s, near);
    biggest = Math.max(biggest, Math.abs(azimuth - near));
    near = azimuth;
  }
  return biggest;
}

// 100 m north, then 100 m east: a corner at (0, 100). The walk then carries on east.
const CORNER: XYH[] = [
  [0, 0, 0],
  [0, 100, 0],
  [100, 100, 0],
];

describe('followMs', () => {
  it('takes 1.2 s per 100 m, never under 1 s or over 3 s', () => {
    expect([50, 100, 200, 250, 400].map(followMs)).toStrictEqual([1000, 1200, 2400, 3000, 3000]);
  });
});

describe('easeInOut', () => {
  it('starts and ends gently, exactly 0 and 1 at the ends', () => {
    expect([0, 0.25, 0.5, 0.75, 1].map(easeInOut)).toStrictEqual([0, 0.0625, 0.5, 0.9375, 1]);
  });

  it('holds to its ends outside 0..1', () => {
    expect([easeInOut(-1), easeInOut(2)]).toStrictEqual([0, 1]);
  });
});

describe('turnWindow', () => {
  it('turns a corner over a fifth of the walk, between 8 and 60 m', () => {
    expect([20, 200, 1000].map(turnWindow)).toStrictEqual([8, 40, 60]);
  });
});

describe('followAt', () => {
  const east = planFollow(
    [
      [0, 0, 0],
      [100, 0, 0],
    ],
    [150, 0],
    lens(EAST),
    STEP,
  );

  it('rides the dot, walking direction up', () => {
    expect(east.ms).toBe(1200);
    const half = followAt(east, 600, EAST);
    expect(half.target).toStrictEqual([50, 0, 0]);
    expect(half.azimuth).toBeCloseTo(EAST, 12);
    expect(half.done).toBe(false);
  });

  it('is at the spot when the time is up', () => {
    const end = followAt(east, 1200, EAST);
    expect(end.target).toStrictEqual([100, 0, 0]);
    expect(end.done).toBe(true);
  });

  it('holds to the start before it and to the end after it', () => {
    expect(followAt(east, -100, EAST)).toMatchObject({ target: [0, 0, 0], done: false });
    expect(followAt(east, 1700, EAST)).toMatchObject({ target: [100, 0, 0], done: true });
  });

  it('ends at the step on a bad clock instead of drawing NaN', () => {
    expect(followAt(east, Number.NaN, EAST)).toMatchObject({ target: [100, 0, 0], done: true });
  });

  it('tilts and zooms from where the camera was to the step, by the same progress', () => {
    const f = planFollow(
      CORNER,
      [200, 100],
      { azimuth: NORTH, polar: deg(40), distance: 300 },
      {
        polar: deg(8),
        distance: 200,
      },
    );
    const half = followAt(f, f.ms / 2, NORTH);
    expect(half.polar).toBeCloseTo(deg(24), 12);
    expect(half.distance).toBeCloseTo(250, 12);
  });

  it('rises with the dot through a door', () => {
    const door = planFollow(
      [
        [0, 0, 0],
        [10, 0, 1],
      ],
      null,
      lens(EAST),
      STEP,
    );
    expect(followAt(door, door.ms / 2, EAST).target[2]).toBeCloseTo(0.5, 12);
  });
});

describe('poseAt: the heading', () => {
  const f = planFollow(CORNER, [200, 100], lens(NORTH), STEP);

  it('looks ahead, so the corner turns gradually', () => {
    expect(f.window).toBe(40);
    expect(poseAt(f, 40, NORTH).azimuth).toBeCloseTo(NORTH, 12);
    expect(poseAt(f, 80, NORTH).azimuth).toBeCloseTo(-Math.PI / 4, 12);
    // 10 m of north and 30 m of east ahead: weighted by how much of each is in view.
    expect(poseAt(f, 90, NORTH).azimuth).toBeCloseTo(Math.atan2(-30, 10), 12);
    expect(poseAt(f, 100, NORTH).azimuth).toBeCloseTo(EAST, 12);
  });

  it('turns smoothly all the way, round the corner and into the end', () => {
    expect(biggestStep(f)).toBeLessThan(0.01);
  });

  it('ends facing the way the walk goes on, as the step rests', () => {
    expect(poseAt(f, 200, NORTH).azimuth).toBeCloseTo(facingAzimuth([100, 100], [200, 100], NORTH), 12);
    // The same spot with the walk turning north from it instead: not a fluke of the line running straight on.
    const turning = planFollow(CORNER, [100, 200], lens(NORTH), STEP);
    expect(poseAt(turning, 200, EAST).azimuth).toBeCloseTo(facingAzimuth([100, 100], [100, 200], EAST), 12);
  });

  it('ends along the last stretch when nothing comes after', () => {
    const last = planFollow(CORNER, null, lens(NORTH), STEP);
    expect(poseAt(last, 200, NORTH).azimuth).toBeCloseTo(EAST, 12);
  });

  it('turns in from wherever the camera was, without a jump', () => {
    const north: XYH[] = [
      [0, 0, 0],
      [0, 100, 0],
    ];
    const g = planFollow(north, null, lens(WEST), STEP);
    expect(poseAt(g, 0, WEST).azimuth).toBeCloseTo(WEST, 12);
    expect(poseAt(g, g.turnIn / 2, WEST).azimuth).toBeCloseTo(Math.PI / 4, 12);
    expect(poseAt(g, g.window, WEST).azimuth).toBeCloseTo(NORTH, 12);
  });

  it('turns in from facing the other way without flipping sides halfway', () => {
    // North up after a compass tap, then Next on a walk heading south with a bend: the turn crosses ±π.
    const south: XYH[] = [
      [0, 0, 0],
      [0, -30, 0],
      [10, -100, 0],
    ];
    expect(biggestStep(planFollow(south, [20, -200], lens(NORTH), STEP))).toBeLessThan(0.01);
    const wiggle: XYH[] = [
      [0, 0, 0],
      [2, -30, 0],
      [-2, -60, 0],
      [0, -100, 0],
    ];
    expect(biggestStep(planFollow(wiggle, null, lens(NORTH), STEP))).toBeLessThan(0.01);
  });

  it('never swings the long way round', () => {
    const north: XYH[] = [
      [0, 0, 0],
      [0, 100, 0],
    ];
    const g = planFollow(north, null, lens(NORTH), STEP);
    expect(poseAt(g, 50, 2 * Math.PI - 0.1).azimuth).toBeCloseTo(2 * Math.PI, 12);
  });

  it('takes the stretch it is on where a U-turn cancels out', () => {
    const uTurn: XYH[] = [
      [0, 0, 0],
      [0, 50, 0],
      [0, 0, 0],
    ];
    const g = planFollow(uTurn, null, lens(NORTH), STEP);
    expect(g.window).toBe(20);
    const at = poseAt(g, 40, NORTH);
    expect(Number.isFinite(at.azimuth)).toBe(true);
    expect(at.azimuth).toBeCloseTo(NORTH, 12);
  });
});

describe('followsStep', () => {
  const ALL = { forward: true, sameLevel: true, reduced: false, spotStep: true, moves: true };

  it('follows a Next along one level to a spot, with motion on', () => {
    expect(followsStep(ALL)).toBe(true);
  });

  it.each([
    ['Back or a jump', { forward: false }],
    ['a climb or a change of building', { sameLevel: false }],
    ['reduced motion', { reduced: true }],
    ['a view that is not a spot (a floor whose cut is not open)', { spotStep: false }],
    ['a glide that goes nowhere', { moves: false }],
  ])('does not follow %s', (_why, change) => {
    expect(followsStep({ ...ALL, ...change })).toBe(false);
  });
});

describe('isNext', () => {
  const route = { id: 'a' };

  it('is Next when the step goes up by one on the same route', () => {
    expect(isNext({ route, step: 2 }, { route, step: 3 })).toBe(true);
  });

  it.each([
    ['Back', { route, step: 2 }, { route, step: 1 }],
    ['a jump ahead from All steps', { route, step: 1 }, { route, step: 5 }],
    ['the same step again', { route, step: 2 }, { route, step: 2 }],
    ['a new route (a route option, a new From or To)', { route, step: 2 }, { route: { id: 'a' }, step: 3 }],
    ['Start from the preview (no step before)', { route, step: undefined }, { route, step: 0 }],
    ['leaving the player (no step now)', { route, step: 2 }, { route, step: undefined }],
  ])('is not Next for %s', (_why, was, now) => {
    expect(isNext(was, now)).toBe(false);
  });
});
