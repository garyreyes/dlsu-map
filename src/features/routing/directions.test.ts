// The direction steps (4c, D35) on hand-drawn campuses, through the router as Lane A gets them. Points are x east,
// y north, so walking north and then heading east is a RIGHT turn: every left/right below was checked on paper.
import { describe, expect, it } from 'vitest';
import type { From, FloorMode, Step, To, Turn, XY } from '@/shared/data/route';
import { type Seg, fixtureCampus, fixtureRooms } from './fixture';
import { createRouter } from './router';

type Places = Parameters<typeof fixtureCampus>[1];
const gate: From = { kind: 'gate', gate: 'g' };
const toBeta: To = { kind: 'building', building: 'beta' };
const g0 = { id: 'g', at: [0, 0] } as const;

function stepsOf(segs: readonly Seg[], places: Places, from = gate, to = toBeta, mode: FloorMode = 'auto'): Step[] {
  const result = createRouter(fixtureCampus(segs, places), fixtureRooms(...rooms))(from, to, mode);
  if (!result.ok) throw new Error(`no route: ${result.reason}`);
  return [...result.route.steps];
}
const rooms: [string, string, number][] = [
  ['AL101', 'alpha', 1],
  ['AL301', 'alpha', 3],
  ['BE401', 'beta', 4],
  ['DE301', 'delta', 3],
];

/** A point `meters` from `at`, heading `deg` degrees clockwise from north. */
const ahead = ([x, y]: XY, deg: number, meters: number): XY => {
  const rad = (deg * Math.PI) / 180;
  return [x + meters * Math.sin(rad), y + meters * Math.cos(rad)];
};

/** Gate at 0,0, north 100 m to a junction J (a spur carries straight on north), then `deg` to the right (negative:
 *  left) for 60 m, then 5 m of door link into beta. The outgoing way is `out`. */
function turnAt(deg: number, out: Partial<{ kind: Seg[2]; name: string; covered: true }> = {}, places: Places = {}) {
  const j: XY = [0, 100];
  const k = ahead(j, deg, 60);
  const door = ahead(k, deg, 5);
  const segs: Seg[] = [
    [[0, 0], j, 'path'],
    [j, [0, 150], 'path'],
    [j, k, out.kind ?? 'path', out.name, out.covered],
    [k, door, 'door'],
  ];
  return stepsOf(segs, { gates: [g0], doors: [{ building: 'beta', at: door }], ...places });
}
const turnStep = (steps: readonly Step[]) => steps.find((s) => s.kind === 'turn');

