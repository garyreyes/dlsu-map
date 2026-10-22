// The step player (S6, S9) has one right answer per step: which step the card shows, where the camera and the dot go
// (D44), and what Find next room sets From to. A wrong answer flies the camera to the wrong floor or sends the next
// search from the wrong place, and looks just as plausible on screen. Exact values throughout.
import { describe, expect, it } from 'vitest';
import type { Route } from '@/shared/data/route';
import {
  sampleGateRoute,
  sampleIndoorRoute,
  sampleNoIndoorMap,
  sampleRoute,
  sampleTurnSteps,
} from '@/shared/data/route.sample';
import { arrivedHeading, clampStep, indoorMapComing, nextFrom, stepCard, stepFocus, type StepFocus } from './player';
import { placeNames } from './steps-list';

const names = placeNames({
  buildings: [
    { slug: 'andrew', short: 'Andrew' },
    { slug: 'strc', short: 'STRC', floorLabels: { '1': 'G' } },
    { slug: 'velasco', short: 'Velasco' },
  ],
  gates: [{ id: 'gate-2', name: 'Gate 2 (North)' }],
});

const empty: Route = { legs: [], steps: [], meters: 0, seconds: 0 };

describe('clampStep', () => {
  it('keeps the step inside the route', () => {
    expect(clampStep(sampleRoute, -1)).toBe(0);
    expect(clampStep(sampleRoute, 2)).toBe(2);
    expect(clampStep(sampleRoute, 5)).toBe(4);
    expect(clampStep(sampleRoute, 99)).toBe(4);
  });

  it('is 0 for a route with no steps', () => {
    expect(clampStep(empty, 3)).toBe(0);
  });
});

describe('stepCard', () => {
  it('counts from 1 and shows the step as the list does', () => {
    expect(stepCard(sampleRoute, 1)).toEqual({
      counter: 'Step 2 of 5',
      icon: 'start',
      title: 'Leave Andrew by the main entrance',
      subtitle: '45 m · approximate',
      first: false,
      last: false,
    });
  });

  it('marks the first step, so Back is off', () => {
    expect(stepCard(sampleRoute, 0)).toEqual({
      counter: 'Step 1 of 5',
      icon: 'elevator-down',
      title: 'Take the elevator down to 1F',
      first: true,
      last: false,
    });
  });

  it('marks the last step, so Next reads "I’m here"', () => {
    expect(stepCard(sampleIndoorRoute, 4)).toEqual({
      counter: 'Step 5 of 5',
      icon: 'arrive',
      title: 'ST311 is on your right',
      first: false,
      last: true,
    });
  });

  it('marks a one-step route as both first and last', () => {
    const one: Route = { ...sampleRoute, steps: [sampleTurnSteps[1]] };
    expect(stepCard(one, 0)).toMatchObject({ counter: 'Step 1 of 1', first: true, last: true });
  });
});

