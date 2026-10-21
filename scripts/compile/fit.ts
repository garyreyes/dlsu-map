// Fit a floor, traced in sign coordinates, onto its building's OSM outline (D36). Pure. Tests: fit.test.ts.
// The sign is stretched along each axis on its own so its outer walls sit on the outline; which way round it goes
// can't be read from the outline, so the floor file's `turn` says (0: top as near north as possible, 180: south).
import { signedArea2, type Point } from './geometry.ts';

/** Where the sign's four corners land, in meters. */
export interface Frame {
  readonly tl: Point;
  readonly tr: Point;
  readonly br: Point;
  readonly bl: Point;
}

/** A bend smaller than this is a point along a straight side, not a corner. */
const STRAIGHT_DEGREES = 5;
/** Spacing of the points along the outline that `outlineGap` measures from. */
const GAP_STEP = 0.5;

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const at = <T>(list: readonly T[], i: number): T => list[((i % list.length) + list.length) % list.length] as T;

/** The ring without points where it barely bends. */
function corners(ring: readonly Point[]): Point[] {
  return ring.filter((p, i) => {
    const [ax, ay] = sub(p, at(ring, i - 1));
    const [bx, by] = sub(at(ring, i + 1), p);
    const bend = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    return bend >= (STRAIGHT_DEGREES * Math.PI) / 180;
  });
}

/** Convex hull, anticlockwise (monotone chain). */
function hull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: readonly Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(at(out, -2), at(out, -1), p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** The smallest rectangle around the points, anticlockwise. It lies along one of the hull's sides. */
function smallestRectangle(points: readonly Point[]): Point[] {
  const h = hull(points);
  let best: { area: number; corners: Point[] } | null = null;
  for (let i = 0; i < h.length; i++) {
    const [dx, dy] = sub(at(h, i + 1), at(h, i));
    const len = Math.hypot(dx, dy);
    const [c, s] = [dx / len, dy / len];
    const us = h.map(([x, y]) => x * c + y * s);
    const vs = h.map(([x, y]) => -x * s + y * c);
    const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
    const area = (u1 - u0) * (v1 - v0);
    const back = (u: number, v: number): Point => [u * c - v * s, u * s + v * c];
    if (!best || area < best.area) best = { area, corners: [back(u0, v0), back(u1, v0), back(u1, v1), back(u0, v1)] };
  }
  return best?.corners ?? [];
}

/** The four corners the sign is stretched onto, anticlockwise: OSM's own when it draws 4, else the smallest
 *  rectangle around the outline. */
export function outlineCorners(ring: readonly Point[]): Point[] {
  const anticlockwise = signedArea2(ring) < 0 ? [...ring].reverse() : [...ring];
  const four = corners(anticlockwise);
  return four.length === 4 ? four : smallestRectangle(anticlockwise);
}

/** Which outline corner each sign corner lands on. A landscape sign's top goes on one of the long sides (a portrait
 *  sign's on a short one): the one facing nearest north for turn 0, the other for 180. Never mirrored. */
export function fitFrame(
  ring: readonly Point[],
  plan: { readonly width: number; readonly height: number },
  turn: 0 | 180,
): Frame {
  const q = outlineCorners(ring);
  const length = (i: number) => Math.hypot(...sub(at(q, i + 1), at(q, i)));
  const firstPairLong = length(0) + length(2) >= length(1) + length(3);
  const onLong = plan.width >= plan.height;
  const [a, b] = firstPairLong === onLong ? [0, 2] : [1, 3];
  // An anticlockwise ring's outside is on the right of each side: side (dx, dy) faces (dy, -dx).
  const facing = (i: number): [number, number] => {
    const [dx, dy] = sub(at(q, i + 1), at(q, i));
    return [dy, -dx];
  };
  const [na, nb] = [facing(a), facing(b)];
  const aNorther = na[1] / Math.hypot(...na) - nb[1] / Math.hypot(...nb);
  const north = aNorther > 0 || (aNorther === 0 && na[0] >= nb[0]) ? a : b;
  const top = turn === 0 ? north : north === a ? b : a;
  // Anticlockwise, the top side runs from the sign's top-right corner to its top-left.
  return { tr: at(q, top), tl: at(q, top + 1), bl: at(q, top + 2), br: at(q, top + 3) };
}

/** A sign point (x across, y down, 0–1) in meters: blended between the four corners. */
export function fitPoint(f: Frame, x: number, y: number): Point {
  const blend = (i: 0 | 1) =>
    (1 - x) * (1 - y) * f.tl[i] + x * (1 - y) * f.tr[i] + x * y * f.br[i] + (1 - x) * y * f.bl[i];
  return [blend(0), blend(1)];
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const [abx, aby] = sub(b, a);
  const [apx, apy] = sub(p, a);
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / len2));
  return Math.hypot(apx - abx * t, apy - aby * t);
}

/** How far the outline is from the nearest fitted wall: points every 0.5 m along it, median and 90th percentile. A
 *  large gap means corners read wrong or outer walls missed by the extraction. */
export function outlineGap(
  ring: readonly Point[],
  walls: readonly (readonly Point[])[],
): { median: number; p90: number } {
  const segments = walls.flatMap((w) => w.slice(1).map((p, i) => [at(w, i), p] as const));
  const samples = ring.flatMap((p, i) => {
    const [dx, dy] = sub(at(ring, i + 1), p);
    const n = Math.max(1, Math.round(Math.hypot(dx, dy) / GAP_STEP));
    return Array.from({ length: n }, (_, j): Point => [p[0] + (dx * j) / n, p[1] + (dy * j) / n]);
  });
  const gaps = samples
    .map((s) => Math.min(...segments.map(([a, b]) => distanceToSegment(s, a, b))))
    .sort((a, b) => a - b);
  return { median: at(gaps, Math.floor(gaps.length / 2)), p90: at(gaps, Math.floor(gaps.length * 0.9)) };
}