describe('turns', () => {
  it('walking north then east is a right turn, with every field', () => {
    const door = ahead(ahead([0, 100], 90, 60), 90, 5);
    expect(turnAt(90)).toStrictEqual([
      { kind: 'start', leg: 0, at: [0, 0], meters: 100, text: 'Start at Gate g' },
      { kind: 'turn', leg: 0, at: [0, 100], meters: 65, turn: 'right', text: 'Turn right' },
      {
        kind: 'enter',
        leg: 0,
        building: 'beta',
        at: door,
        approximate: true,
        text: 'Enter Beta by the main entrance (approximate)',
      },
    ]);
  });

  it.each<[number, Turn | undefined, string | undefined]>([
    [29, undefined, undefined],
    [31, 'slight-right', 'Bear right'],
    [59, 'slight-right', 'Bear right'],
    [61, 'right', 'Turn right'],
    [134, 'right', 'Turn right'],
    [136, 'sharp-right', 'Turn sharp right'],
    [160, 'sharp-right', 'Turn sharp right'],
    [-29, undefined, undefined],
    [-45, 'slight-left', 'Bear left'],
    [-90, 'left', 'Turn left'],
    [-160, 'sharp-left', 'Turn sharp left'],
  ])('a %d° bend at a junction is %s', (deg, turn, text) => {
    const step = turnStep(turnAt(deg));
    expect(step === undefined ? undefined : [step.turn, step.text]).toStrictEqual(
      turn === undefined ? undefined : [turn, text],
    );
  });

  it('can give every turn there is', () => {
    const seen = new Set(
      [31, 90, 160, -31, -90, -160].map((d) => turnStep(turnAt(d))).map((s) => s?.kind === 'turn' && s.turn),
    );
    expect([...seen].sort()).toStrictEqual([
      'left',
      'right',
      'sharp-left',
      'sharp-right',
      'slight-left',
      'slight-right',
    ]);
  });

  it('a bend with no other way to go is no step; the distance runs on through it', () => {
    const steps = stepsOf(
      [
        [[0, 0], [0, 100], 'path'],
        [[0, 100], [100, 100], 'path'],
      ],
      { gates: [g0], doors: [{ building: 'beta', at: [100, 100] }] },
    );
    expect(steps.map((s) => [s.kind, 'meters' in s ? s.meters : null])).toStrictEqual([
      ['start', 200],
      ['enter', null],
    ]);
  });

  /** Gate north to J1 (spur west), east `gap` m to J2 (spur south), then the second bend, then a door. */
  const jog = (gap: number, second: number) => {
    const j1: XY = [0, 100];
    const j2: XY = [gap, 100];
    const end = ahead(j2, second, 100);
    return stepsOf(
      [
        [[0, 0], j1, 'path'],
        [j1, [-50, 100], 'path'],
        [j1, j2, 'path'],
        [j2, [gap, 50], 'path'],
        [j2, end, 'path'],
      ],
      { gates: [g0], doors: [{ building: 'beta', at: end }] },
    );
  };

  it('turns under 15 m apart merge: right then left is straight on', () => {
    expect(jog(10, 0).map((s) => s.kind)).toStrictEqual(['start', 'enter']);
  });

  it('turns under 15 m apart merge into the overall turn: right then bear right is sharp right, at the first', () => {
    const steps = jog(10, 140);
    expect(steps.filter((s) => s.kind === 'turn')).toStrictEqual([
      { kind: 'turn', leg: 0, at: [0, 100], meters: 110, turn: 'sharp-right', text: 'Turn sharp right' },
    ]);
  });

  it('turns 20 m apart are two steps', () => {
    expect(jog(20, 0).map((s) => (s.kind === 'turn' ? [s.turn, s.at, s.meters] : s.kind))).toStrictEqual([
      'start',
      ['right', [0, 100], 20],
      ['left', [20, 100], 100],
      'enter',
    ]);
  });

  it('a turn onto the last link, the door, is left to the enter step', () => {
    const steps = stepsOf(
      [
        [[0, 0], [0, 100], 'path'],
        [[0, 100], [0, 150], 'path'],
        [[0, 100], [10, 100], 'door'],
      ],
      { gates: [g0], doors: [{ building: 'beta', at: [10, 100] }] },
    );
    expect(steps.map((s) => s.kind)).toStrictEqual(['start', 'enter']);
  });

  it('a bend into the door just after a junction turn doesn’t swallow the turn (review, 2026-10-21)', () => {
    // Right 90° at J onto an 8 m path, then the door link bends a further 40° right: J is still a right turn.
    const p: XY = [8, 100];
    const door = ahead(p, 130, 5);
    const steps = stepsOf(
      [
        [[0, 0], [0, 100], 'path'],
        [[0, 100], [0, 150], 'path'],
        [[0, 100], p, 'path'],
        [p, door, 'door'],
      ],
      { gates: [g0], doors: [{ building: 'beta', at: door }] },
    );
    expect(steps.filter((s) => s.kind === 'turn')).toStrictEqual([
      { kind: 'turn', leg: 0, at: [0, 100], meters: 15, turn: 'right', text: 'Turn right' },
    ]);
  });

  it('merging chains: three bends each 14 m apart are one turn, even though the first and last are 28 m apart', () => {
    // Right 40° at J, B and C (J and C are junctions): one 120° right at J, not a right at J and a slight right at C.
    const j: XY = [0, 100];
    const b = ahead(j, 40, 14);
    const c = ahead(b, 80, 14);
    const end = ahead(c, 120, 50);
    const steps = stepsOf(
      [
        [[0, 0], j, 'path'],
        [j, [0, 150], 'path'],
        [j, b, 'path'],
        [b, c, 'path'],
        [c, ahead(c, 80, 30), 'path'],
        [c, end, 'path'],
      ],
      { gates: [g0], doors: [{ building: 'beta', at: end }] },
    );
    expect(steps.map((s) => (s.kind === 'turn' ? [s.turn, s.at] : s.kind))).toStrictEqual([
      'start',
      ['right', j],
      'enter',
    ]);
  });

  it('a step at the very same spot as the next is 0 m, not 5 (review, 2026-10-21)', () => {
    // The gate sits on the curb, so the walk starts with the crossing.
    const fromCurb = stepsOf(
      [
        [[0, 0], [0, 15], 'crossing', 'Taft Avenue'],
        [[0, 15], [0, 100], 'path'],
      ],
      { gates: [g0], doors: [{ building: 'beta', at: [0, 100] }] },
    );
    expect(fromCurb.map((s) => [s.kind, 'meters' in s ? s.meters : null])).toStrictEqual([
      ['start', 0],
      ['cross', 100],
      ['enter', null],
    ]);
    // A door on the gate's own point: a walk of one point.
    const onTheSpot = stepsOf([[[0, 0], [0, 50], 'path']], { gates: [g0], doors: [{ building: 'beta', at: [0, 0] }] });
    expect(onTheSpot.map((s) => [s.kind, 'meters' in s ? s.meters : null])).toStrictEqual([
      ['start', 0],
      ['enter', null],
    ]);
  });
});

