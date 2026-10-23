// The router going inside (8b, D41) on a hand-drawn campus and building. Every number is worked by hand: walking is
// meters ÷ 1.3 m/s, stairs 20 s a floor, elevator 180 s once per ride + 5 s a floor, Auto = elevator for 3 floors or
// more. Steps follow D35 and D41: turns only at junctions, named by a room door within 5 m; the side on arrival.
//
// The campus is drawn in `fixture.ts` (alphaCampus).
import { describe, expect, it } from 'vitest';
import type { From, IndoorFiles, Route, RouteResult, To } from '@/shared/data/route';
import { alphaCampus, alphaRooms, alphaSpec, fixtureIndoor } from './fixture';
import { createRouter } from './router';

const campus = alphaCampus;
const rooms = alphaRooms;
const spec = alphaSpec;
const alpha = fixtureIndoor(spec).file;
/** The same building with an elevator that skips 3F. */
const skipStop = fixtureIndoor({
  ...spec,
  links: [...spec.links.filter(([a, b]) => !(a === 'el2' && b === 'el3') && a !== 'el3'), ['el2', 'el4', 'elevator']],
  verticals: [
    spec.verticals?.[0] ?? { id: '', kind: 'stairs', servesFloors: [], stops: [] },
    { id: 'elevator', kind: 'elevator', servesFloors: [1, 2, 4], stops: ['el1', 'el2', 'el4'] },
  ],
}).file;
/** The same building with no elevator at all. */
const noLift = fixtureIndoor({
  ...spec,
  links: spec.links.filter(([, , kind]) => kind !== 'elevator'),
  verticals: spec.verticals?.filter((v) => v.kind === 'stairs') ?? [],
}).file;

const router = createRouter(campus, rooms);
const files: IndoorFiles = new Map([['alpha', alpha]]);
const room = (code: string) => ({ kind: 'room', code }) as const;
const ok = (result: RouteResult): Route => {
  if (!result.ok) throw new Error(`no route: ${result.reason}`);
  return result.route;
};
const go = (from: From, to: To, mode: 'auto' | 'stairs' | 'elevator' = 'auto', indoor: IndoorFiles = files) =>
  ok(router(from, to, mode, indoor));
const walking = (meters: number) => meters / 1.3;

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
  entrance: 1,
  verified: false,
  at: [100, 100],
} as const;
const betaMain = { kind: 'door', building: 'beta', door: 'main', entrance: 2, verified: false, at: [-100, 0] } as const;
const diagonal = Math.hypot(100, 100);

