// Hand-written samples in the agreed shape, so Lane A can build 5b–5d before the real router (4b) and directions (4c)
// land, and 8c before indoor routing (8b) does. The doors are real (`campus.json`, 2026-10-20); the walk is a short
// stand-in line, not the real path. Times follow D34, steps D35 and D41. 8c-2 added the trip choices at the end.
import type { Doors, From, Route, RouteResult, Step, To } from './route.ts';

const andrewMain = {
  kind: 'door',
  building: 'andrew',
  door: 'main',
  entrance: 1,
  verified: false,
  at: [-93.8, 250.2],
} as const;
const strcMain = {
  kind: 'door',
  building: 'strc',
  door: 'main',
  entrance: 16,
  verified: false,
  at: [-85.6, 196],
} as const;
const velascoMain = {
  kind: 'door',
  building: 'velasco',
  door: 'main',
  entrance: 4,
  verified: false,
  at: [6.1, 77.7],
} as const;
const bend = [-100, 205] as const;

/** AG1104 → ST311, Auto: elevator down 10 floors (3 min wait + 5 s a floor), walk, stairs up 2 (20 s a floor). Both
 *  doors are unchecked, so their steps say "(approximate)". Andrew has no floor labels, so its ground floor is 1F. */
export const sampleRoute = {
  legs: [
    { kind: 'floors', building: 'andrew', from: 11, to: 1, by: 'elevator', seconds: 230 },
    {
      kind: 'walk',
      from: andrewMain,
      to: strcMain,
      path: [andrewMain.at, bend, strcMain.at],
      meters: 63,
      seconds: 48,
    },
    { kind: 'floors', building: 'strc', from: 1, to: 3, by: 'stairs', seconds: 40 },
  ],
  steps: [
    { kind: 'floors', leg: 0, building: 'andrew', to: 1, by: 'elevator', text: 'Take the elevator down to 1F' },
    {
      kind: 'start',
      leg: 1,
      at: andrewMain.at,
      meters: 45,
      approximate: true,
      text: 'Leave Andrew by the main entrance (approximate)',
    },
    { kind: 'turn', leg: 1, at: bend, meters: 15, turn: 'left', text: 'Turn left at STRC' },
    {
      kind: 'enter',
      leg: 1,
      building: 'strc',
      at: strcMain.at,
      approximate: true,
      text: 'Enter STRC by the main entrance (approximate)',
    },
    { kind: 'floors', leg: 2, building: 'strc', to: 3, by: 'stairs', text: 'ST311 is on 3F: take the stairs up' },
  ],
  meters: 63,
  seconds: 318,
} as const satisfies Route;

/** Gate 2 → STRC (a building, so its ground floor): one walk leg, no floors. The bend is under 30°, so not a step. */
export const sampleGateRoute = {
  legs: [
    {
      kind: 'walk',
      from: { kind: 'gate', gate: 'gate-2', name: 'Gate 2 (North)', at: [66.5, 50.4] },
      to: strcMain,
      path: [[66.5, 50.4], [-40, 120], strcMain.at],
      meters: 216,
      seconds: 166,
    },
  ],
  steps: [
    { kind: 'start', leg: 0, at: [66.5, 50.4], meters: 220, text: 'Start at Gate 2 (North)' },
    {
      kind: 'enter',
      leg: 0,
      building: 'strc',
      at: strcMain.at,
      approximate: true,
      text: 'Enter STRC by the main entrance (approximate)',
    },
  ],
  meters: 216,
  seconds: 166,
} as const satisfies Route;

/** AG201 → AG1104 with Elevator asked for, in a building with none (user-flows' example): stairs, and S5 says so. */
export const sampleNoElevator = {
  legs: [{ kind: 'floors', building: 'andrew', from: 2, to: 11, by: 'stairs', seconds: 180, noElevator: true }],
  steps: [
    {
      kind: 'floors',
      leg: 0,
      building: 'andrew',
      to: 11,
      by: 'stairs',
      text: 'AG1104 is on 11F: take the stairs up',
    },
  ],
  meters: 0,
  seconds: 180,
} as const satisfies Route;

const gate2 = { kind: 'gate', gate: 'gate-2', name: 'Gate 2 (North)', at: [66.5, 50.4] } as const;
/** STRC's east stairs on G and 3F, and ST311's door: real points from `buildings/strc.json` (2026-10-22). */
const eastStairsG = [-83.3, 188.3] as const;
const eastStairs3 = [-83.9, 187.2] as const;
const st311Door = [-108.2, 180.1] as const;
const bend3 = [-96, 187] as const;

/** Gate 2 → ST311, Auto, with STRC's floors labelled (8b, D41): the walk, then inside on G to the east stairs, up 2
 *  floors, and along 3F to the door. The walk and the 3F bend are stand-ins; the stairs and the door are real. */
