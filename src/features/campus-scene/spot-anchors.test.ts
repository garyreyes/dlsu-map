import { describe, expect, it } from 'vitest';
import type { CampusBuilding } from '@/shared/data/campus';
import type { Indoor } from '@/shared/data/indoor';
import type { SpotLabel } from '@/shared/data/spot-labels';
import { spotAnchors, SPOT_GAP } from './spot-anchors';

// Entrance 2 is walk point 1, at (10, 20).
const CAMPUS = { walk: { points: [0, 0, 10, 20] }, entrances: [{ point: 0 }, { point: 0 }, { point: 1 }] };
// Three storeys of 4 m: floor 2 starts at 4 m (the band is inset 0.1 m, so its bottom is 4.1).
const BUILDING = {
  levels: 3,
  volumes: [{ base: 0, top: 12, outline: [0, 0, 5, 0, 5, 5] }],
} as unknown as CampusBuilding;
// Graph point 1 is at (3, 4); the east stairs stop there on floor 2.
const FILE = {
  building: 'velasco',
  graph: { points: [0, 0, 3, 4] },
  verticals: [{ id: 'east-stairs', kind: 'stairs', servesFloors: [1, 2], stops: [{ floor: 2, point: 1 }] }],
} as unknown as Indoor;
const find = (slug: string) => (slug === 'velasco' ? BUILDING : undefined);

const door: SpotLabel = {
  building: 'velasco',
  floor: 1,
  spot: { kind: 'entrance', entrance: 2 },
  label: 'Main entrance',
};
const stairs: SpotLabel = {
  building: 'velasco',
  floor: 2,
  spot: { kind: 'vertical', id: 'east-stairs' },
  label: 'East stairs',
};

describe('spotAnchors', () => {
  it('puts a door on its walk point, on the ground', () => {
    expect(spotAnchors([door], CAMPUS, find, undefined)).toEqual([
      { id: '.spot:velasco:e2', text: 'Main entrance', x: 10, y: 20, height: SPOT_GAP },
    ]);
  });

  it('puts a stairs on its stop in the building file, at that floor', () => {
    const [a] = spotAnchors([stairs], CAMPUS, find, FILE);
    expect(a).toMatchObject({ id: '.spot:velasco:v-east-stairs', text: 'East stairs', x: 3, y: 4 });
    expect(a?.height).toBeCloseTo(4.1 + SPOT_GAP);
  });

  it('skips what it cannot place: no file yet, no such stop, no such floor, no such door', () => {
    const noStop: SpotLabel = { ...stairs, spot: { kind: 'vertical', id: 'west-stairs' } };
    const noFloor: SpotLabel = { ...stairs, floor: 9 };
    const noDoor: SpotLabel = { ...door, spot: { kind: 'entrance', entrance: 7 } };
    expect(spotAnchors([stairs], CAMPUS, find, undefined)).toEqual([]);
    expect(spotAnchors([noStop, noFloor, noDoor], CAMPUS, find, FILE)).toEqual([]);
  });
});
