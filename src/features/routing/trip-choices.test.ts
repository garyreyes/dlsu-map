// Change spot and the door choice (8c-2, D42, D43, D48) on the hand-drawn campus in `fixture.ts` (alphaCampus).
// Every number is worked by hand: walking is meters ÷ 1.3 m/s, stairs 20 s a floor, elevator 180 s once per ride + 5 s
// a floor, Auto = elevator for 3 floors or more. Entrances: 0 = alpha's main door M, 1 = its side door S, 2 = beta's.
import { describe, expect, it } from 'vitest';
import type { Doors, FloorMode, From, IndoorFiles, Route, RouteResult, To } from '@/shared/data/route';
import { alphaCampus, alphaRooms, alphaSpec, fixtureIndoor } from './fixture';
import { createRouter } from './router';

const alpha = fixtureIndoor(alphaSpec).file;
/** The same building with an elevator that skips 3F. */
const skipStop = fixtureIndoor({
  ...alphaSpec,
  links: [
    ...alphaSpec.links.filter(([a, b]) => !(a === 'el2' && b === 'el3') && a !== 'el3'),
    ['el2', 'el4', 'elevator'],
  ],
  verticals: [
    alphaSpec.verticals?.[0] ?? { id: '', kind: 'stairs', servesFloors: [], stops: [] },
    { id: 'elevator', kind: 'elevator', servesFloors: [1, 2, 4], stops: ['el1', 'el2', 'el4'] },
  ],
}).file;

const router = createRouter(alphaCampus, alphaRooms);
const files: IndoorFiles = new Map([['alpha', alpha]]);
const none: IndoorFiles = new Map();
const ok = (result: RouteResult): Route => {
  if (!result.ok) throw new Error(`no route: ${result.reason}`);
  return result.route;
};
const go = (from: From, to: To, doors?: Doors, mode: FloorMode = 'auto', indoor: IndoorFiles = files) =>
  ok(router(from, to, mode, indoor, doors));
const walking = (meters: number) => meters / 1.3;
const diagonal = Math.hypot(100, 100);

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
  entrance: 1,
  verified: false,
  at: [100, 100],
} as const;
const betaMain = { kind: 'door', building: 'beta', door: 'main', entrance: 2, verified: false, at: [-100, 0] } as const;

const g1 = { kind: 'gate', gate: 'g1' } as const;
const beta = { kind: 'building', building: 'beta' } as const;
const room = (code: string) => ({ kind: 'room', code }) as const;
const tap = (floor: number, spot?: Extract<From, { kind: 'building' }>['spot']): From => ({
  kind: 'building',
  building: 'alpha',
  floor,
  ...(spot === undefined ? {} : { spot }),
});
const stairs = { kind: 'vertical', id: 'west-stairs' } as const;
const elevator = { kind: 'vertical', id: 'elevator' } as const;
const door = (entrance: number) => ({ kind: 'entrance', entrance }) as const;
const unknown = { ok: false, reason: 'unknown-place' } as const;

describe('no spot and no doors', () => {
  it('routes exactly as before 8c-2', () => {
    const trips: [From, To][] = [
      [tap(3), beta],
      [g1, room('AL401')],
      [room('AL101'), beta],
      [tap(1), room('AL205')],
    ];
    for (const [from, to] of trips) {
      const before = router(from, to, 'auto', files);
      expect(router(from, to, 'auto', files, {})).toStrictEqual(before);
      expect(router(from, to, 'auto', files, undefined)).toStrictEqual(before);
    }
  });

  it('names the door every walk ends at by its entrance index', () => {
    const r = go(g1, room('AL101'));
    expect(r.legs[0]).toMatchObject({ from: { kind: 'gate', gate: 'g1' }, to: alphaMain });
    expect(go(room('AL401'), beta).legs.find((l) => l.kind === 'walk')).toMatchObject({
      from: alphaSide,
      to: betaMain,
    });
  });
});

