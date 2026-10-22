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

  it('frames a floors step on the floor it leaves from', () => {
    expect(stepFocus(sampleRoute, 0)).toEqual({ kind: 'floor', building: 'andrew', floor: 11 });
    expect(stepFocus(sampleRoute, 4)).toEqual({ kind: 'floor', building: 'strc', floor: 1 });
    expect(stepFocus(sampleIndoorRoute, 2)).toEqual({ kind: 'floor', building: 'strc', floor: 1 });
  });

  it('frames an indoor turn and the arrive step on their floor (no cutaway until 7a, D44)', () => {
    expect(stepFocus(sampleIndoorRoute, 3)).toEqual({ kind: 'floor', building: 'strc', floor: 3 });
    expect(stepFocus(sampleIndoorRoute, 4)).toEqual({ kind: 'floor', building: 'strc', floor: 3 });
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
});
