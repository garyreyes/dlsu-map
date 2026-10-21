// Hand-written samples in the agreed shape, so Lane A can build 5b–5d before the real router (4b) lands. The doors
// are real (`campus.json`, 2026-10-20); the walk is a short stand-in line, not the real path. Times follow D34.
import type { Route, RouteResult } from './route';

const andrewMain = { kind: 'door', building: 'andrew', door: 'main', verified: false, at: [-93.8, 250.2] } as const;
const strcMain = { kind: 'door', building: 'strc', door: 'main', verified: false, at: [-85.6, 196] } as const;

/** AG1104 → ST311, Auto: elevator down 10 floors (3 min wait + 5 s a floor), walk, stairs up 2 (20 s a floor). */
export const sampleRoute = {
  legs: [
    { kind: 'floors', building: 'andrew', from: 11, to: 1, by: 'elevator', seconds: 230 },
    {
      kind: 'walk',
      from: andrewMain,
      to: strcMain,
      path: [andrewMain.at, [-92, 222], strcMain.at],
      meters: 55,
      seconds: 42,
    },
    { kind: 'floors', building: 'strc', from: 1, to: 3, by: 'stairs', seconds: 40 },
  ],
  meters: 55,
  seconds: 312,
} as const satisfies Route;

/** Gate 2 → STRC (a building, so its ground floor): one walk leg, no floors. */
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
  meters: 216,
  seconds: 166,
} as const satisfies Route;

/** AG201 → AG1104 with Elevator asked for, in a building with none (user-flows' example): stairs, and S5 says so. */
export const sampleNoElevator = {
  legs: [{ kind: 'floors', building: 'andrew', from: 2, to: 11, by: 'stairs', seconds: 180, noElevator: true }],
  meters: 0,
  seconds: 180,
} as const satisfies Route;

export const sampleResults = {
  ok: { ok: true, route: sampleRoute },
  'same-room': { ok: false, reason: 'same-room' },
  'unknown-place': { ok: false, reason: 'unknown-place' },
  'no-route': { ok: false, reason: 'no-route' },
} as const satisfies Record<string, RouteResult>;
