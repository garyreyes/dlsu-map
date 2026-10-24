// The all-steps list (S8, and S11 when 3D is off) has one right answer per route: which place each step sits under,
// which icon it gets, and what its two lines say. A wrong answer sends a student up the stairs when the route goes
// down, or hides that a door is only approximate. Exact values throughout.
import { describe, expect, it } from 'vitest';
import type { Route, Step } from '@/shared/data/route';
import {
  sampleGateRoute,
  sampleIndoorRoute,
  sampleNoElevator,
  sampleRoute,
  sampleTurnSteps,
} from '@/shared/data/route.sample';
import { emptyRouteLine, fromName, placeNames, rowOf, stepGroups, totalsLine, tripLine } from './steps-list';

const names = placeNames({
  buildings: [
    { slug: 'andrew', short: 'Andrew' },
    { slug: 'strc', short: 'STRC', floorLabels: { '1': 'G' } },
  ],
  gates: [{ id: 'gate-2', name: 'Gate 2 (North)' }],
  entrances: [
    { kind: 'main', name: 'facing CADS' },
    { kind: 'main', name: 'facing Agno' },
  ],
});

describe('stepGroups', () => {
  it('groups steps by place: in the From building, outside, in the To building', () => {
    expect(stepGroups(sampleRoute, names)).toEqual([
      { label: 'In Andrew', rows: [{ index: 0, icon: 'elevator-down', title: 'Take the elevator down to 1F' }] },
      {
        label: 'Outside · 63 m',
        rows: [
          {
            index: 1,
            icon: 'start',
            title: 'Leave Andrew by the main entrance',
            subtitle: '45 m · approximate',
          },
          { index: 2, icon: 'left', title: 'Turn left at STRC', subtitle: '15 m' },
          { index: 3, icon: 'enter', title: 'Enter STRC by the main entrance', subtitle: 'approximate' },
        ],
      },
      {
        label: 'In STRC',
        rows: [{ index: 4, icon: 'stairs-up', title: 'ST311 is on 3F: take the stairs up' }],
      },
    ]);
  });

  it('gives a gate route one outside group, with a checked start', () => {
    expect(stepGroups(sampleGateRoute, names)).toEqual([
      {
        label: 'Outside · 216 m',
        rows: [
          { index: 0, icon: 'start', title: 'Start at Gate 2 (North)', subtitle: '220 m' },
          { index: 1, icon: 'enter', title: 'Enter STRC by the main entrance', subtitle: 'approximate' },
        ],
      },
    ]);
  });

  it('puts indoor steps under their building, with their distances (8b)', () => {
    expect(stepGroups(sampleIndoorRoute, names)).toEqual([
      {
        label: 'Outside · 216 m',
        rows: [
          { index: 0, icon: 'start', title: 'Start at Gate 2 (North)', subtitle: '220 m' },
          { index: 1, icon: 'enter', title: 'Enter STRC by the main entrance', subtitle: '10 m · approximate' },
        ],
      },
      {
        label: 'In STRC',
        rows: [
          { index: 2, icon: 'stairs-up', title: 'ST311 is on 3F: take the east stairs up', subtitle: '10 m' },
          { index: 3, icon: 'slight-left', title: 'Bear left at ST309', subtitle: '15 m' },
          { index: 4, icon: 'arrive', title: 'ST311 is on your right' },
        ],
      },
    ]);
  });

  it('takes up or down from the step’s floors leg', () => {
    expect(stepGroups(sampleNoElevator, names)[0]?.rows[0]?.icon).toBe('stairs-up');
    const down: Route = {
      legs: [{ kind: 'floors', building: 'strc', from: 4, to: 1, by: 'stairs', seconds: 60 }],
      steps: [{ kind: 'floors', leg: 0, building: 'strc', to: 1, by: 'stairs', text: 'Take the stairs down to G' }],
      meters: 0,
      seconds: 60,
    };
    expect(stepGroups(down, names)[0]?.rows[0]?.icon).toBe('stairs-down');
    const up: Route = {
      legs: [{ kind: 'floors', building: 'andrew', from: 1, to: 11, by: 'elevator', seconds: 230 }],
      steps: [
        { kind: 'floors', leg: 0, building: 'andrew', to: 11, by: 'elevator', text: 'Take the elevator up to 11F' },
      ],
      meters: 0,
      seconds: 230,
    };
    expect(stepGroups(up, names)[0]?.rows[0]?.icon).toBe('elevator-up');
  });

  it('gives each turn its own icon, and a crossing its own', () => {
    const route = walkOnly(sampleTurnSteps);
    expect(stepGroups(route, names)[0]?.rows.map((r) => r.icon)).toEqual([
      'slight-left',
      'left',
      'sharp-left',
      'slight-right',
      'right',
      'sharp-right',
      'cross',
    ]);
  });

  it('shows no distance for a step on the same spot as the next', () => {
    const route = walkOnly([{ kind: 'start', leg: 0, at: [0, 0], meters: 0, text: 'Start at Gate 2 (North)' }]);
    expect(stepGroups(route, names)[0]?.rows[0]).toEqual({ index: 0, icon: 'start', title: 'Start at Gate 2 (North)' });
  });

  it('keeps "(approximate)" in a title that isn’t marked approximate', () => {
    const route = walkOnly([
      { kind: 'turn', leg: 0, at: [0, 0], meters: 10, turn: 'left', text: 'Turn left (approximate)' },
    ]);
    expect(stepGroups(route, names)[0]?.rows[0]?.title).toBe('Turn left (approximate)');
  });

  it('puts consecutive steps in the same building under one label', () => {
    const route: Route = {
      legs: [
        { kind: 'floors', building: 'strc', from: 1, to: 2, by: 'stairs', seconds: 20 },
        { kind: 'floors', building: 'strc', from: 2, to: 4, by: 'stairs', seconds: 40 },
      ],
      steps: [
        { kind: 'floors', leg: 0, building: 'strc', to: 2, by: 'stairs', text: 'Take the stairs up to 2F' },
        { kind: 'floors', leg: 1, building: 'strc', to: 4, by: 'stairs', text: 'Take the stairs up to 4F' },
      ],
      meters: 0,
      seconds: 60,
    };
    expect(stepGroups(route, names).map((g) => [g.label, g.rows.length])).toEqual([['In STRC', 2]]);
  });

  it('adds up the meters of walk legs that share an outside group', () => {
    const one = walkOnly([{ kind: 'start', leg: 0, at: [0, 0], meters: 100, text: 'Start at Gate 2 (North)' }]);
    const walk = one.legs[0];
    if (walk?.kind !== 'walk') throw new Error('walkOnly makes a walk leg');
    const route: Route = {
      legs: [walk, { ...walk, meters: 40 }],
      steps: [...one.steps, { kind: 'turn', leg: 1, at: [0, 0], meters: 40, turn: 'right', text: 'Turn right' }],
      meters: 140,
      seconds: 108,
    };
    expect(stepGroups(route, names).map((g) => g.label)).toEqual(['Outside · 140 m']);
  });

  it('names a building it doesn’t know by its slug', () => {
    const route: Route = {
      legs: [{ kind: 'floors', building: 'razon', from: 1, to: 2, by: 'stairs', seconds: 20 }],
      steps: [{ kind: 'floors', leg: 0, building: 'razon', to: 2, by: 'stairs', text: 'Take the stairs up to 2F' }],
      meters: 0,
      seconds: 20,
    };
    expect(stepGroups(route, names)[0]?.label).toBe('In razon');
  });

  it('has no groups for a route with no steps', () => {
    expect(stepGroups({ legs: [], steps: [], meters: 0, seconds: 0 }, names)).toEqual([]);
  });
});

