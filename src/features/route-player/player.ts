// The step player (S6) and Arrived (S9), user-flows §3.7–3.8: which step the card shows, where the camera and the
// "you are here" dot go for it (D44), and what Arrived says. Pure: no React, no fetch.
import type { From, Route, To, XY } from '@/shared/data/route';
import { emptyRouteLine, rowOf, toName, type PlaceNames, type StepIconKey } from './steps-list';

/** The step as the card shows it. */
export interface StepCard {
  /** "Step 3 of 9". */
  readonly counter: string;
  readonly icon: StepIconKey;
  readonly title: string;
  readonly subtitle?: string;
  /** Back is off on the first step. */
  readonly first: boolean;
  /** Next reads "I’m here" on the last step. */
  readonly last: boolean;
}

/**
 * Where the map looks for a step (D44). Outdoors, the step's spot, facing `toward` (the way the student walks from
 * there). Indoors, the building and floor the cutaway opens, and on a labelled floor the step's spot too, seen from
 * close and facing the walk like outdoors (7▸); without a spot the whole building.
 */
export type StepFocus =
  | { readonly kind: 'ground'; readonly at: XY; readonly toward: XY | null }
  | {
      readonly kind: 'floor';
      readonly building: string;
      readonly floor: number;
      /** Where on that floor the step happens (a turn, the stairs, the room's door), when the floor is labelled (8b).
       *  Without it the map frames the whole building (7▸). */
      readonly at?: XY;
      /** The way the student walks from `at`, so the camera faces it, as outdoors. */
      readonly toward?: XY | null;
      /** The floor the route's stay in this building ends on: the room's floor, or the exit floor on the way out. The
       *  floor rail marks it (7▸). */
      readonly goal?: number;
    };

/** A step index inside the route: 0 to its last step, and 0 for a route with no steps. */
export const clampStep = (route: Route, index: number): number => Math.max(0, Math.min(index, route.steps.length - 1));

export function stepCard(route: Route, index: number): StepCard | null {
  const step = route.steps[index];
  if (step === undefined) return null;
  const { icon, title, subtitle } = rowOf(step, index, route);
  const total = route.steps.length;
  return {
    counter: `Step ${String(index + 1)} of ${String(total)}`,
    icon,
    title,
    ...(subtitle === undefined ? {} : { subtitle }),
    first: index === 0,
    last: index === total - 1,
  };
}

export function stepFocus(route: Route, index: number): StepFocus | null {
  const step = route.steps[index];
  const leg = step && route.legs[step.leg];
  if (!step || !leg) return null;
  const at = 'at' in step ? step.at : undefined;
  switch (leg.kind) {
    // A floors step: the stairs or elevator the student takes, on the floor they leave from. They're about to climb,
    // so there is nothing to face.
    case 'floors': {
      const spot = at ?? leg.at;
      const goal = goalFloor(route, step.leg, leg.building);
      const floor = { kind: 'floor', building: leg.building, floor: leg.from, goal } as const;
      return spot ? { ...floor, at: spot, toward: null } : floor;
    }
    // An indoor step: its spot on that floor, facing the way along the hallway (7▸).
    case 'indoor': {
      const goal = goalFloor(route, step.leg, leg.building);
      const floor = { kind: 'floor', building: leg.building, floor: leg.floor, goal } as const;
      return at ? { ...floor, at, toward: towardOf(leg.path, at) } : floor;
    }
    case 'walk':
      return at ? { kind: 'ground', at, toward: towardOf(leg.path, at) } : null;
  }
}

/** The floor the route's stay in the leg's building ends on: the last floor of the unbroken run of indoor and floors
 *  legs there. The room's floor on the way in, the exit floor on the way out. */
function goalFloor(route: Route, legIndex: number, building: string): number {
  let goal = 0;
  for (const leg of route.legs.slice(legIndex)) {
    if (leg.kind === 'walk' || leg.building !== building) break;
    goal = leg.kind === 'floors' ? leg.to : leg.floor;
  }
  return goal;
}

/** How far ahead the camera looks along the walk, in meters, so a short jog (off a curb, round a post) doesn't turn it. */
const LOOK_AHEAD = 15;

/** The first point of the walk at least LOOK_AHEAD past the one nearest `at`, or the walk's end if it's closer. At
 *  the end itself, the last stretch carried on as far again, so the camera keeps facing the way the student walks in. */
function towardOf(path: readonly XY[], at: XY): XY | null {
  let nearest = 0;
  path.forEach((p, i) => {
    if (dist2(p, at) < dist2(path[nearest] ?? p, at)) nearest = i;
  });
  let walked = 0;
  for (let i = nearest + 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]];
    if (!a || !b) break;
    walked += Math.sqrt(dist2(a, b));
    if (walked >= LOOK_AHEAD || i === path.length - 1) return b;
  }
  const before = path[nearest - 1];
  const end = path[nearest];
  if (!before || !end) return null;
  return [round(2 * end[0] - before[0]), round(2 * end[1] - before[1])];
}

const dist2 = (a: XY, b: XY) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Find next room (S9): the next search starts where this trip ended. A building trip ends at its ground floor. */
export const nextFrom = (to: To): From =>
  to.kind === 'room' ? { kind: 'room', code: to.code } : { kind: 'building', building: to.building, floor: 1 };

/** S9's heading: "You’re at ST311". With no steps the student was already there, so it says that instead. */
export const arrivedHeading = (route: Route, to: To, names: Pick<PlaceNames, 'short'>): string =>
  route.steps.length === 0 ? emptyRouteLine(to, names) : `You’re at ${toName(to, names)}`;

/** "VL313 is on 3F · indoor map coming" when the room's building has no indoor map yet (O5), else null. */
export function indoorMapComing(
  route: Route,
  room: { readonly code: string; readonly building: string; readonly floor: number },
  names: Pick<PlaceNames, 'floor'>,
): string | null {
  if (!(route.noIndoorMap ?? []).includes(room.building)) return null;
  return `${room.code} is on ${names.floor(room.building, room.floor)} · indoor map coming`;
}