describe('what a turn names (D35)', () => {
  /** A 10 m square whose nearest corner is `gap` m east and north of the junction at 0,100... along each axis. */
  const square = (x: number, y: number): number[] => [x, y, x + 10, y, x + 10, y + 10, x, y + 10];

  it('the way turned onto, by name', () => {
    expect(turnStep(turnAt(90, { name: 'SJ Walk' }))?.text).toBe('Turn right onto SJ Walk');
  });

  it('a named street, walked down the middle', () => {
    expect(turnStep(turnAt(-90, { kind: 'street', name: 'Fidel A. Reyes Street' }))?.text).toBe(
      'Turn left onto Fidel A. Reyes Street',
    );
  });

  it('a sidewalk by its street', () => {
    expect(turnStep(turnAt(90, { kind: 'sidewalk', name: 'Taft Avenue' }))?.text).toBe(
      'Turn right onto the Taft Avenue sidewalk',
    );
  });

  it('a name wins over covered', () => {
    expect(turnStep(turnAt(90, { name: 'SJ Walk', covered: true }))?.text).toBe('Turn right onto SJ Walk');
  });

  it('an unnamed covered way is the covered walk', () => {
    expect(turnStep(turnAt(45, { covered: true }))?.text).toBe('Bear right onto the covered walk');
  });

  it('else a building within 20 m, by its short name, block tier too', () => {
    const near = {
      buildings: [{ slug: 'beta' }, { slug: 'velasco', tier: 'block', short: 'Velasco', outline: square(5, 105) }],
    } as const;
    expect(turnStep(turnAt(90, {}, near))?.text).toBe('Turn right at Velasco');
  });

  it('the nearest of two buildings', () => {
    const two = {
      buildings: [
        { slug: 'beta' },
        { slug: 'far', short: 'Far', outline: square(-20, 110) },
        { slug: 'near', short: 'Near', outline: square(-12, 102) },
      ],
    } as const;
    expect(turnStep(turnAt(90, {}, two))?.text).toBe('Turn right at Near');
  });

  it('a building 25 m away is too far, and a name wins over a building', () => {
    const far = { buildings: [{ slug: 'beta' }, { slug: 'v', short: 'V', outline: square(25, 95) }] } as const;
    const near = { buildings: [{ slug: 'beta' }, { slug: 'v', short: 'V', outline: square(5, 105) }] } as const;
    expect(turnStep(turnAt(90, {}, far))?.text).toBe('Turn right');
    expect(turnStep(turnAt(90, { name: 'SJ Walk' }, near))?.text).toBe('Turn right onto SJ Walk');
  });
});