describe('routes that go inside a building with labelled floors', () => {
  it('walks in by the main door and along G to a room, and says which side it is on', () => {
    const r = go({ kind: 'gate', gate: 'g1' }, room('AL101'));
    expect(r.legs).toStrictEqual([
      {
        kind: 'walk',
        from: gate,
        to: alphaMain,
        path: [
          [0, 0],
          [0, 100],
        ],
        meters: 100,
        seconds: 77,
      },
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 1,
        path: [
          [0, 100],
          [0, 110],
          [50, 110],
          [50, 115],
        ],
        meters: 65,
        seconds: 50,
      },
    ]);
    expect(r.steps).toStrictEqual([
      { kind: 'start', leg: 0, at: [0, 0], meters: 100, text: 'Start at Gate g1' },
      {
        kind: 'enter',
        leg: 0,
        building: 'alpha',
        at: [0, 100],
        approximate: true,
        meters: 10,
        text: 'Enter Alpha by the main entrance (approximate)',
      },
      { kind: 'turn', leg: 1, at: [0, 110], meters: 55, turn: 'right', text: 'Turn right' },
      { kind: 'arrive', leg: 1, code: 'AL101', side: 'left', at: [50, 115], text: 'AL101 is on your left' },
    ]);
    expect([r.meters, r.seconds, r.noIndoorMap]).toStrictEqual([165, Math.round(walking(165)), undefined]);
  });

  it('takes the named stairs up on Auto for one floor, and names a turn by the room beside it', () => {
    const r = go({ kind: 'gate', gate: 'g1' }, room('AL205'));
    expect(r.legs.slice(1)).toStrictEqual([
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 1,
        path: [
          [0, 100],
          [0, 110],
          [0, 115],
        ],
        meters: 15,
        seconds: 12,
      },
      {
        kind: 'floors',
        building: 'alpha',
        from: 1,
        to: 2,
        by: 'stairs',
        seconds: 20,
        via: 'west-stairs',
        at: [0, 115],
      },
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 2,
        path: [
          [0, 115],
          [0, 110],
          [20, 110],
          [50, 110],
          [50, 105],
        ],
        meters: 60,
        seconds: 46,
      },
    ]);
    expect(r.steps.slice(1)).toStrictEqual([
      {
        kind: 'enter',
        leg: 0,
        building: 'alpha',
        at: [0, 100],
        approximate: true,
        meters: 15,
        text: 'Enter Alpha by the main entrance (approximate)',
      },
      {
        kind: 'floors',
        leg: 2,
        building: 'alpha',
        to: 2,
        by: 'stairs',
        at: [0, 115],
        meters: 5,
        text: 'AL205 is on 2F: take the west stairs up to 2F',
      },
      { kind: 'turn', leg: 3, at: [0, 110], meters: 55, turn: 'left', text: 'Turn left at AL201' },
      { kind: 'arrive', leg: 3, code: 'AL205', side: 'right', at: [50, 105], text: 'AL205 is on your right' },
    ]);
    expect([r.meters, r.seconds]).toStrictEqual([175, Math.round(walking(175) + 20)]);
  });

  it('picks the door by the whole trip: the side door is further outside but next to the elevator', () => {
    // Main: 100 m + 115 m inside. Side: 141 m + 15 m inside. Outside alone, the main door would win.
    const r = go({ kind: 'gate', gate: 'g1' }, room('AL401'));
    expect(r.legs).toStrictEqual([
      {
        kind: 'walk',
        from: gate,
        to: alphaSide,
        path: [
          [0, 0],
          [100, 100],
        ],
        meters: 141,
        seconds: Math.round(walking(diagonal)),
      },
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 1,
        path: [
          [100, 100],
          [100, 110],
          [100, 115],
        ],
        meters: 15,
        seconds: 12,
      },
      {
        kind: 'floors',
        building: 'alpha',
        from: 1,
        to: 4,
        by: 'elevator',
        seconds: 195,
        via: 'elevator',
        at: [100, 115],
      },
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 4,
        path: [
          [100, 115],
          [100, 110],
          [60, 110],
          [60, 105],
        ],
        meters: 50,
        seconds: 38,
      },
    ]);
    expect(r.steps.slice(1)).toStrictEqual([
      {
        kind: 'enter',
        leg: 0,
        building: 'alpha',
        at: [100, 100],
        approximate: true,
        meters: 15,
        text: 'Enter Alpha by the side entrance (approximate)',
      },
      {
        kind: 'floors',
        leg: 2,
        building: 'alpha',
        to: 4,
        by: 'elevator',
        at: [100, 115],
        meters: 50,
        text: 'AL401 is on 4F: take the elevator up to 4F',
      },
      { kind: 'arrive', leg: 3, code: 'AL401', side: 'left', at: [60, 105], text: 'AL401 is on your left' },
    ]);
    expect([r.meters, r.seconds]).toStrictEqual([206, Math.round(walking(diagonal + 65) + 195)]);
  });

  it('on Stairs, climbs 3 floors in one go and never waits for the elevator', () => {
    const r = go({ kind: 'gate', gate: 'g1' }, room('AL401'), 'stairs');
    expect(r.legs.map((l) => (l.kind === 'floors' ? `${l.by} ${String(l.from)}-${String(l.to)}` : l.kind))).toEqual([
      'walk',
      'indoor',
      'stairs 1-4',
      'indoor',
    ]);
    expect(r.legs[0]).toMatchObject({ to: alphaMain, meters: 100 });
    expect(r.legs[2]).toMatchObject({ seconds: 60, via: 'west-stairs' });
    expect(r.legs[3]).toMatchObject({
      path: [
        [0, 115],
        [0, 110],
        [60, 110],
        [60, 105],
      ],
      meters: 70,
    });
    expect(r.steps.at(-2)).toMatchObject({ text: 'AL401 is on 4F: take the west stairs up to 4F', meters: 70 });
    expect(r.steps.at(-1)).toMatchObject({ kind: 'arrive', side: 'right' });
    expect(r.seconds).toBe(Math.round(walking(185) + 60));
  });

  it('on Elevator, rides one floor, waiting once', () => {
    const r = go({ kind: 'gate', gate: 'g1' }, room('AL205'), 'elevator');
    expect(r.legs[0]).toMatchObject({ to: alphaSide });
    expect(r.legs[2]).toStrictEqual({
      kind: 'floors',
      building: 'alpha',
      from: 1,
      to: 2,
      by: 'elevator',
      seconds: 185,
      via: 'elevator',
      at: [100, 115],
    });
    expect(r.legs[3]).toMatchObject({
      path: [
        [100, 115],
        [100, 110],
        [50, 110],
        [50, 105],
      ],
      meters: 60,
    });
    expect(r.steps.at(-1)).toMatchObject({ kind: 'arrive', code: 'AL205', side: 'left' });
  });

  it('rides an elevator that skips the floor as far as it helps, then takes the stairs', () => {
    const r = go({ kind: 'gate', gate: 'g1' }, room('AL301'), 'elevator', new Map([['alpha', skipStop]]));
    expect(r.legs.slice(1)).toStrictEqual([
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 1,
        path: [
          [100, 100],
          [100, 110],
          [100, 115],
        ],
        meters: 15,
        seconds: 12,
      },
      {
        kind: 'floors',
        building: 'alpha',
        from: 1,
        to: 2,
        by: 'elevator',
        seconds: 185,
        via: 'elevator',
        at: [100, 115],
      },
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 2,
        path: [
          [100, 115],
          [100, 110],
          [50, 110],
          [20, 110],
          [0, 110],
          [0, 115],
        ],
        meters: 110,
        seconds: 85,
      },
      {
        kind: 'floors',
        building: 'alpha',
        from: 2,
        to: 3,
        by: 'stairs',
        seconds: 20,
        via: 'west-stairs',
        at: [0, 115],
      },
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 3,
        path: [
          [0, 115],
          [0, 110],
          [50, 110],
          [50, 105],
        ],
        meters: 60,
        seconds: 46,
      },
    ]);
    expect(r.steps.slice(2).map((s) => [s.text, 'meters' in s ? s.meters : null])).toStrictEqual([
      ['Take the elevator up to 2F', 110],
      ['AL301 is on 3F: take the west stairs up to 3F', 60],
      ['AL301 is on your right', null],
    ]);
    expect([r.meters, r.seconds]).toStrictEqual([326, Math.round(walking(diagonal + 185) + 205)]);
  });

  it('never climbs by a link between floors whose ends aren’t stairs or elevator stops', () => {
    // A made-up shortcut from G's middle straight up to 2F's: no stop at either end, so it isn't a way up.
    const odd = fixtureIndoor({ ...spec, links: [...spec.links, ['h1m', 'h2m', 'stairs']] }).file;
    const r = go({ kind: 'gate', gate: 'g1' }, room('AL205'), 'auto', new Map([['alpha', odd]]));
    expect(r.legs[2]).toMatchObject({ kind: 'floors', via: 'west-stairs' });
  });

  it('takes the stairs when Elevator is asked for in a building with none, and says so', () => {
    const r = go({ kind: 'gate', gate: 'g1' }, room('AL205'), 'elevator', new Map([['alpha', noLift]]));
    expect(r.legs[2]).toMatchObject({ kind: 'floors', by: 'stairs', via: 'west-stairs', noElevator: true });
  });
});