describe('stepFocus', () => {
  it('flies to a walk step’s spot, facing the next point of the walk', () => {
    expect(stepFocus(sampleRoute, 1)).toEqual({ kind: 'ground', at: [-93.8, 250.2], toward: [-100, 205] });
    expect(stepFocus(sampleRoute, 2)).toEqual({ kind: 'ground', at: [-100, 205], toward: [-85.6, 196] });
  });

  it('faces on through the door at the walk’s end, the way the student walks in', () => {
    // The last stretch runs from the bend (-100, 205) to the door (-85.6, 196); it carries on the same again.
    const focus = stepFocus(sampleRoute, 3);
    expect(focus).toEqual({ kind: 'ground', at: [-85.6, 196], toward: [-71.2, 187] });
  });

  it('frames a floors step on the floor it leaves from, with no spot when the floor is not labelled', () => {
    expect(stepFocus(sampleRoute, 0)).toEqual({ kind: 'floor', building: 'andrew', floor: 11, goal: 1 });
    expect(stepFocus(sampleRoute, 4)).toEqual({ kind: 'floor', building: 'strc', floor: 1, goal: 3 });
  });

  it('puts a floors step at its stairs, with nothing to face since the student is about to climb (7▸)', () => {
    expect(stepFocus(sampleIndoorRoute, 2)).toEqual({
      kind: 'floor',
      building: 'strc',
      floor: 1,
      at: [-83.3, 188.3],
      toward: null,
      goal: 3,
    });
  });

  it('takes a floors step’s spot from its leg when the step has none', () => {
    const route: Route = {
      ...sampleIndoorRoute,
      steps: [{ kind: 'floors', leg: 2, building: 'strc', to: 3, by: 'stairs', text: 'Take the stairs up to 3F' }],
    };
    expect(stepFocus(route, 0)).toEqual({
      kind: 'floor',
      building: 'strc',
      floor: 1,
      at: [-83.3, 188.3],
      toward: null,
      goal: 3,
    });
  });

  it('puts an indoor turn and the arrive step at their spot, facing the way along the hallway (7▸)', () => {
    // The turn at (-96, 187) is 14 m from the door, so the camera faces the door: the walk's end.
    expect(stepFocus(sampleIndoorRoute, 3)).toEqual({
      kind: 'floor',
      building: 'strc',
      floor: 3,
      at: [-96, 187],
      toward: [-108.2, 180.1],
      goal: 3,
    });
    // At the door itself the last stretch carries on as far again.
    expect(stepFocus(sampleIndoorRoute, 4)).toEqual({
      kind: 'floor',
      building: 'strc',
      floor: 3,
      at: [-108.2, 180.1],
      toward: [-120.4, 173.2],
      goal: 3,
    });
  });

  it('marks the floor the route climbs to as the goal of a step on the ground floor', () => {
    const route: Route = {
      ...sampleIndoorRoute,
      steps: [
        { kind: 'turn', leg: 1, at: [-85, 194], meters: 4, turn: 'left', text: 'Turn left' },
        ...sampleIndoorRoute.steps,
      ],
    };
    expect(stepFocus(route, 0)).toEqual({
      kind: 'floor',
      building: 'strc',
      floor: 1,
      at: [-85, 194],
      toward: [-83.3, 188.3],
      goal: 3,
    });
  });

  it('marks the ground floor as the goal of a step on the way out of the From building', () => {
    const route: Route = {
      legs: [
        {
          kind: 'indoor',
          building: 'strc',
          floor: 3,
          path: [
            [0, 0],
            [10, 0],
            [30, 0],
          ],
          meters: 30,
          seconds: 20,
        },
        { kind: 'floors', building: 'strc', from: 3, to: 1, by: 'stairs', seconds: 40, at: [30, 0] },
        {
          kind: 'indoor',
          building: 'strc',
          floor: 1,
          path: [
            [30, 0],
            [30, 20],
          ],
          meters: 20,
          seconds: 15,
        },
        sampleGateRoute.legs[0],
      ],
      steps: [{ kind: 'turn', leg: 0, at: [10, 0], meters: 20, turn: 'left', text: 'Turn left' }],
      meters: 50,
      seconds: 100,
    };
    expect(stepFocus(route, 0)).toEqual({
      kind: 'floor',
      building: 'strc',
      floor: 3,
      at: [10, 0],
      toward: [30, 0],
      goal: 1,
    });
  });

  it('stops looking for the goal at the first leg in another building', () => {
    const route: Route = {
      legs: [
        { kind: 'floors', building: 'andrew', from: 11, to: 1, by: 'stairs', seconds: 1 },
        { kind: 'floors', building: 'strc', from: 1, to: 3, by: 'stairs', seconds: 1 },
      ],
      steps: [{ kind: 'floors', leg: 0, building: 'andrew', to: 1, by: 'stairs', text: 'Down' }],
      meters: 0,
      seconds: 2,
    };
    expect(stepFocus(route, 0)).toEqual({ kind: 'floor', building: 'andrew', floor: 11, goal: 1 });
  });

  it('starts a gate route on the ground at the gate', () => {
    expect(stepFocus(sampleGateRoute, 0)).toEqual({ kind: 'ground', at: [66.5, 50.4], toward: [-40, 120] });
  });

  it('faces past a short jog at the start, to the first point at least 15 m along the walk', () => {
    // Gate 2's real walk starts with a 2 m step off the curb before it heads west.
    const route: Route = {
      ...sampleGateRoute,
      legs: [
        {
          ...sampleGateRoute.legs[0],
          path: [
            [0, 0],
            [0, 2],
            [-30, 2],
            [-30, -40],
          ],
        },
      ],
      steps: [{ kind: 'start', leg: 0, at: [0, 0], meters: 30, text: 'Start at Gate 2 (North)' }],
    };
    expect(stepFocus(route, 0)).toEqual({ kind: 'ground', at: [0, 0], toward: [-30, 2] });
  });

  it('uses the nearest point of the walk when a step’s spot is not exactly on it', () => {
    const route: Route = {
      ...sampleGateRoute,
      steps: [{ kind: 'cross', leg: 0, at: [-40.2, 119.9], meters: 30, street: 'Taft Avenue', text: 'Cross' }],
    };
    expect(stepFocus(route, 0)).toEqual({ kind: 'ground', at: [-40.2, 119.9], toward: [-85.6, 196] });
  });

  it('is null for a step whose leg is missing, and for a route with no steps', () => {
    const broken: Route = { ...sampleRoute, steps: [{ ...sampleTurnSteps[0], leg: 9 }] };
    expect(stepFocus(broken, 0)).toBeNull();
    expect(stepFocus(empty, 0)).toBeNull();
  });

  it('reaches both kinds of focus', () => {
    const kinds = new Set(
      [sampleRoute, sampleIndoorRoute].flatMap((r) => r.steps.map((_, i) => stepFocus(r, i)?.kind)),
    );
    expect([...kinds].sort()).toEqual<StepFocus['kind'][]>(['floor', 'ground']);
  });
});