describe('crossings', () => {
  // West sidewalk on x = 0, east sidewalk on x = 30, the crosswalk drawn in two pieces at y = 50 through a median
  // point, and a crossing-tagged footway past the east curb (as OSM draws them, PROJECT_FACTS "Routing").
  const taft: Seg[] = [
    [[0, 0], [0, 50], 'sidewalk', 'Taft Avenue'],
    [[0, 50], [0, 100], 'sidewalk', 'Taft Avenue'],
    [[0, 50], [15, 50], 'crossing', 'Taft Avenue'],
    [[15, 50], [30, 50], 'crossing', 'Taft Avenue'],
    [[30, 0], [30, 50], 'sidewalk', 'Taft Avenue'],
    [[30, 50], [30, 100], 'sidewalk', 'Taft Avenue'],
    [[30, 50], [60, 50], 'crossing', 'Taft Avenue'],
    [[60, 50], [100, 50], 'path'],
  ];

  it('a crosswalk in pieces is one step at the curb, and the turn onto it is not a step', () => {
    const steps = stepsOf(taft, { gates: [g0], doors: [{ building: 'beta', at: [100, 50] }] });
    expect(steps.slice(0, 2)).toStrictEqual([
      { kind: 'start', leg: 0, at: [0, 0], meters: 50, text: 'Start at Gate g' },
      {
        kind: 'cross',
        leg: 0,
        at: [0, 50],
        meters: 100,
        street: 'Taft Avenue',
        text: 'Cross Taft Avenue at the crosswalk',
      },
    ]);
    expect(steps.map((s) => s.kind)).toStrictEqual(['start', 'cross', 'enter']);
  });

  it('a turn at the far curb is a step', () => {
    const steps = stepsOf(taft, { gates: [g0], doors: [{ building: 'beta', at: [30, 100] }] });
    expect(steps.map((s) => s.text)).toStrictEqual([
      'Start at Gate g',
      'Cross Taft Avenue at the crosswalk',
      'Turn left onto the Taft Avenue sidewalk',
      'Enter Beta by the main entrance (approximate)',
    ]);
  });

  it('two streets crossed back to back are two steps (review, 2026-10-21)', () => {
    // Across Taft to a corner island, then right across Dagonoy: all crossing links, two names.
    const steps = stepsOf(
      [
        [[0, 0], [0, 50], 'path'],
        [[0, 50], [0, 60], 'crossing', 'Taft Avenue'],
        [[0, 60], [10, 60], 'crossing', 'Dagonoy Street'],
        [[10, 60], [10, 100], 'path'],
      ],
      { gates: [g0], doors: [{ building: 'beta', at: [10, 100] }] },
    );
    expect(steps.map((s) => [s.text, 'meters' in s ? s.meters : null])).toStrictEqual([
      ['Start at Gate g', 50],
      ['Cross Taft Avenue at the crosswalk', 10],
      ['Cross Dagonoy Street at the crosswalk', 50],
      ['Enter Beta by the main entrance (approximate)', null],
    ]);
  });

  it('an unnamed crossing is the street', () => {
    const steps = stepsOf(
      [
        [[0, 0], [0, 50], 'path'],
        [[0, 50], [0, 60], 'crossing'],
        [[0, 60], [0, 100], 'path'],
      ],
      { gates: [g0], doors: [{ building: 'beta', at: [0, 100] }] },
    );
    expect(steps.find((s) => s.kind === 'cross')?.text).toBe('Cross the street at the crosswalk');
  });
});

describe('doors', () => {
  const line: Seg[] = [
    [[0, 0], [0, 50], 'path'],
    [[0, 50], [0, 100], 'path'],
    [[0, 50], [40, 50], 'path'],
  ];

  it('a checked door has no "(approximate)"', () => {
    const steps = stepsOf(line, { gates: [g0], doors: [{ building: 'beta', at: [0, 100], verified: true }] });
    expect(steps.at(-1)).toStrictEqual({
      kind: 'enter',
      leg: 0,
      building: 'beta',
      at: [0, 100],
      text: 'Enter Beta by the main entrance',
    });
  });

  it('leaving names the door, side doors by where they open to', () => {
    const doors = [
      { building: 'alpha', at: [0, 0] },
      { building: 'alpha', at: [40, 50], kind: 'side', name: 'to the field', verified: true },
      { building: 'beta', at: [0, 100] },
    ] as const;
    const fromG = stepsOf(line, { doors }, { kind: 'building', building: 'alpha', floor: 1 });
    expect(fromG[0]).toStrictEqual({
      kind: 'start',
      leg: 0,
      at: [0, 0],
      meters: 100,
      approximate: true,
      text: 'Leave Alpha by the main entrance (approximate)',
    });
    // From 3F any door will do (D34), and the side door is nearer beta: 90 m against 100. West 40 m to the junction,
    // then north: a right turn.
    const from3F = stepsOf(line, { doors }, { kind: 'room', code: 'AL301' });
    expect(from3F.slice(1, 3)).toStrictEqual([
      { kind: 'start', leg: 1, at: [40, 50], meters: 40, text: 'Leave Alpha by the side entrance to the field' },
      { kind: 'turn', leg: 1, at: [0, 50], meters: 50, turn: 'right', text: 'Turn right' },
    ]);
  });
});

