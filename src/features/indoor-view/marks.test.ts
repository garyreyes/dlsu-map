import { describe, expect, it } from 'vitest';
import type { Leg, Route, Step, XY } from '@/shared/data/route';
import type { Cutaway } from './cutaway';
import { cutMarks, doorOf } from './marks';

const cut: Cutaway = { building: 'andrew', floor: 3, base: 8 };

const indoor = (building: string, floor: number, path: XY[]): Leg => ({
  kind: 'indoor',
  building,
  floor,
  path,
  meters: 10,
  seconds: 10,
});

const arrive = (leg: number, code = 'AG304'): Step => ({
  kind: 'arrive',
  code,
  side: 'left',
  at: [1, 1],
  text: `${code} is on your left`,
  leg,
});

const routeOf = (legs: Leg[], steps: Step[] = []): Route => ({ legs, steps, meters: 0, seconds: 0 });

describe('cutMarks', () => {
  it('draws nothing without a route', () => {
    expect(cutMarks(null, cut)).toEqual({ lines: [] });
  });

  it('keeps only indoor legs on the cut floor of the cut building', () => {
    const a: XY[] = [
      [0, 0],
      [5, 0],
    ];
    const route = routeOf([
      indoor('andrew', 3, a),
      indoor('andrew', 1, [[9, 9]]),
      indoor('velasco', 3, [[8, 8]]),
      {
        kind: 'floors',
        building: 'andrew',
        from: 3,
        to: 1,
        by: 'stairs',
        seconds: 5,
      },
    ]);
    expect(cutMarks(route, cut)).toEqual({ lines: [a] });
  });

  it('keeps several legs on the same floor in route order', () => {
    const a: XY[] = [
      [0, 0],
      [1, 0],
    ];
    const b: XY[] = [
      [2, 0],
      [3, 0],
    ];
    const route = routeOf([indoor('andrew', 3, a), indoor('andrew', 2, [[7, 7]]), indoor('andrew', 3, b)]);
    expect(cutMarks(route, cut).lines).toEqual([a, b]);
  });

  it('names the goal room when the arrive step is on the cut floor', () => {
    const route = routeOf([indoor('andrew', 3, [[0, 0]])], [arrive(0)]);
    expect(cutMarks(route, cut)).toEqual({ lines: [[[0, 0]]], goalRoom: 'AG304' });
  });

  it('has no goalRoom key when the goal is on another floor or building', () => {
    const otherFloor = routeOf([indoor('andrew', 4, [[0, 0]])], [arrive(0)]);
    const otherBuilding = routeOf([indoor('velasco', 3, [[0, 0]])], [arrive(0)]);
    expect(cutMarks(otherFloor, cut)).toEqual({ lines: [] });
    expect('goalRoom' in cutMarks(otherFloor, cut)).toBe(false);
    expect('goalRoom' in cutMarks(otherBuilding, cut)).toBe(false);
  });

  it('has no goalRoom when the arrive step points at a leg that is not indoor', () => {
    const route = routeOf([indoor('andrew', 3, [[0, 0]])], [arrive(5)]);
    expect('goalRoom' in cutMarks(route, cut)).toBe(false);
  });
});

describe('doorOf', () => {
  // Points 0, 1, 2 at (0,0), (10,0), (20,0).
  const indoor = { graph: { points: [0, 0, 10, 0, 20, 0] } };
  const label: [number, number] = [7, 8];

  it('is the door nearest the end of the walk', () => {
    expect(doorOf(indoor, { doors: [0, 1, 2], label }, [19, 1])).toEqual([20, 0]);
    expect(doorOf(indoor, { doors: [0, 1, 2], label }, [1, 1])).toEqual([0, 0]);
  });

  it('is the first door when there is no walk', () => {
    expect(doorOf(indoor, { doors: [1, 2], label }, undefined)).toEqual([10, 0]);
  });

  it('is the label point when the room has no doors', () => {
    expect(doorOf(indoor, { doors: [], label }, [1, 1])).toEqual([7, 8]);
  });
});
