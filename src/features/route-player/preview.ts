// What the route preview (S5) says about a route (user-flows §3.6): the summary, and the lines that say where the
// route had to make do. Pure: no React, no fetch.
import type { From, Route, RouteResult, To } from '@/shared/data/route';
import { fromName, toName, totalsLine, type PlaceNames } from './steps-list';

/** "About 4 min · 230 m walk · via elevator". The "via" part says how the floors are taken, and is left out when no
 *  floor changes. */
export function summaryLine(route: Route): string {
  const by = new Set(route.legs.flatMap((l) => (l.kind === 'floors' ? [l.by] : [])));
  const via =
    by.size === 2 ? 'elevator and stairs' : by.has('elevator') ? 'elevator' : by.has('stairs') ? 'stairs' : null;
  return via === null ? totalsLine(route) : `${totalsLine(route)} · via ${via}`;
}

/** "No elevator in Andrew. Using stairs.", once for each building where Elevator was chosen but there is none. */
export function noElevatorLines(route: Route, names: Pick<PlaceNames, 'short'>): string[] {
  const buildings = route.legs.flatMap((l) => (l.kind === 'floors' && l.noElevator === true ? [l.building] : []));
  return [...new Set(buildings)].map((b) => `No elevator in ${names.short(b)}. Using stairs.`);
}

/**
 * Where the directions stop short because a building has no indoor map yet (O5, D43). Inside one building they give
 * only the floor. Otherwise the walk's last door tells the To building, which stops them at its door, from the From
 * building, which starts them there.
 */
export function noIndoorMapLines(route: Route, names: Pick<PlaceNames, 'short'>): string[] {
  const missing = route.noIndoorMap ?? [];
  const [first, second] = missing.map((b) => names.short(b));
  if (first === undefined) return [];
  if (second !== undefined)
    return [`${first} and ${second} have no indoor maps yet, so directions go from door to door.`];
  const walk = route.legs.find((l) => l.kind === 'walk');
  if (walk === undefined) return [`${first} has no indoor map yet, so directions only give the floor.`];
  const atTo = walk.to.kind === 'door' && walk.to.building === missing[0];
  return [`${first} has no indoor map yet, so directions ${atTo ? 'stop' : 'start'} at its door.`];
}

/** Why there's no route, in the preview's words. */
export function notOkLine(
  reason: Extract<RouteResult, { ok: false }>['reason'],
  from: From,
  to: To,
  names: PlaceNames,
): string {
  switch (reason) {
    case 'no-route':
      return `We can’t find a way from ${fromName(from, names)} to ${toName(to, names)} yet.`;
    case 'same-room':
      return `You’re already at ${toName(to, names)}.`;
    case 'unknown-place':
      return 'A place on this route isn’t in the map data.';
  }
}
