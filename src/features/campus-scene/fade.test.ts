// Which buildings draw faded (D60). A wrong set fades the goal, or leaves a wall in the way of the route, and still
// renders without complaint. So each case pins the exact set.
import { describe, expect, it } from 'vitest';
import type { Leg, Route, WalkEnd } from '@/shared/data/route';
import { fadedSlugs, goalBuilding } from './fade';

const all = ['a', 'b', 'c'];
const sorted = (s: ReadonlySet<string>) => [...s].sort();

describe('fadedSlugs', () => {
  it('see-through fades every building except the kept ones', () => {
    const r = fadedSlugs('see-through', new Set(), all, ['b']);
    expect(r).toEqual(new Set(['a', 'c']));
    expect(r.size).toBe(2);
  });

  it('see-through with a route list still fades all but the kept', () => {
    const r = fadedSlugs('see-through', new Set(['a']), all, ['c']);
    expect(sorted(r)).toEqual(['a', 'b']);
  });

  it('solid with an empty route list fades nothing', () => {
    const r = fadedSlugs('solid', new Set(), all, []);
    expect(r.size).toBe(0);
  });

  it('solid fades exactly the route list', () => {
    const r = fadedSlugs('solid', new Set(['a', 'c']), all, []);
    expect(sorted(r)).toEqual(['a', 'c']);
  });

  it('keeps a kept slug out even when the route list has it', () => {
    const r = fadedSlugs('solid', new Set(['a', 'b']), all, ['a']);
    expect(sorted(r)).toEqual(['b']);
  });

  it('ignores a route slug that is not a campus building', () => {
    const r = fadedSlugs('solid', new Set(['a', 'zzz']), all, []);
    expect(sorted(r)).toEqual(['a']);
  });

  it('ignores nulls and undefineds in keep', () => {
    const r = fadedSlugs('see-through', new Set(), all, [null, undefined, 'a']);
    expect(sorted(r)).toEqual(['b', 'c']);
  });

  it('is empty for an empty building list', () => {
    expect(fadedSlugs('see-through', new Set(['a']), [], []).size).toBe(0);
    expect(fadedSlugs('solid', new Set(['a']), [], []).size).toBe(0);
  });

  it('returns a new set, never the route list itself', () => {
    const route = new Set(['a']);
    expect(fadedSlugs('solid', route, all, [])).not.toBe(route);
  });
});

// The goal building never fades (D60 point 3), so a wrong goal fades the building the student is walking to.
const route = (legs: Leg[]): Route => ({ legs, steps: [], meters: 0, seconds: 0 });
const door = (building: string) => ({ kind: 'door', building, door: 'main', verified: true, at: [0, 0] }) as const;
const gate = { kind: 'gate', gate: 'gate-1', name: 'Gate 1', at: [0, 0] } as const;
const indoor = (building: string): Leg => ({
  kind: 'indoor',
  building,
  floor: 3,
  path: [],
  meters: 0,
  seconds: 0,
});
const walk = (to: WalkEnd): Leg => ({
  kind: 'walk',
  from: gate,
  to,
  path: [],
  meters: 0,
  seconds: 0,
});

describe('goalBuilding', () => {
  it('is undefined without a route or legs', () => {
    expect(goalBuilding(null)).toBeUndefined();
    expect(goalBuilding(route([]))).toBeUndefined();
  });

  it('is the building of an indoor last leg', () => {
    expect(goalBuilding(route([indoor('velasco'), walk(door('andrew')), indoor('andrew')]))).toBe('andrew');
  });

  it('is the door building of a walk that ends the route', () => {
    expect(goalBuilding(route([walk(door('andrew'))]))).toBe('andrew');
  });

  it('is undefined for a walk to a gate', () => {
    expect(goalBuilding(route([walk(gate)]))).toBeUndefined();
  });
});
