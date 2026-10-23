// What the route preview (S5) says about a route has one right answer per route: how the floors are taken, which
// building has no elevator or no indoor map, and why there's no route. A wrong line tells a student to expect an
// elevator that isn't there, or hides that the directions stop at a door. Exact values throughout, and every wording
// of each line is reached at least once.
import { describe, expect, it } from 'vitest';
import type { Leg, Route } from '@/shared/data/route';
import {
  sampleGateRoute,
  sampleIndoorRoute,
  sampleNoElevator,
  sampleNoIndoorMap,
  sampleRoute,
} from '@/shared/data/route.sample';
import { noElevatorLines, noIndoorMapLines, notOkLine, summaryLine } from './preview';
import { placeNames } from './steps-list';

const names = placeNames({
  buildings: [
    { slug: 'andrew', short: 'Andrew' },
    { slug: 'gokongwei', short: 'Gokongwei' },
    { slug: 'strc', short: 'STRC', floorLabels: { '1': 'G' } },
    { slug: 'velasco', short: 'Velasco' },
  ],
  gates: [{ id: 'gate-2', name: 'Gate 2 (North)' }],
});

const floors = (building: string, by: 'stairs' | 'elevator', noElevator?: true): Leg => ({
  kind: 'floors',
  building,
  from: 1,
  to: 4,
  by,
  seconds: 60,
  ...(noElevator ? { noElevator } : {}),
});
const walk = sampleGateRoute.legs[0];
const routeOf = (legs: readonly Leg[], noIndoorMap?: readonly string[]): Route => ({
  legs,
  steps: [],
  meters: legs.some((l) => l.kind === 'walk') ? 216 : 0,
  seconds: 300,
  ...(noIndoorMap ? { noIndoorMap } : {}),
});

describe('summaryLine', () => {
  it('says the elevator when every floor change takes it', () => {
    expect(summaryLine(routeOf([walk, floors('strc', 'elevator')]))).toBe('About 5 min · 216 m walk · via elevator');
  });

  it('says the stairs when every floor change takes them', () => {
    expect(summaryLine(sampleIndoorRoute)).toBe('About 4 min · 250 m walk · via stairs');
  });

  it('says both when one building takes the elevator and another the stairs', () => {
    expect(summaryLine(sampleRoute)).toBe('About 5 min · 63 m walk · via elevator and stairs');
  });

  it('says neither when no floor changes', () => {
    expect(summaryLine(sampleGateRoute)).toBe('About 3 min · 216 m walk');
  });

  it('leaves out the walk inside one building', () => {
    expect(summaryLine(sampleNoElevator)).toBe('About 3 min · via stairs');
  });
});

describe('noElevatorLines', () => {
  it('names the building that had no elevator when one was asked for', () => {
    expect(noElevatorLines(sampleNoElevator, names)).toEqual(['No elevator in Andrew. Using stairs.']);
  });

  it('says nothing when every elevator asked for was there', () => {
    expect(noElevatorLines(sampleRoute, names)).toEqual([]);
  });

  it('names each building once, in route order', () => {
    const route = routeOf([
      floors('velasco', 'stairs', true),
      walk,
      floors('andrew', 'stairs', true),
      floors('andrew', 'stairs', true),
    ]);
    expect(noElevatorLines(route, names)).toEqual([
      'No elevator in Velasco. Using stairs.',
      'No elevator in Andrew. Using stairs.',
    ]);
  });
});

