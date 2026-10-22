// Where a fitted floor misses its OSM outline (6b, D36): the outline points, every 0.5 m as `compile-data`'s gap note
// measures them, that are further than a limit from every wall, given back on the sign so cleanup can find the
// missing wall (or the wrong corner). Pure. Tests: far.test.ts.
import { fitPoint, type Frame } from '../../scripts/compile/fit.ts';
import type { Point } from '../../scripts/compile/geometry.ts';

/** Spacing of the outline points, as `outlineGap` in fit.ts. */
const STEP = 0.5;

/** The sign point (x across, y down, 0–1) that `fitPoint` puts on `p`: Newton's method on the bilinear blend. */
export function signPointOf(f: Frame, p: Point): [number, number] {
  let [x, y] = [0.5, 0.5];
  for (let i = 0; i < 30; i++) {
    const [qx, qy] = fitPoint(f, x, y);
    const [ex, ey] = [qx - p[0], qy - p[1]];
    if (Math.hypot(ex, ey) < 1e-9) break;
    const d = 1e-6;
    const [ax, ay] = fitPoint(f, x + d, y);
    const [bx, by] = fitPoint(f, x, y + d);
    const [j11, j21, j12, j22] = [(ax - qx) / d, (ay - qy) / d, (bx - qx) / d, (by - qy) / d];
    const det = j11 * j22 - j12 * j21;
    x -= (j22 * ex - j12 * ey) / det;
    y -= (j11 * ey - j21 * ex) / det;
  }
  return [x, y];
}

function toSegment(p: Point, a: Point, b: Point): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places + 0;

/** Outline points more than `limit` meters from every wall (walls in sign units, 0–1), as sign points (4 places) with
 *  their distance (0.1 m), in outline order. */
export function farFromWalls(
  ring: readonly Point[],
  frame: Frame,
  walls: readonly (readonly number[])[],
  limit: number,
): { x: number; y: number; meters: number }[] {
  const segments = walls.flatMap((w) => {
    const pts: Point[] = [];
    for (let i = 0; i + 1 < w.length; i += 2) pts.push(fitPoint(frame, w[i] ?? 0, w[i + 1] ?? 0));
    return pts.slice(1).map((p, i) => [pts[i] as Point, p] as const);
  });
  const samples = ring.flatMap((p, i) => {
    const q = ring[(i + 1) % ring.length] as Point;
    const n = Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / STEP));
    return Array.from({ length: n }, (_, j): Point => [p[0] + ((q[0] - p[0]) * j) / n, p[1] + ((q[1] - p[1]) * j) / n]);
  });
  return samples.flatMap((s) => {
    const meters = Math.min(...segments.map(([a, b]) => toSegment(s, a, b)));
    if (meters <= limit) return [];
    const [x, y] = signPointOf(frame, s);
    return [{ x: round(x, 4), y: round(y, 4), meters: round(meters, 1) }];
  });
}
