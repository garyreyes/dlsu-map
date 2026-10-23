// The router end to end on a hand-drawn campus (D34). Every number is worked by hand: walking is meters ÷ 1.3 m/s,
// stairs 20 s a floor, elevator 180 s + 5 s a floor, Auto = elevator for 3 floors or more.
//
//   M (alpha main) 0,100          S (alpha side) 100,90
//        |  100 m path                  |  90 m path
//   g1 (gate) 0,0 ------ 100 m path ---- B (beta main) 100,0          gamma: an island far away; delta: no doors
import { describe, expect, it } from 'vitest';
import type { From, Router, To } from '@/shared/data/route';
import { fixtureCampus, fixtureRooms } from './fixture';
import { createRouter } from './router';

const campus = fixtureCampus(
  [
    [[0, 100], [0, 0], 'path'],
    [[0, 0], [100, 0], 'path'],
    [[100, 90], [100, 0], 'path'],
    [[500, 500], [510, 500], 'path'],
  ],
  {
    gates: [{ id: 'g1', at: [0, 0] }],
    doors: [
      { building: 'alpha', at: [0, 100] },
      { building: 'alpha', at: [100, 90], kind: 'side', name: 'to the field' },
      { building: 'beta', at: [100, 0] },
      { building: 'gamma', at: [500, 500] },
    ],
    buildings: [{ slug: 'alpha' }, { slug: 'beta' }, { slug: 'gamma' }, { slug: 'delta', tier: 'block', levels: 3 }],
  },
);
const rooms = fixtureRooms(
  ['AL101', 'alpha', 1],
  ['AL205', 'alpha', 2],
  ['AL207', 'alpha', 2],
  ['AL401', 'alpha', 4],
  ['AL502', 'alpha', 5],
  ['BE101', 'beta', 1],
  ['BE301', 'beta', 3],
);
/** The legs and totals only: the steps are 4c's, tested in `directions.test.ts`. */
const router = createRouter(campus, rooms);
const route = (...args: Parameters<Router>) => {
  const result = router(...args);
  if (!result.ok) return result;
  const { legs, meters, seconds } = result.route;
  return { ok: true, route: { legs, meters, seconds } } as const;
};

const gate = { kind: 'gate', gate: 'g1', name: 'Gate g1', at: [0, 0] } as const;
const alphaMain = {
  kind: 'door',
  building: 'alpha',
  door: 'main',
  entrance: 0,
  verified: false,
  at: [0, 100],
} as const;
const alphaSide = {
  kind: 'door',
  building: 'alpha',
  door: 'side',
  name: 'to the field',
  entrance: 1,
  verified: false,
  at: [100, 90],
} as const;
const betaMain = { kind: 'door', building: 'beta', door: 'main', entrance: 2, verified: false, at: [100, 0] } as const;

const building = (slug: string, floor = 1): From => ({ kind: 'building', building: slug, floor });
const room = (code: string): From & To => ({ kind: 'room', code });
const toBuilding = (slug: string): To => ({ kind: 'building', building: slug });

describe('walks', () => {
  it('goes from a gate to a building’s door', () => {
    expect(route({ kind: 'gate', gate: 'g1' }, toBuilding('beta'), 'auto')).toStrictEqual({
      ok: true,
      route: {
        legs: [
          {
            kind: 'walk',
            from: gate,
            to: betaMain,
            path: [
              [0, 0],
              [100, 0],
            ],
            meters: 100,
            seconds: 77,
          },
        ],
        meters: 100,
        seconds: 77,
      },
    });
  });

  it('leaves from the main entrance when From is a building’s G (the PRD’s spot default), even if a side door is nearer', () => {
    const result = route(building('alpha', 1), toBuilding('beta'), 'auto');
    expect(result).toStrictEqual({
      ok: true,
      route: {
        legs: [
          {
            kind: 'walk',
            from: alphaMain,
            to: betaMain,
            path: [
              [0, 100],
              [0, 0],
              [100, 0],
            ],
            meters: 200,
            seconds: 154,
          },
        ],
        meters: 200,
        seconds: 154,
      },
    });
  });

  it('treats a room on G like the building’s G', () => {
    const result = route(room('AL101'), toBuilding('beta'), 'auto');
    expect(result.ok && result.route.legs[0]).toMatchObject({ kind: 'walk', from: alphaMain, meters: 200 });
  });

  it('leaves from an upper floor by whichever door is cheapest to walk from', () => {
    expect(route(building('alpha', 2), toBuilding('beta'), 'auto')).toStrictEqual({
      ok: true,
      route: {
        legs: [
          { kind: 'floors', building: 'alpha', from: 2, to: 1, by: 'stairs', seconds: 20 },
          {
            kind: 'walk',
            from: alphaSide,
            to: betaMain,
            path: [
              [100, 90],
              [100, 0],
            ],
            meters: 90,
            seconds: 69,
          },
        ],
        meters: 90,
        seconds: 89,
      },
    });
  });

  it('enters the To building by whichever door is cheapest to walk to', () => {
    const result = route(building('beta', 1), toBuilding('alpha'), 'auto');
    expect(result.ok && result.route.legs).toStrictEqual([
      {
        kind: 'walk',
        from: betaMain,
        to: alphaSide,
        path: [
          [100, 0],
          [100, 90],
        ],
        meters: 90,
        seconds: 69,
      },
    ]);
  });
});