describe('distances, rounded for showing (D35)', () => {
  it.each([
    [2, 5],
    [47, 45],
    [99, 100],
    [123, 120],
    [216, 220],
  ])('%d m shows as %d m', (meters, shown) => {
    const steps = stepsOf([[[0, 0], [0, meters], 'path']], {
      gates: [g0],
      doors: [{ building: 'beta', at: [0, meters] }],
    });
    expect(steps[0]?.kind === 'start' && steps[0].meters).toBe(shown);
  });
});

describe('floors', () => {
  const segs: Seg[] = [[[0, 0], [100, 0], 'path']];
  const places: Places = {
    doors: [
      { building: 'alpha', at: [0, 0] },
      { building: 'beta', at: [100, 0] },
    ],
    buildings: [{ slug: 'alpha', floorLabels: { '1': 'G' } }, { slug: 'beta' }, { slug: 'delta', tier: 'block' }],
  };

  it('down, the walk, then the room and its floor, each step on its own leg', () => {
    const steps = stepsOf(segs, places, { kind: 'room', code: 'AL301' }, { kind: 'room', code: 'BE401' });
    expect(steps.map((s) => [s.kind, s.leg, s.text])).toStrictEqual([
      ['floors', 0, 'Take the stairs down to G'],
      ['start', 1, 'Leave Alpha by the main entrance (approximate)'],
      ['enter', 1, 'Enter Beta by the main entrance (approximate)'],
      ['floors', 2, 'BE401 is on 4F: take the elevator up'],
    ]);
    expect(steps[0]).toStrictEqual({
      kind: 'floors',
      leg: 0,
      building: 'alpha',
      to: 1,
      by: 'stairs',
      text: 'Take the stairs down to G',
    });
  });

  it('within one building, the floor label is used for the room too', () => {
    const steps = stepsOf(segs, places, { kind: 'room', code: 'AL301' }, { kind: 'room', code: 'AL101' });
    expect(steps).toStrictEqual([
      {
        kind: 'floors',
        leg: 0,
        building: 'alpha',
        to: 1,
        by: 'stairs',
        text: 'AL101 is on G: take the stairs down',
      },
    ]);
  });

  it('a building as To ends at its door; no room line', () => {
    const steps = stepsOf(segs, places, { kind: 'building', building: 'alpha', floor: 3 }, toBeta);
    expect(steps.map((s) => s.kind)).toStrictEqual(['floors', 'start', 'enter']);
  });

  it('Elevator asked for with none: the stairs, said plainly (S5 says why)', () => {
    const steps = stepsOf(
      segs,
      places,
      { kind: 'building', building: 'delta', floor: 1 },
      { kind: 'room', code: 'DE301' },
      'elevator',
    );
    expect(steps.map((s) => s.text)).toStrictEqual(['DE301 is on 3F: take the stairs up']);
  });

  it('no legs, no steps', () => {
    expect(
      stepsOf(segs, places, { kind: 'building', building: 'alpha', floor: 1 }, { kind: 'building', building: 'alpha' }),
    ).toStrictEqual([]);
  });
});

it('can give every kind of step there is', () => {
  const kinds = new Set(
    [
      ...turnAt(90),
      ...stepsOf(
        [
          [[0, 0], [0, 50], 'path'],
          [[0, 50], [0, 60], 'crossing', 'Taft Avenue'],
          [[0, 60], [0, 100], 'path'],
        ],
        {
          doors: [
            { building: 'alpha', at: [0, 0] },
            { building: 'beta', at: [0, 100] },
          ],
        },
        { kind: 'room', code: 'AL301' },
      ),
    ].map((s) => s.kind),
  );
  expect([...kinds].sort()).toStrictEqual(['cross', 'enter', 'floors', 'start', 'turn']);
});
