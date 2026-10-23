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

/** The goal room's door the route ends at: the one nearest the end of the walk, else its first, else the room's label
 *  point. Data coordinates. */
export function doorOf(
  indoor: { readonly graph: { readonly points: readonly number[] } },
  room: { readonly doors: readonly number[]; readonly label: readonly [number, number] },
  end: readonly number[] | undefined,
): [number, number] {
  const pts = room.doors.map((d): [number, number] => [
    indoor.graph.points[d * 2] ?? 0,
    indoor.graph.points[d * 2 + 1] ?? 0,
  ]);
  if (end?.length === 2) {
    const [ex, ey] = [end[0] ?? 0, end[1] ?? 0];
    pts.sort((a, b) => Math.hypot(a[0] - ex, a[1] - ey) - Math.hypot(b[0] - ex, b[1] - ey));
  }
  return pts[0] ?? [room.label[0], room.label[1]];
}
