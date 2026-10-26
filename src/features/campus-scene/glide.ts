// The "you are here" dot's glide from one step's spot to the next (D52): along the route's line when both spots are on
// it, else straight, and up or down at the stairs between floors. Pure: no React, no three.js. Points are campus
// meters, x east and y north, with h up where heights matter. Tests: glide.test.ts.
import type { XY } from '@/shared/data/route';

/** How long the dot glides: the cut slide's 600 ms (SLIDE_MS, D45), so the two move as one. */
export const GLIDE_MS = 600;
/** A spot this near a line is on it, in meters. */
const ON_LINE = 1;
/** How far the stairs on one floor may sit from the next floor's line, in meters: each floor's stairs were traced on
 *  their own, and St. Joseph's sit up to 6.6 m apart from floor to floor. */
const STAIRS_GAP = 8;

/** Cubic ease-out of progress 0..1, as the cut slide's: exactly 0 at the start and exactly 1 at the end. */
export const easeOut = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - (1 - p) ** 3);

/** Where a point falls on a line: how far along it, in meters, and how far off it. */
interface OnLine {
  readonly along: number;
  readonly off: number;
}

export function project(line: readonly XY[], [px, py]: XY): OnLine {
  let best: OnLine = { along: 0, off: Infinity };
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1] ?? [0, 0];
    const [bx, by] = line[i] ?? [0, 0];
    const length = Math.hypot(bx - ax, by - ay);
    const t =
      length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / length ** 2));
    const off = Math.hypot(ax + t * (bx - ax) - px, ay + t * (by - ay) - py);
    if (off < best.off) best = { along: walked + t * length, off };
    walked += length;
  }
  return best;
}

/** The line's corners strictly between two distances along it, in the order walked from `a` to `b`. */
function cornersBetween(line: readonly XY[], a: number, b: number): XY[] {
  const corners: XY[] = [];
  let walked = 0;
  for (let i = 0; i < line.length; i++) {
    const p = line[i];
    const prev = line[i - 1];
    if (p && prev) walked += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    if (p && walked > Math.min(a, b) && walked < Math.max(a, b)) corners.push([p[0], p[1]]);
  }
  return a <= b ? corners : corners.reverse();
}

/** The stretch of the first of `lines` that both spots lie within a metre of, through its corners, forwards or
 *  backwards, starting and ending exactly at the spots; one point when they meet. Null when no one line has both. */
function alongLine(
  from: XY,
  to: XY,
  lines: readonly (readonly XY[])[],
  fromGap = ON_LINE,
  toGap = ON_LINE,
): XY[] | null {
  if (from[0] === to[0] && from[1] === to[1]) return [[to[0], to[1]]];
  for (const line of lines) {
    const a = project(line, from);
    const b = project(line, to);
    if (a.off <= fromGap && b.off <= toGap) {
      return [[from[0], from[1]], ...cornersBetween(line, a.along, b.along), [to[0], to[1]]];
    }
  }
  return null;
}

/** The way the dot goes from `from` to `to` on the map: along the route's line when one has both spots, else straight. */
export function glidePath(from: XY, to: XY, lines: readonly (readonly XY[])[]): XY[] {
  return (
    alongLine(from, to, lines) ?? [
      [from[0], from[1]],
      [to[0], to[1]],
    ]
  );
}

/** A spot with its height above the ground, meters: x east, y north, h up. */
export type XYH = readonly [number, number, number];

const flat = (p: XYH): XY => [p[0], p[1]];
const at = (p: XY, h: number): XYH => [p[0], p[1], h];

/** On one level (D52): the way along the line, its height changing evenly with the distance walked, so a step through a
 *  door on the ground to a spot on G (a metre up) rises as it goes in. */
export function levelPath(from: XYH, to: XYH, lines: readonly (readonly XY[])[]): XYH[] {
  const path = glidePath(flat(from), flat(to), lines);
  const walked = path.map((_, i) => length(path.slice(0, i + 1)));
  const total = walked.at(-1) ?? 0;
  const rise = to[2] - from[2];
  return path.map((p, i) => at(p, total === 0 ? to[2] : from[2] + (rise * (walked[i] ?? 0)) / total));
}

/**
 * Between two floors of one building (D52): the dot changes floor at the stairs. When the new floor's line has both
 * spots (Next: from the stairs to the room) it rises first, then walks; when the old floor's has them (Back: from the
 * room to the stairs) it walks, then drops. With neither, it rises and goes straight.
 */
export function climbPath(
  from: XYH,
  to: XYH,
  fromLines: readonly (readonly XY[])[],
  toLines: readonly (readonly XY[])[],
): XYH[] {
  // The stairs end may be off the other floor's line (STAIRS_GAP); the hop to it happens on the line's floor.
  const after = alongLine(flat(from), flat(to), toLines, STAIRS_GAP);
  if (after) return [at(flat(from), from[2]), ...after.map((p) => at(p, to[2]))];
  const before = alongLine(flat(from), flat(to), fromLines, ON_LINE, STAIRS_GAP);
  if (before) return [...before.map((p) => at(p, from[2])), at(flat(to), to[2])];
  return [at(flat(from), from[2]), at(flat(from), to[2]), at(flat(to), to[2])];
}

const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, k) => (b[k] ?? v) - v));
const length = (path: readonly (readonly number[])[]) =>
  path.slice(1).reduce((s, p, i) => s + distance(path[i] ?? p, p), 0);

/** The point a fraction `t` of the way along a path, by length (a climb counts its height); held to its ends outside
 *  0..1. Works for flat (x, y) and raised (x, y, h) paths alike. */
export function pointAlong<P extends readonly number[]>(path: readonly P[], t: number): P {
  const first = path[0];
  if (!first) throw new Error('pointAlong: an empty path');
  const lengths = path.slice(1).map((p, i) => distance(path[i] ?? p, p));
  const total = lengths.reduce((s, l) => s + l, 0);
  if (t <= 0 || total === 0) return [...first] as unknown as P;
  let left = Math.min(t, 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    const segment = lengths[i] ?? 0;
    const a = path[i] ?? first;
    const b = path[i + 1] ?? first;
    if (left <= segment) {
      const f = segment === 0 ? 1 : left / segment;
      return a.map((v, k) => v + ((b[k] ?? v) - v) * f) as unknown as P;
    }
    left -= segment;
  }
  return [...(path.at(-1) ?? first)] as unknown as P;
}