describe('totalsLine', () => {
  it('rounds the time to whole minutes and adds the walk', () => {
    expect(totalsLine(sampleRoute)).toBe('About 5 min · 63 m walk');
    expect(totalsLine(sampleGateRoute)).toBe('About 3 min · 216 m walk');
  });

  it('leaves out the walk when there isn’t one', () => {
    expect(totalsLine(sampleNoElevator)).toBe('About 3 min');
  });

  it('never says 0 min', () => {
    expect(totalsLine({ ...sampleNoElevator, seconds: 20 })).toBe('About 1 min');
    expect(totalsLine({ ...sampleNoElevator, seconds: 89 })).toBe('About 1 min');
    expect(totalsLine({ ...sampleNoElevator, seconds: 90 })).toBe('About 2 min');
  });
});

describe('tripLine', () => {
  it('names each end the way the student set it', () => {
    expect(tripLine({ kind: 'room', code: 'AG1104' }, { kind: 'room', code: 'ST311' }, names)).toBe('AG1104 → ST311');
    expect(tripLine({ kind: 'gate', gate: 'gate-2' }, { kind: 'building', building: 'strc' }, names)).toBe(
      'Gate 2 (North) → STRC',
    );
  });

  it('gives a building spot its floor label', () => {
    expect(tripLine({ kind: 'building', building: 'strc', floor: 1 }, { kind: 'room', code: 'ST311' }, names)).toBe(
      'STRC G → ST311',
    );
    expect(tripLine({ kind: 'building', building: 'andrew', floor: 5 }, { kind: 'room', code: 'ST311' }, names)).toBe(
      'Andrew 5F → ST311',
    );
  });

  it('falls back to the id for a gate or building it doesn’t know', () => {
    expect(tripLine({ kind: 'gate', gate: 'gate-9' }, { kind: 'building', building: 'razon' }, names)).toBe(
      'gate-9 → razon',
    );
  });
});