describe('routes that start inside', () => {
  it('goes from room to room on one floor, without naming the room it starts from', () => {
    const r = go(room('AL207'), room('AL205'));
    expect(r.legs).toStrictEqual([
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 2,
        path: [
          [20, 115],
          [20, 110],
          [50, 110],
          [50, 105],
        ],
        meters: 40,
        seconds: 31,
      },
    ]);
    expect(r.steps).toStrictEqual([
      { kind: 'start', leg: 0, at: [20, 115], meters: 5, text: 'Start at AL207' },
      { kind: 'turn', leg: 0, at: [20, 110], meters: 35, turn: 'left', text: 'Turn left' },
      { kind: 'arrive', leg: 0, code: 'AL205', side: 'right', at: [50, 105], text: 'AL205 is on your right' },
    ]);
  });

  it('starts a G tap at the main entrance when the room is in the same building', () => {
    const r = go({ kind: 'building', building: 'alpha', floor: 1 }, room('AL205'));
    expect(r.legs.map((l) => l.kind)).toEqual(['indoor', 'floors', 'indoor']);
    expect(r.steps[0]).toStrictEqual({
      kind: 'start',
      leg: 0,
      at: [0, 100],
      meters: 15,
      text: 'Start at the main entrance',
    });
    expect([r.meters, r.seconds]).toStrictEqual([75, Math.round(walking(75) + 20)]);
  });

  it('leaves from a room on G to another building, then walks', () => {
    const r = go(room('AL101'), { kind: 'building', building: 'beta' });
    expect(r.legs).toStrictEqual([
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 1,
        path: [
          [50, 115],
          [50, 110],
          [0, 110],
          [0, 100],
        ],
        meters: 65,
        seconds: 50,
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
    expect(r.steps).toStrictEqual([
      { kind: 'start', leg: 0, at: [50, 115], meters: 5, text: 'Start at AL101' },
      { kind: 'turn', leg: 0, at: [50, 110], meters: 60, turn: 'right', text: 'Turn right' },
      {
        kind: 'start',
        leg: 1,
        at: [0, 100],
        meters: 100,
        approximate: true,
        text: 'Leave Alpha by the main entrance (approximate)',
      },
      { kind: 'turn', leg: 1, at: [0, 0], meters: 100, turn: 'right', text: 'Turn right' },
      {
        kind: 'enter',
        leg: 1,
        building: 'beta',
        at: [-100, 0],
        approximate: true,
        text: 'Enter Beta by the main entrance (approximate)',
      },
    ]);
  });

  it('leaves from 4F by the door nearest the elevator, though the walk outside is longer', () => {
    const r = go(room('AL401'), { kind: 'building', building: 'beta' });
    expect(r.legs).toStrictEqual([
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 4,
        path: [
          [60, 105],
          [60, 110],
          [100, 110],
          [100, 115],
        ],
        meters: 50,
        seconds: 38,
      },
      {
        kind: 'floors',
        building: 'alpha',
        from: 4,
        to: 1,
        by: 'elevator',
        seconds: 195,
        via: 'elevator',
        at: [100, 115],
      },
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
    expect([r.meters, r.seconds]).toStrictEqual([306, Math.round(walking(65 + diagonal + 100) + 195)]);
  });

  it('starts an upper-floor tap at the elevator, and takes the stairs down on Auto for 2 floors', () => {
    const r = go({ kind: 'building', building: 'alpha', floor: 3 }, { kind: 'building', building: 'beta' });
    expect(r.legs.slice(0, 3)).toStrictEqual([
      {
        kind: 'indoor',
        building: 'alpha',
        floor: 3,
        path: [
          [100, 115],
          [100, 110],
          [50, 110],
          [0, 110],
          [0, 115],
        ],
        meters: 110,
        seconds: 85,
      },
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
    ]);
    expect(r.steps.slice(0, 3)).toStrictEqual([
      { kind: 'start', leg: 0, at: [100, 115], meters: 110, text: 'Start at the elevator' },
      {
        kind: 'floors',
        leg: 1,
        building: 'alpha',
        to: 1,
        by: 'stairs',
        at: [0, 115],
        meters: 15,
        text: 'Take the west stairs down to G',
      },
      {
        kind: 'start',
        leg: 3,
        at: [0, 100],
        meters: 100,
        approximate: true,
        text: 'Leave Alpha by the main entrance (approximate)',
      },
    ]);
  });
});

describe('routes where the floor plan is missing', () => {
  it('stops at the door when no building file was given, and says which building', () => {
    const r = ok(router({ kind: 'gate', gate: 'g1' }, room('AL101'), 'auto'));
    expect(r.legs).toStrictEqual([
      {
        kind: 'walk',
        from: gate,
        to: alphaMain,
        path: [
          [0, 0],
          [0, 100],
        ],
        meters: 100,
        seconds: 77,
      },
    ]);
    expect(r.steps.at(-1)).toMatchObject({ kind: 'enter', building: 'alpha' });
    expect(r.steps.at(-1)).not.toHaveProperty('meters');
    expect(r.noIndoorMap).toStrictEqual(['alpha']);
  });

  it('routes as before 8b to a room on a floor that isn’t traced', () => {
    const r = go({ kind: 'gate', gate: 'g1' }, room('AL502'));
    expect(r.legs).toStrictEqual([
      {
        kind: 'walk',
        from: gate,
        to: alphaMain,
        path: [
          [0, 0],
          [0, 100],
        ],
        meters: 100,
        seconds: 77,
      },
      { kind: 'floors', building: 'alpha', from: 1, to: 5, by: 'elevator', seconds: 200 },
    ]);
    expect(r.steps.at(-1)?.text).toBe('AL502 is on 5F: take the elevator up to 5F');
    expect(r.noIndoorMap).toStrictEqual(['alpha']);
  });

  it('stays on floors legs within a building when one end has no plan', () => {
    const r = go(room('AL101'), room('AL502'));
    expect(r.legs).toStrictEqual([{ kind: 'floors', building: 'alpha', from: 1, to: 5, by: 'elevator', seconds: 200 }]);
    expect(r.noIndoorMap).toStrictEqual(['alpha']);
  });

  it('needs no plan to walk to a building, or from its ground floor', () => {
    const r = go({ kind: 'building', building: 'alpha', floor: 1 }, { kind: 'building', building: 'beta' });
    expect(r.legs.map((l) => l.kind)).toEqual(['walk']);
    expect(r.noIndoorMap).toBeUndefined();
    expect(go({ kind: 'gate', gate: 'g1' }, room('BE101'), 'auto', new Map()).noIndoorMap).toStrictEqual(['beta']);
  });
});
