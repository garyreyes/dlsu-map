import { describe, expect, it } from 'vitest';
import type { Leg, Route, Step, WalkEnd, XY } from '@/shared/data/route';
import { stepsWalked, walkedToward } from './walked';

const END: WalkEnd = { kind: 'gate', gate: 'gate-1', name: 'Gate 1', at: [0, 0] };

const walk = (path: XY[]): Leg => ({ kind: 'walk', from: END, to: END, path, meters: 999, seconds: 1 });
const indoor = (): Leg => ({ kind: 'indoor', building: 'b', floor: 1, path: [[0, 0]], meters: 0, seconds: 0 });
const floors = (): Leg => ({ kind: 'floors', building: 'b', from: 1, to: 3, by: 'stairs', seconds: 1 });
const turn = (leg: number, at: XY): Step => ({ kind: 'turn', turn: 'left', text: 't', leg, at, meters: 0 });
const enter = (leg: number, at: XY): Step => ({ kind: 'enter', building: 'b', text: 'e', leg, at });
const route = (legs: Leg[], steps: Step[]): Route => ({ legs, steps, meters: 0, seconds: 0 });

// An L: 10 m east, then 10 m north (20 m).
const ELL: XY[] = [
  [0, 0],
  [10, 0],
  [10, 10],
];

describe('stepsWalked', () => {
  it('measures walk steps along the walk, From-building steps 0 and To-building steps the whole walk', () => {
    const r = route(
      [indoor(), walk(ELL), indoor(), floors(), indoor()],
      [
        turn(0, [3, 3]),
        turn(1, [0, 0]),
        turn(1, [10, 4]),
        enter(1, [10, 10]),
        turn(2, [50, 50]),
        { kind: 'floors', building: 'b', to: 3, by: 'stairs', text: 'f', leg: 3 },
        turn(4, [9, 9]),
      ],
    );
    expect(stepsWalked(r)).toEqual([0, 0, 14, 20, 20, 20, 20]);
  });

  it('uses the path geometry, not the rounded leg meters', () => {
    const r = route([walk(ELL)], [enter(0, [10, 10])]);
    expect(stepsWalked(r)).toEqual([20]);
  });

  it('carries the offset over a second walk leg', () => {
    const second: XY[] = [
      [100, 0],
      [100, 30],
    ];
    const r = route(
      [indoor(), walk(ELL), indoor(), indoor(), walk(second), indoor()],
      [
        turn(0, [0, 0]),
        enter(1, [10, 10]),
        turn(3, [0, 0]),
        turn(4, [100, 0]),
        turn(4, [100, 12]),
        enter(4, [100, 30]),
        turn(5, [0, 0]),
      ],
    );
    expect(stepsWalked(r)).toEqual([0, 20, 20, 20, 32, 50, 50]);
  });

  it('is all zeros with no walk legs', () => {
    const r = route([indoor(), floors(), indoor()], [turn(0, [1, 1]), turn(2, [2, 2])]);
    expect(stepsWalked(r)).toEqual([0, 0]);
  });

  it('is empty with no steps', () => {
    expect(stepsWalked(route([], []))).toEqual([]);
  });

  it('puts a step that projects near two places at the nearest one', () => {
    // A U: out 10 m east, up 1 m, back 10 m west. The point (5, 0.9) is 0.1 m from the way out, 0.1 m under the way back.
    const u: XY[] = [
      [0, 0],
      [10, 0],
      [10, 1],
      [0, 1],
    ];
    expect(stepsWalked(route([walk(u)], [turn(0, [5, 0.1])]))).toEqual([5]);
    expect(stepsWalked(route([walk(u)], [turn(0, [5, 0.9])]))[0]).toBeCloseTo(16, 9);
  });
});

describe('walkedToward', () => {
  it('moves forward by the glided distance', () => {
    expect(walkedToward(0, 30, 10)).toBe(10);
  });
  it('stops at the end going forward', () => {
    expect(walkedToward(0, 30, 50)).toBe(30);
  });
  it('moves back for Back', () => {
    expect(walkedToward(30, 10, 5)).toBe(25);
  });
  it('stops at the end going back', () => {
    expect(walkedToward(30, 10, 99)).toBe(10);
  });
  it('stays at from when nothing has glided', () => {
    expect(walkedToward(7, 30, 0)).toBe(7);
  });
  it('stays put when from and to are equal', () => {
    expect(walkedToward(12, 12, 5)).toBe(12);
  });
});
