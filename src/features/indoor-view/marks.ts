// What the cut floor draws for the route (8c, D46): pure, so it's tested without a canvas.
import type { Route, XY } from '@/shared/data/route';
import type { CutMarks, Cutaway } from './cutaway';

/** The route's walk on the cut floor of the cut building, and its goal room if the `arrive` step is on that floor. */
export function cutMarks(route: Route | null, cutaway: Cutaway): CutMarks {
  if (!route) return { lines: [] };
  const here = (l: Route['legs'][number]) =>
    l.kind === 'indoor' && l.building === cutaway.building && l.floor === cutaway.floor;
  const lines: (readonly XY[])[] = route.legs.flatMap((l) => (l.kind === 'indoor' && here(l) ? [l.path] : []));
  const arrive = route.steps.find((s) => s.kind === 'arrive');
  const leg = arrive ? route.legs[arrive.leg] : undefined;
  return arrive && leg && here(leg) ? { lines, goalRoom: arrive.code } : { lines };
}
