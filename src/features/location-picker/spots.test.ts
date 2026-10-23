import { describe, expect, it } from 'vitest';
import type { Indoor } from '@/shared/data/indoor';
import { offersSpot, spotChoices } from './spots';

// Only the field spots.ts reads; the rest of Indoor is the graph, which these rules never touch.
const fileOf = (verticals: Indoor['verticals']): Indoor => ({ verticals }) as unknown as Indoor;
const stops = (...floors: number[]) => floors.map((floor) => ({ floor, point: 0 }));

// Velasco: two mains (4 faces CADS, 5 faces Agno), and four verticals on floors 1-5, listed stairs first.
const VELASCO_DOORS = [
  { entrance: 4, kind: 'main', name: 'facing CADS' },
  { entrance: 5, kind: 'main', name: 'facing Agno' },
] as const;
const VELASCO = fileOf([
  { id: 'east-stairs', kind: 'stairs', servesFloors: [1, 2, 3, 4, 5], stops: stops(1, 2, 3, 4, 5) },
  { id: 'main-stairs', kind: 'stairs', servesFloors: [1, 2, 3, 4, 5], stops: stops(1, 2, 3, 4, 5) },
  { id: 'west-stairs', kind: 'stairs', servesFloors: [1, 2, 3, 4, 5], stops: stops(1, 2, 3, 4, 5) },
  { id: 'elevator', kind: 'elevator', servesFloors: [1, 2, 3, 4, 5], stops: stops(1, 2, 3, 4, 5) },
]);

// St. Joseph: a side door, the main one, and another side door, in that order in campus.json.
const SJ_DOORS = [
  { entrance: 9, kind: 'side', name: 'facing Miguel' },
  { entrance: 10, kind: 'main' },
  { entrance: 11, kind: 'side', name: 'facing SJ Walk' },
] as const;

describe('spotChoices', () => {
  it('on G lists the doors, then the elevator and the stairs', () => {
    expect(spotChoices(VELASCO_DOORS, 1, VELASCO)).toEqual([
      { spot: { kind: 'entrance', entrance: 4 }, label: 'main entrance facing CADS' },
      { spot: { kind: 'entrance', entrance: 5 }, label: 'main entrance facing Agno' },
      { spot: { kind: 'vertical', id: 'elevator' }, label: 'elevator' },
      { spot: { kind: 'vertical', id: 'east-stairs' }, label: 'east stairs' },
      { spot: { kind: 'vertical', id: 'main-stairs' }, label: 'main stairs' },
      { spot: { kind: 'vertical', id: 'west-stairs' }, label: 'west stairs' },
    ]);
  });

  it('puts main doors before side doors, each in campus.json order', () => {
    expect(spotChoices(SJ_DOORS, 1, null)).toEqual([
      { spot: { kind: 'entrance', entrance: 10 }, label: 'main entrance' },
      { spot: { kind: 'entrance', entrance: 9 }, label: 'side entrance facing Miguel' },
      { spot: { kind: 'entrance', entrance: 11 }, label: 'side entrance facing SJ Walk' },
    ]);
  });

  it('on G without the file lists only the doors', () => {
    expect(spotChoices(VELASCO_DOORS, 1, null)).toEqual([
      { spot: { kind: 'entrance', entrance: 4 }, label: 'main entrance facing CADS' },
      { spot: { kind: 'entrance', entrance: 5 }, label: 'main entrance facing Agno' },
    ]);
  });

  it('on an upper floor lists the elevator, then the stairs, and no doors', () => {
    expect(spotChoices(VELASCO_DOORS, 3, VELASCO).map((c) => c.spot)).toEqual([
      { kind: 'vertical', id: 'elevator' },
      { kind: 'vertical', id: 'east-stairs' },
      { kind: 'vertical', id: 'main-stairs' },
      { kind: 'vertical', id: 'west-stairs' },
    ]);
  });

  it('on an upper floor without the file has nothing to offer', () => {
    expect(spotChoices(VELASCO_DOORS, 3, null)).toEqual([]);
  });

  it('leaves out a vertical that serves the floor but has no stop there', () => {
    const file = fileOf([
      { id: 'east-stairs', kind: 'stairs', servesFloors: [1, 2, 3], stops: stops(1, 2) },
      { id: 'elevator', kind: 'elevator', servesFloors: [1, 2, 3], stops: stops(1, 2, 3) },
    ]);
    expect(spotChoices([], 3, file)).toEqual([{ spot: { kind: 'vertical', id: 'elevator' }, label: 'elevator' }]);
  });

  it('leaves out a vertical that has no stop on G, from G', () => {
    const file = fileOf([{ id: 'annex-stairs', kind: 'stairs', servesFloors: [2, 3], stops: stops(2, 3) }]);
    expect(spotChoices([], 1, file)).toEqual([]);
  });
});

describe('offersSpot', () => {
  it('is true for two doors, or for a file with a stop', () => {
    expect(offersSpot(VELASCO_DOORS, null)).toBe(true);
    expect(offersSpot(SJ_DOORS, null)).toBe(true);
    expect(offersSpot([{ entrance: 6, kind: 'main' }], VELASCO)).toBe(true);
  });

  it('is false for one door and no file (Miguel)', () => {
    expect(offersSpot([{ entrance: 6, kind: 'main' }], null)).toBe(false);
  });

  it('is false for one door and a file whose verticals have no stops', () => {
    const file = fileOf([{ id: 'elevator', kind: 'elevator', servesFloors: [1, 2], stops: [] }]);
    expect(offersSpot([{ entrance: 6, kind: 'main' }], file)).toBe(false);
  });
});