describe('nextFrom', () => {
  it('starts the next search from the room just reached', () => {
    expect(nextFrom({ kind: 'room', code: 'ST311' })).toEqual({ kind: 'room', code: 'ST311' });
  });

  it('starts from the building’s ground floor when the trip went to a building', () => {
    expect(nextFrom({ kind: 'building', building: 'strc' })).toEqual({ kind: 'building', building: 'strc', floor: 1 });
  });
});

describe('arrivedHeading', () => {
  it('says where the student is', () => {
    expect(arrivedHeading(sampleIndoorRoute, { kind: 'room', code: 'ST311' }, names)).toBe('You’re at ST311');
    expect(arrivedHeading(sampleGateRoute, { kind: 'building', building: 'strc' }, names)).toBe('You’re at STRC');
  });

  it('says the room is on this floor when the route had no steps', () => {
    expect(arrivedHeading(empty, { kind: 'room', code: 'ST311' }, names)).toBe('ST311 is on this floor.');
    expect(arrivedHeading(empty, { kind: 'building', building: 'strc' }, names)).toBe('You’re already in STRC.');
  });
});

describe('indoorMapComing', () => {
  const vl313 = { code: 'VL313', building: 'velasco', floor: 3 };

  it('gives the floor when the room’s building has no indoor map yet (O5)', () => {
    expect(indoorMapComing(sampleNoIndoorMap, vl313, names)).toBe('VL313 is on 3F · indoor map coming');
  });

  it('uses the building’s floor label', () => {
    const route: Route = { ...sampleNoIndoorMap, noIndoorMap: ['strc'] };
    expect(indoorMapComing(route, { code: 'ST105', building: 'strc', floor: 1 }, names)).toBe(
      'ST105 is on G · indoor map coming',
    );
  });

  it('says nothing when the room’s building has its map, or only From’s building lacks one', () => {
    expect(indoorMapComing(sampleIndoorRoute, { code: 'ST311', building: 'strc', floor: 3 }, names)).toBeNull();
    const fromOnly: Route = { ...sampleIndoorRoute, noIndoorMap: ['andrew'] };
    expect(indoorMapComing(fromOnly, { code: 'ST311', building: 'strc', floor: 3 }, names)).toBeNull();
  });

  it('says the map is still saving when the building file only failed offline', () => {
    expect(indoorMapComing(sampleNoIndoorMap, vl313, names, ['velasco'])).toBe(
      'VL313 is on 3F · indoor map still saving',
    );
  });

  it('keeps "coming" for a building that is not still saving', () => {
    expect(indoorMapComing(sampleNoIndoorMap, vl313, names, ['andrew'])).toBe('VL313 is on 3F · indoor map coming');
  });
});

describe('stepCard while a building’s map is still saving', () => {
  it('adds the note to its enter and floors steps, after the other parts', () => {
    expect(stepCard(sampleNoIndoorMap, 1, ['velasco'])?.subtitle).toBe('approximate · Indoor map still saving');
    expect(stepCard(sampleNoIndoorMap, 2, ['velasco'])?.subtitle).toBe('Indoor map still saving');
  });

  it('adds it to the start step that leaves that building', () => {
    expect(stepCard(sampleRoute, 1, ['andrew'])?.subtitle).toBe('45 m · approximate · Indoor map still saving');
  });

  it('leaves other steps alone', () => {
    expect(stepCard(sampleNoIndoorMap, 0, ['velasco'])?.subtitle).toBe('65 m');
    expect(stepCard(sampleRoute, 2, ['andrew'])?.subtitle).toBe('15 m');
    expect(stepCard(sampleNoIndoorMap, 2)?.subtitle).toBeUndefined();
  });
});
