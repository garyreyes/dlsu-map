// Plane geometry in local meters for the compiler. Pure. Tests: geometry.test.ts.

export type Point = readonly [x: number, y: number];
export interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Twice the signed area (shoelace); positive when the ring runs anticlockwise. */
function signedArea2(ring: readonly Point[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as Point;
    const [xj, yj] = ring[j] as Point;
    sum += xj * yi - xi * yj;
  }
  return sum;
}

export const ringArea = (ring: readonly Point[]): number => Math.abs(signedArea2(ring)) / 2;

/** The area centroid of a ring (not the average of its points, which drifts toward densely drawn sides). */
export function centroid(ring: readonly Point[]): [number, number] {
  const a2 = signedArea2(ring);
  if (a2 === 0)
    return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as Point;
    const [xj, yj] = ring[j] as Point;
    const cross = xj * yi - xi * yj;
    cx += (xj + xi) * cross;
    cy += (yj + yi) * cross;
  }
  return [cx / (3 * a2), cy / (3 * a2)];
}

/** Even-odd ray test. Points exactly on an edge may land either way; the compiler never depends on that. */
export function pointInRing([x, y]: Point, ring: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as Point;
    const [xj, yj] = ring[j] as Point;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const inRect = ([x, y]: Point, r: Rect): boolean => x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY;

/** One segment cut to the rectangle (Liang–Barsky), or null if none of it is inside. */
function clipSegment(a: Point, b: Point, r: Rect): [Point, Point] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a[0] - r.minX],
    [dx, r.maxX - a[0]],
    [-dy, a[1] - r.minY],
    [dy, r.maxY - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  const at = (t: number): Point => [a[0] + t * dx, a[1] + t * dy];
  return [t0 === 0 ? a : at(t0), t1 === 1 ? b : at(t1)];
}

const same = (a: Point | undefined, b: Point): boolean => a !== undefined && a[0] === b[0] && a[1] === b[1];

/** A polyline cut to the rectangle: zero or more pieces of at least 2 distinct points, never repeating a point. */
export function clipLine(line: readonly Point[], r: Rect): Point[][] {
  const pieces: Point[][] = [];
  let current: Point[] = [];
  for (let i = 1; i < line.length; i++) {
    const seg = clipSegment(line[i - 1] as Point, line[i] as Point, r);
    if (!seg || same(seg[0], seg[1])) continue; // outside, or only touching the edge at one point
    if (same(current.at(-1), seg[0])) current.push(seg[1]);
    else {
      if (current.length > 1) pieces.push(current);
      current = [seg[0], seg[1]];
    }
  }
  if (current.length > 1) pieces.push(current);
  return pieces;
}

/** Which side of the line p→q the point r is on: 1, -1, or 0 when on the line. */
const side = (p: Point, q: Point, r: Point): number =>
  Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
const within = (p: Point, q: Point, r: Point): boolean =>
  Math.min(p[0], q[0]) <= r[0] &&
  r[0] <= Math.max(p[0], q[0]) &&
  Math.min(p[1], q[1]) <= r[1] &&
  r[1] <= Math.max(p[1], q[1]);

/** Whether segments ab and cd meet, counting a touch at an end or along a shared stretch. */
function segmentsMeet(a: Point, b: Point, c: Point, d: Point): boolean {
  const [s1, s2, s3, s4] = [side(a, b, c), side(a, b, d), side(c, d, a), side(c, d, b)];
  if (s1 !== s2 && s3 !== s4 && s1 * s2 <= 0 && s3 * s4 <= 0) return true;
  return (
    (s1 === 0 && within(a, b, c)) ||
    (s2 === 0 && within(a, b, d)) ||
    (s3 === 0 && within(c, d, a)) ||
    (s4 === 0 && within(c, d, b))
  );
}

const edges = (ring: readonly Point[]): [Point, Point][] =>
  ring.map((p, i) => [p, ring[(i + 1) % ring.length] as Point]);

/** Whether two rings overlap or touch at all: a corner inside the other, or any two edges meeting. */
export function ringsTouch(a: readonly Point[], b: readonly Point[]): boolean {
  if (a.some((p) => pointInRing(p, b)) || b.some((p) => pointInRing(p, a))) return true;
  const eb = edges(b);
  return edges(a).some(([p, q]) => eb.some(([r, s]) => segmentsMeet(p, q, r, s)));
}

export function boundsOf(points: readonly Point[]): Rect {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export const expand = (r: Rect, by: number): Rect => ({
  minX: r.minX - by,
  minY: r.minY - by,
  maxX: r.maxX + by,
  maxY: r.maxY + by,
});

/** Meters to 0.1 m, without -0 (which JSON writes as 0 anyway, but tests compare with Object.is). */
export const round = (n: number): number => Math.round(n * 10) / 10 + 0;
