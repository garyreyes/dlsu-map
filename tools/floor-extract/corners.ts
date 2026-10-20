// The building's 4 outer corners in the photo, as Claude reads them off zoomed crops (`crop` command). Checked before
// anything is straightened: corners in the wrong order fold the plan without any error. Tests: corners.test.ts.
import type { Point } from './image.ts';

export type Corners = readonly [tl: Point, tr: Point, br: Point, bl: Point];
const ORDER = 'top-left, top-right, bottom-right, bottom-left';
/** Smaller than this, the corners are probably a pillar or a room, not the building. */
const MIN_SIDE = 200;

/** `"120,340"` → [120, 340]; null for anything else (negative numbers included). */
export function parsePoint(text: string): [number, number] | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*$/.exec(text);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Twice the signed area of the turn a → b → c; positive = clockwise on screen (y grows downward). */
const turn = (a: Point, b: Point, c: Point): number => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function checkCorners(
  points: readonly Point[],
  size: { readonly width: number; readonly height: number },
): { corners: Corners } | { error: string } {
  const [tl, tr, br, bl] = points;
  if (points.length !== 4 || !tl || !tr || !br || !bl) return { error: `give 4 corners: ${ORDER}` };
  const outside = points.findIndex(([x, y]) => x < 0 || y < 0 || x >= size.width || y >= size.height);
  if (outside >= 0) {
    const [x, y] = points[outside] as Point;
    const where = `${String(outside + 1)} (${String(x)}, ${String(y)})`;
    return { error: `corner ${where} is outside the ${String(size.width)}×${String(size.height)} photo` };
  }
  const ring = [tl, tr, br, bl];
  if (!ring.every((p, i) => turn(p, ring[(i + 1) % 4] as Point, ring[(i + 2) % 4] as Point) > 0)) {
    return { error: `corners must go clockwise: ${ORDER}` };
  }
  const sums = ring.map(([x, y]) => x + y);
  if (Math.min(...sums) !== sums[0]) return { error: 'corner 1 must be the top-left one (smallest x + y)' };
  const width = Math.max(dist(tl, tr), dist(bl, br));
  const height = Math.max(dist(tl, bl), dist(tr, br));
  if (width < MIN_SIDE || height < MIN_SIDE) {
    return {
      error: `the plan is only ${String(Math.round(width))}×${String(Math.round(height))} px; pick the outer corners`,
    };
  }
  return { corners: [tl, tr, br, bl] };
}