describe('emptyRouteLine', () => {
  it('says the room is on this floor', () => {
    expect(emptyRouteLine({ kind: 'room', code: 'ST311' }, names)).toBe('ST311 is on this floor.');
  });

  it('says the student is already in the building', () => {
    expect(emptyRouteLine({ kind: 'building', building: 'strc' }, names)).toBe('You’re already in STRC.');
  });
});

function walkOnly(steps: readonly Step[]): Route {
  const at = [0, 0] as const;
  return {
    legs: [
      {
        kind: 'walk',
        from: { kind: 'gate', gate: 'gate-2', name: 'Gate 2 (North)', at },
        to: { kind: 'door', building: 'strc', door: 'main', verified: true, at },
        path: [at, at],
        meters: 100,
        seconds: 77,
      },
    ],
    steps,
    meters: 100,
    seconds: 77,
  };
}

describe('still-saving rows', () => {
  it('marks the steps of a building whose map is still saving, in the list too', () => {
    const rows = stepGroups(sampleRoute, names, ['andrew']).flatMap((g) => g.rows);
    expect(rows.map((r) => r.subtitle)).toEqual([
      'Indoor map still saving · follow signs to 1F',
      '45 m · approximate · Indoor map still saving · follow signs to 1F',
      '15 m',
      'approximate',
      undefined,
    ]);
  });

  it('is what rowOf says for one step', () => {
    const step = sampleRoute.steps[4];
    expect(rowOf(step, 4, sampleRoute, ['strc'], names).subtitle).toBe('Indoor map still saving · follow signs to 3F');
    expect(rowOf(step, 4, sampleRoute).subtitle).toBeUndefined();
  });

  it('uses the building’s floor label for the floor the walk out of it starts from', () => {
    const down = { kind: 'floors', building: 'strc', from: 3, to: 1, by: 'stairs', seconds: 40 } as const;
    const from = { kind: 'door', building: 'strc', door: 'main', verified: true, at: [0, 0] } as const;
    const walk = { ...sampleRoute.legs[1], from };
    const start = { kind: 'start', leg: 1, at: [0, 0], meters: 45, text: 'Leave STRC by the main entrance' } as const;
    const route: Route = { legs: [down, walk], steps: [start], meters: 45, seconds: 80 };
    expect(rowOf(start, 0, route, ['strc'], names).subtitle).toBe('45 m · Indoor map still saving · follow signs to G');
  });

  it('names the goal floor with the building’s own label, and the room’s floor on the way in', () => {
    const rows = stepGroups(sampleIndoorRoute, names, ['strc']).flatMap((g) => g.rows);
    expect(rows.map((r) => r.subtitle)).toEqual([
      '220 m',
      '10 m · approximate · Indoor map still saving · follow signs to 3F',
      '10 m · Indoor map still saving · follow signs to 3F',
      '15 m',
      undefined,
    ]);
  });
});

describe('fromName with a spot (8c-2)', () => {
  const base = { kind: 'building', building: 'andrew', floor: 5 } as const;

  it('is the building and floor without a spot', () => {
    expect(fromName(base, names)).toBe('Andrew 5F');
  });

  it('adds a stairs or elevator spot', () => {
    expect(fromName({ ...base, spot: { kind: 'vertical', id: 'east-stairs' } }, names)).toBe('Andrew 5F · east stairs');
  });

  it('adds an entrance spot', () => {
    expect(
      fromName({ kind: 'building', building: 'strc', floor: 1, spot: { kind: 'entrance', entrance: 1 } }, names),
    ).toBe('STRC G · main entrance facing Agno');
  });
});