export const sampleIndoorRoute = {
  legs: [
    {
      kind: 'walk',
      from: gate2,
      to: strcMain,
      path: [gate2.at, [-40, 120], strcMain.at],
      meters: 216,
      seconds: 166,
    },
    { kind: 'indoor', building: 'strc', floor: 1, path: [strcMain.at, eastStairsG], meters: 8, seconds: 6 },
    {
      kind: 'floors',
      building: 'strc',
      from: 1,
      to: 3,
      by: 'stairs',
      seconds: 40,
      via: 'east-stairs',
      at: eastStairsG,
    },
    { kind: 'indoor', building: 'strc', floor: 3, path: [eastStairs3, bend3, st311Door], meters: 26, seconds: 20 },
  ],
  steps: [
    { kind: 'start', leg: 0, at: gate2.at, meters: 220, text: 'Start at Gate 2 (North)' },
    {
      kind: 'enter',
      leg: 0,
      building: 'strc',
      at: strcMain.at,
      approximate: true,
      meters: 10,
      text: 'Enter STRC by the main entrance (approximate)',
    },
    {
      kind: 'floors',
      leg: 2,
      building: 'strc',
      to: 3,
      by: 'stairs',
      at: eastStairsG,
      meters: 10,
      text: 'ST311 is on 3F: take the east stairs up',
    },
    { kind: 'turn', leg: 3, at: bend3, meters: 15, turn: 'slight-left', text: 'Bear left at ST309' },
    { kind: 'arrive', leg: 3, code: 'ST311', side: 'right', at: st311Door, text: 'ST311 is on your right' },
  ],
  meters: 250,
  seconds: 232,
} as const satisfies Route;

/** Gate 2 → VL313, Auto, while Velasco's floors aren't labelled (O5): it stops at the door, then floors only, and
 *  says which building has no indoor map yet. The walk is a stand-in. */
export const sampleNoIndoorMap = {
  legs: [
    {
      kind: 'walk',
      from: gate2,
      to: velascoMain,
      path: [gate2.at, velascoMain.at],
      meters: 66,
      seconds: 51,
    },
    { kind: 'floors', building: 'velasco', from: 1, to: 3, by: 'stairs', seconds: 40 },
  ],
  steps: [
    { kind: 'start', leg: 0, at: gate2.at, meters: 65, text: 'Start at Gate 2 (North)' },
    {
      kind: 'enter',
      leg: 0,
      building: 'velasco',
      at: velascoMain.at,
      approximate: true,
      text: 'Enter Velasco by the main entrance (approximate)',
    },
    {
      kind: 'floors',
      leg: 1,
      building: 'velasco',
      to: 3,
      by: 'stairs',
      text: 'VL313 is on 3F: take the stairs up',
    },
  ],
  meters: 66,
  seconds: 91,
  noIndoorMap: ['velasco'],
} as const satisfies Route;

/** One of every turn, and a crossing, for the step icons (S6, S8). Not one route: the points are made up. */
export const sampleTurnSteps = [
  { kind: 'turn', leg: 0, at: [0, 0], meters: 40, turn: 'slight-left', text: 'Bear left onto the covered walk' },
  { kind: 'turn', leg: 0, at: [0, 0], meters: 60, turn: 'left', text: 'Turn left onto SJ Walk' },
  { kind: 'turn', leg: 0, at: [0, 0], meters: 15, turn: 'sharp-left', text: 'Turn sharp left at Velasco' },
  { kind: 'turn', leg: 0, at: [0, 0], meters: 25, turn: 'slight-right', text: 'Bear right onto Central Plaza' },
  {
    kind: 'turn',
    leg: 0,
    at: [0, 0],
    meters: 140,
    turn: 'right',
    text: 'Turn right onto the Taft Avenue sidewalk',
  },
  { kind: 'turn', leg: 0, at: [0, 0], meters: 10, turn: 'sharp-right', text: 'Turn sharp right' },
  {
    kind: 'cross',
    leg: 0,
    at: [0, 0],
    meters: 30,
    street: 'Taft Avenue',
    text: 'Cross Taft Avenue at the crosswalk',
  },
] as const satisfies readonly Step[];

export const sampleResults = {
  ok: { ok: true, route: sampleRoute },
  'same-room': { ok: false, reason: 'same-room' },
  'unknown-place': { ok: false, reason: 'unknown-place' },
  'no-route': { ok: false, reason: 'no-route' },
} as const satisfies Record<string, RouteResult>;

/** Change spot and the exit choice (8c-2, D42, D43): router inputs with real ids from `campus.json` and
 *  `buildings/velasco.json` (2026-10-22). Velasco has two main entrances, 4 and 5, neither named yet. */
export const sampleTripChoices = {
  /** Velasco 3F, standing at the west stairs instead of the elevator lobby: the indoor leg starts there. */
  westStairs: {
    from: { kind: 'building', building: 'velasco', floor: 3, spot: { kind: 'vertical', id: 'west-stairs' } },
    to: { kind: 'room', code: 'ST311' },
  },
  /** Velasco G at entrance 5: no indoor leg, the walk starts at that door. */
  atDoor: {
    from: { kind: 'building', building: 'velasco', floor: 1, spot: { kind: 'entrance', entrance: 5 } },
    to: { kind: 'room', code: 'ST311' },
  },
  /** Leaving Velasco 3F by entrance 5, not the quickest door: the walk's `from.entrance` is 5. */
  exit: {
    from: { kind: 'building', building: 'velasco', floor: 3 },
    to: { kind: 'building', building: 'strc' },
    doors: { exit: 5 },
  },
  /** Entrance 16 is STRC's, not Velasco's: `unknown-place`. */
  wrongExit: {
    from: { kind: 'building', building: 'velasco', floor: 3 },
    to: { kind: 'building', building: 'strc' },
    doors: { exit: 16 },
  },
  /** No stairs with that id on Velasco 3F: `unknown-place`. */
  unknownSpot: {
    from: { kind: 'building', building: 'velasco', floor: 3, spot: { kind: 'vertical', id: 'north-stairs' } },
    to: { kind: 'room', code: 'ST311' },
  },
} as const satisfies Record<string, { from: From; to: To; doors?: Doors }>;