describe('noIndoorMapLines', () => {
  it('says nothing when every building on the route has its indoor map', () => {
    expect(noIndoorMapLines(sampleIndoorRoute, names)).toEqual([]);
  });

  it('says the directions stop at the To building’s door', () => {
    expect(noIndoorMapLines(sampleNoIndoorMap, names)).toEqual([
      'Velasco has no indoor map yet, so directions stop at its door.',
    ]);
  });

  it('says the directions start at the From building’s door', () => {
    const route = routeOf([floors('andrew', 'elevator'), walk], ['andrew']);
    expect(noIndoorMapLines(route, names)).toEqual(['Andrew has no indoor map yet, so directions start at its door.']);
  });

  it('says door to door when neither end has its indoor map', () => {
    const route = routeOf([floors('andrew', 'elevator'), walk, floors('gokongwei', 'stairs')], ['andrew', 'gokongwei']);
    expect(noIndoorMapLines(route, names)).toEqual([
      'Andrew and Gokongwei have no indoor maps yet, so directions go from door to door.',
    ]);
  });

  it('says only the floor is given when the whole trip is inside a building with no indoor map', () => {
    expect(noIndoorMapLines(routeOf([floors('andrew', 'stairs')], ['andrew']), names)).toEqual([
      'Andrew has no indoor map yet, so directions only give the floor.',
    ]);
  });

  it('says only the floor is given for a trip on one floor, which has no legs', () => {
    expect(noIndoorMapLines(routeOf([], ['andrew']), names)).toEqual([
      'Andrew has no indoor map yet, so directions only give the floor.',
    ]);
  });
});

describe('notOkLine', () => {
  const from = { kind: 'room', code: 'AG1104' } as const;
  const to = { kind: 'room', code: 'ST311' } as const;

  it('names both ends when nothing joins them', () => {
    expect(notOkLine('no-route', from, to, names)).toBe('We can’t find a way from AG1104 to ST311 yet.');
    expect(notOkLine('no-route', { kind: 'gate', gate: 'gate-2' }, { kind: 'building', building: 'strc' }, names)).toBe(
      'We can’t find a way from Gate 2 (North) to STRC yet.',
    );
  });

  it('says the student is already there', () => {
    expect(notOkLine('same-room', to, to, names)).toBe('You’re already at ST311.');
  });

  it('says a place is missing from the data', () => {
    expect(notOkLine('unknown-place', from, to, names)).toBe('A place on this route isn’t in the map data.');
  });

  describe('while the file is still saving', () => {
    it('says the directions stop at the To building’s door for now', () => {
      expect(noIndoorMapLines(sampleNoIndoorMap, names, ['velasco'])).toEqual([
        'Velasco’s indoor map is still saving. Steps inside are text only.',
      ]);
    });

    it('says the directions start at the From building’s door for now', () => {
      const route = routeOf([floors('andrew', 'elevator'), walk], ['andrew']);
      expect(noIndoorMapLines(route, names, ['andrew'])).toEqual([
        'Andrew’s indoor map is still saving. Steps inside are text only.',
      ]);
    });

    it('says door to door when both are still saving', () => {
      const route = routeOf(
        [floors('andrew', 'elevator'), walk, floors('gokongwei', 'stairs')],
        ['andrew', 'gokongwei'],
      );
      expect(noIndoorMapLines(route, names, ['andrew', 'gokongwei'])).toEqual([
        'Andrew and Gokongwei’s indoor maps are still saving. Steps inside are text only.',
      ]);
    });

    it('says only the floor is given for now inside one building', () => {
      expect(noIndoorMapLines(routeOf([floors('andrew', 'stairs')], ['andrew']), names, ['andrew'])).toEqual([
        'Andrew’s indoor map is still saving. Steps inside are text only.',
      ]);
    });

    it('says each building its own way when only one is still saving', () => {
      const toGokongwei: Leg = {
        ...sampleGateRoute.legs[0],
        to: { kind: 'door', building: 'gokongwei', door: 'main', verified: true, at: [0, 0] } as const,
      };
      const route = routeOf(
        [floors('andrew', 'elevator'), toGokongwei, floors('gokongwei', 'stairs')],
        ['andrew', 'gokongwei'],
      );
      expect(noIndoorMapLines(route, names, ['gokongwei'])).toEqual([
        'Andrew has no indoor map yet, so directions start at its door.',
        'Gokongwei’s indoor map is still saving. Steps inside are text only.',
      ]);
    });

    it('ignores a still-saving building that is not on the route', () => {
      expect(noIndoorMapLines(sampleNoIndoorMap, names, ['andrew'])).toEqual([
        'Velasco has no indoor map yet, so directions stop at its door.',
      ]);
    });
  });
});