describe('a spot at a stairs or the elevator', () => {
  it('starts 3F at the west stairs instead of the elevator lobby, and goes straight down them', () => {
    // The stairs: down 2 (40 s), 15 m to M, 200 m to beta. From the elevator lobby it was 110 m more on 3F.
    const r = go(tap(3, stairs), beta);
    expect(r.legs).toStrictEqual([
      {
        kind: 'floors',
        building: 'alpha',
        from: 3,
        to: 1,
        by: 'stairs',
        seconds: 40,
        via: 'west-stairs',
        at: [0, 115],
      },
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 1,
        path: [
          [0, 115],
          [0, 110],
          [0, 100],
        ],
        meters: 15,
        seconds: 12,
      },
      {
        kind: 'walk',
        from: alphaMain,
        to: betaMain,
        path: [
          [0, 100],
          [0, 0],
          [-100, 0],
        ],
        meters: 200,
        seconds: 154,
      },
    ]);
    expect(r.steps[0]).toMatchObject({ kind: 'floors', leg: 0, text: 'Take the west stairs down to G' });
    expect([r.meters, r.seconds]).toStrictEqual([215, Math.round(walking(215) + 40)]);
  });

  it('names the spot in the start step when the route walks from it first', () => {
    // Elevator from the west stairs: 110 m along 3F, down 2 (190 s), then the side door, 15 m + 241 m outside.
    const r = go(tap(3, stairs), beta, undefined, 'elevator');
    expect(r.steps[0]).toStrictEqual({
      kind: 'start',
      leg: 0,
      at: [0, 115],
      meters: 110,
      text: 'Start at the west stairs',
    });
    expect(r.legs[1]).toMatchObject({ kind: 'floors', by: 'elevator', from: 3, to: 1, seconds: 190 });
    expect(r.legs.at(-1)).toMatchObject({ kind: 'walk', from: alphaSide });
    expect(r.meters).toBe(Math.round(110 + 15 + diagonal + 100));
  });

  it('uses a spot on G too: from the elevator, out by the nearer side door', () => {
    const r = go(tap(1, elevator), beta);
    expect(r.legs).toStrictEqual([
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 1,
        path: [
          [100, 115],
          [100, 110],
          [100, 100],
        ],
        meters: 15,
        seconds: 12,
      },
      {
        kind: 'walk',
        from: alphaSide,
        to: betaMain,
        path: [
          [100, 100],
          [0, 0],
          [-100, 0],
        ],
        meters: 241,
        seconds: Math.round(walking(diagonal + 100)),
      },
    ]);
    expect(r.steps[0]).toMatchObject({ kind: 'start', at: [100, 115], meters: 15, text: 'Start at the elevator' });
  });

  it('applies inside one building: 3F west stairs to AL205 is one flight down and 60 m', () => {
    const r = go(tap(3, stairs), room('AL205'));
    expect(r.legs[0]).toMatchObject({ kind: 'floors', from: 3, to: 2, via: 'west-stairs' });
    expect([r.meters, r.seconds]).toStrictEqual([60, Math.round(walking(60) + 20)]);
  });

  it('is unknown-place when the id isn’t in the file, or has no stop on that floor', () => {
    expect(router(tap(3, { kind: 'vertical', id: 'north-stairs' }), beta, 'auto', files)).toStrictEqual(unknown);
    expect(router(tap(3, elevator), beta, 'auto', new Map([['alpha', skipStop]]))).toStrictEqual(unknown);
    expect(router(tap(3, { kind: 'vertical', id: 'north-stairs' }), room('AL205'), 'auto', files)).toStrictEqual(
      unknown,
    );
  });

  it('routes as without a spot when the building file isn’t there, and names the building', () => {
    const r = router(tap(3, stairs), beta, 'auto', none);
    expect(r).toStrictEqual(router(tap(3), beta, 'auto', none));
    expect(ok(r).noIndoorMap).toStrictEqual(['alpha']);
  });
});

describe('a spot at a door', () => {
  it('starts the walk at that door, with no walk inside and no building file needed', () => {
    const expected = [
      {
        kind: 'walk',
        from: alphaSide,
        to: betaMain,
        path: [
          [100, 100],
          [0, 0],
          [-100, 0],
        ],
        meters: 241,
        seconds: Math.round(walking(diagonal + 100)),
      },
    ];
    const withFile = go(tap(1, door(1)), beta);
    expect(withFile.legs).toStrictEqual(expected);
    expect(withFile.noIndoorMap).toBeUndefined();
    const without = go(tap(1, door(1)), beta, undefined, 'auto', none);
    expect(without.legs).toStrictEqual(expected);
    expect(without.noIndoorMap).toBeUndefined();
  });

  it('starts at that door for a room in the same building', () => {
    // S to the west stairs along G (115 m), up 1 (20 s), 60 m along 2F.
    const r = go(tap(1, door(1)), room('AL205'));
    expect(r.legs[0]).toStrictEqual({
      kind: 'indoor',
      building: 'alpha',
      floor: 1,
      path: [
        [100, 100],
        [100, 110],
        [50, 110],
        [0, 110],
        [0, 115],
      ],
      meters: 115,
      seconds: Math.round(walking(115)),
    });
    expect(r.steps[0]).toMatchObject({ kind: 'start', at: [100, 100], text: 'Start at the side entrance' });
    expect([r.meters, r.seconds]).toStrictEqual([175, Math.round(walking(175) + 20)]);
  });

  it('is unknown-place off G, or at a door of another building, or one that doesn’t exist', () => {
    expect(router(tap(3, door(0)), beta, 'auto', files)).toStrictEqual(unknown);
    expect(router(tap(1, door(2)), beta, 'auto', files)).toStrictEqual(unknown);
    expect(router(tap(1, door(99)), beta, 'auto', files)).toStrictEqual(unknown);
  });
});

