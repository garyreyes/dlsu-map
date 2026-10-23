// The exit choice in Route options (8c-2, D43): which doors a student can leave From's building by, and which one the
// quickest route took. Pure: no React, no fetch. Tests: exits.test.ts.
import type { Entrance } from '@/shared/data/campus';
import type { From, Route } from '@/shared/data/route';
import { doorWords } from '@/shared/data/spot-words';

export interface ExitChoices {
  /** The building the student leaves, by slug. */
  readonly building: string;
  /** All its doors, in `campus.json` order, each by its index there. */
  readonly doors: readonly { entrance: number; label: string }[];
  /** The index of the door the route walks out of, when it says. */
  readonly taken: number | undefined;
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The doors to choose from, or null when there is no choice: a gate From, a From standing at a door, a route that
 *  doesn't walk out of a building, or a building with one door. A room From leaves its building like a building does. */
export function exitChoices(route: Route, from: From, entrances: readonly Entrance[]): ExitChoices | null {
  if (from.kind === 'gate') return null;
  if (from.kind === 'building' && from.spot?.kind === 'entrance') return null;
  const walk = route.legs.find((leg) => leg.kind === 'walk');
  if (walk?.kind !== 'walk' || walk.from.kind !== 'door') return null;
  const { building, entrance } = walk.from;
  const doors = entrances.flatMap((e, i) =>
    e.building === building ? [{ entrance: i, label: capital(doorWords(e)) }] : [],
  );
  return doors.length < 2 ? null : { building, doors, taken: entrance };
}

/** "Quickest is the main entrance facing Agno.", when Quickest is chosen and the route says which door it took. */
export function takenLine(choices: ExitChoices, exit: number | undefined): string | null {
  if (exit !== undefined || choices.taken === undefined) return null;
  const door = choices.doors.find((d) => d.entrance === choices.taken);
  return door === undefined ? null : `Quickest is the ${door.label.charAt(0).toLowerCase()}${door.label.slice(1)}.`;
}