describe('floors at both ends', () => {
  it('goes down, across and up in that order, adding the legs’ seconds', () => {
    expect(route(room('AL401'), room('BE301'), 'auto')).toStrictEqual({
      ok: true,
      route: {
        legs: [
          { kind: 'floors', building: 'alpha', from: 4, to: 1, by: 'elevator', seconds: 195 },
          {
            kind: 'walk',
            from: alphaSide,
            to: betaMain,
            path: [
              [100, 90],
              [100, 0],
            ],
            meters: 90,
            seconds: 69,
          },
          { kind: 'floors', building: 'beta', from: 1, to: 3, by: 'stairs', seconds: 40 },
        ],
        meters: 90,
        seconds: 304,
      },
    });
  });

  it('follows the mode asked for at both ends', () => {
    const result = route(room('AL401'), room('BE301'), 'stairs');
    expect(result.ok && result.route.legs.map((l) => (l.kind === 'floors' ? [l.by, l.seconds] : l.kind))).toStrictEqual(
      [['stairs', 60], 'walk', ['stairs', 40]],
    );
    const lift = route(room('AL401'), room('BE301'), 'elevator');
    expect(lift.ok && lift.route.legs.map((l) => (l.kind === 'floors' ? [l.by, l.seconds] : l.kind))).toStrictEqual([
      ['elevator', 195],
      'walk',
      ['elevator', 190],
    ]);
  });

  it('has no floors leg on the ground floor', () => {
    const result = route({ kind: 'gate', gate: 'g1' }, room('BE101'), 'auto');
    expect(result.ok && result.route.legs.map((l) => l.kind)).toStrictEqual(['walk']);
  });
});

describe('within one building', () => {
  it('is one floors leg and no walk', () => {
    expect(route(room('AL205'), room('AL502'), 'auto')).toStrictEqual({
      ok: true,
      route: {
        legs: [{ kind: 'floors', building: 'alpha', from: 2, to: 5, by: 'elevator', seconds: 195 }],
        meters: 0,
        seconds: 195,
      },
    });
  });

  it('is no legs on the same floor (indoor walking comes in 8b)', () => {
    expect(route(room('AL205'), room('AL207'), 'auto')).toStrictEqual({
      ok: true,
      route: { legs: [], meters: 0, seconds: 0 },
    });
    expect(route(building('alpha', 1), toBuilding('alpha'), 'auto')).toStrictEqual({
      ok: true,
      route: { legs: [], meters: 0, seconds: 0 },
    });
  });
});

describe('when there is no route', () => {
  it('uses the stairs and says so when Elevator is asked for in a building without one', () => {
    expect(route(building('delta', 3), toBuilding('delta'), 'elevator')).toStrictEqual({
      ok: true,
      route: {
        legs: [{ kind: 'floors', building: 'delta', from: 3, to: 1, by: 'stairs', seconds: 40, noElevator: true }],
        meters: 0,
        seconds: 40,
      },
    });
  });

  it('says same-room for the same room', () => {
    expect(route(room('AL205'), room('AL205'), 'auto')).toStrictEqual({ ok: false, reason: 'same-room' });
  });

  it.each([
    ['an unknown gate', { kind: 'gate', gate: 'nope' }, toBuilding('beta')],
    ['an unknown From building', building('nope'), toBuilding('beta')],
    ['an unknown From room', room('XX101'), toBuilding('beta')],
    ['an unknown To room', building('alpha'), room('XX101')],
    ['an unknown To building', building('alpha'), toBuilding('nope')],
    ['the same unknown room twice', room('XX101'), room('XX101')],
    ['floor 0', building('alpha', 0), toBuilding('beta')],
    ['a floor above the top', building('alpha', 6), toBuilding('beta')],
  ] as const)('says unknown-place for %s', (_label, from, to) => {
    expect(route(from, to, 'auto')).toStrictEqual({ ok: false, reason: 'unknown-place' });
  });

  it.each([
    ['nothing joins the buildings', building('alpha'), toBuilding('gamma')],
    ['the To building has no doors', building('alpha'), toBuilding('delta')],
    ['the From building has no doors', building('delta'), toBuilding('beta')],
  ] as const)('says no-route when %s', (_label, from, to) => {
    expect(route(from, to, 'auto')).toStrictEqual({ ok: false, reason: 'no-route' });
  });
});