describe('the exit choice', () => {
  it('leaves 3F by the side door when asked, though the main door is quicker', () => {
    // 110 m along 3F to the west stairs (Auto, 2 floors), down 2, 115 m along G to S, 241 m outside.
    const r = go(tap(3), beta, { exit: 1 });
    expect(r.legs.at(-1)).toStrictEqual({
      kind: 'walk',
      from: alphaSide,
      to: betaMain,
      path: [
        [100, 100],
        [0, 0],
        [-100, 0],
      ],
      meters: 241,
      seconds: Math.round(walking(diagonal + 100)),
    });
    expect(r.meters).toBe(Math.round(110 + 115 + diagonal + 100));
    expect(r.seconds).toBe(Math.round(walking(110 + 115 + diagonal + 100) + 40));
  });

  it('overrides the main-door rule for a G tap, with no file', () => {
    const r = go(tap(1), beta, { exit: 1 }, 'auto', none);
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0]).toMatchObject({ kind: 'walk', from: alphaSide, meters: 241 });
  });

  it('leaves a room by the asked door: AL401 by the main door, not the side door by the elevator', () => {
    const r = go(room('AL401'), beta, { exit: 0 });
    expect(r.legs.at(-1)).toMatchObject({ kind: 'walk', from: alphaMain, meters: 200 });
  });

  it('keeps the floors leg and starts the walk at the door when there is no file', () => {
    const r = go(tap(3), beta, { exit: 1 }, 'auto', none);
    expect(r.legs).toStrictEqual([
      { kind: 'floors', building: 'alpha', from: 3, to: 1, by: 'stairs', seconds: 40 },
      {
        kind: 'walk',
        from: alphaSide,
        to: betaMain,
        path: [
          [100, 100],
          [0, 0],
          [-100, 0],
        ],
        meters: 241,
        seconds: Math.round(walking(diagonal + 100)),
      },
    ]);
    expect(r.noIndoorMap).toStrictEqual(['alpha']);
  });

  it('works with a spot: from the G elevator out by the main door', () => {
    const r = go(tap(1, elevator), beta, { exit: 0 });
    expect(r.legs[0]).toMatchObject({ kind: 'indoor', floor: 1, meters: 115 });
    expect(r.legs[1]).toMatchObject({ kind: 'walk', from: alphaMain, meters: 200 });
  });

  it('is unknown-place for a door that isn’t From’s building’s', () => {
    expect(router(tap(3), beta, 'auto', files, { exit: 2 })).toStrictEqual(unknown);
    expect(router(tap(3), beta, 'auto', files, { exit: 99 })).toStrictEqual(unknown);
    expect(router(room('AL101'), beta, 'auto', files, { exit: 2 })).toStrictEqual(unknown);
  });

  it('is ignored from a gate, and when the spot is a door', () => {
    expect(router(g1, beta, 'auto', files, { exit: 0 })).toStrictEqual(router(g1, beta, 'auto', files));
    expect(go(tap(1, door(1)), beta, { exit: 0 }).legs[0]).toMatchObject({ kind: 'walk', from: alphaSide });
  });
});

describe('the entrance choice', () => {
  it('goes in by the asked door: the main door for AL401, not the side door by the elevator', () => {
    const r = go(g1, room('AL401'), { entrance: 0 });
    expect(r.legs[0]).toMatchObject({ kind: 'walk', to: alphaMain, meters: 100 });
  });

  it('is unknown-place for a door that isn’t To’s building’s, and changes nothing for its only door', () => {
    expect(router(g1, room('AL401'), 'auto', files, { entrance: 2 })).toStrictEqual(unknown);
    expect(router(g1, beta, 'auto', files, { entrance: 2 })).toStrictEqual(router(g1, beta, 'auto', files));
  });
});

describe('a trip inside one building', () => {
  it('ignores the doors, even ones that aren’t its own', () => {
    const before = router(room('AL207'), room('AL205'), 'auto', files);
    expect(router(room('AL207'), room('AL205'), 'auto', files, { exit: 1, entrance: 99 })).toStrictEqual(before);
    expect(router(tap(1), room('AL205'), 'auto', files, { exit: 1 })).toStrictEqual(
      router(tap(1), room('AL205'), 'auto', files),
    );
  });
});
