// The "you are here" dot's glide from one step's spot to the next (D52): along the route's line when both spots are on
// it, else straight. Pure: no React, no three.js. Points are campus meters, x east and y north. Tests: glide.test.ts.
import type { XY } from '@/shared/data/route';

/** How long the dot glides: the cut slide's 600 ms (SLIDE_MS, D45), so the two move as one. */
export const GLIDE_MS = 600;
/** A spot this near a line is on it, in meters. */
const ON_LINE = 1;

/** Cubic ease-out of progress 0..1, as the cut slide's: exactly 0 at the start and exactly 1 at the end. */
export const easeOut = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - (1 - p) ** 3);

/** Where a point falls on a line: how far along it, in meters, and how far off it. */
interface OnLine {
  readonly along: number;
  readonly off: number;
}

function project(line: readonly XY[], [px, py]: XY): OnLine {
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

/**
 * The way the dot goes from `from` to `to`: along the first of `lines` that both lie within a metre of, through its
 * corners, forwards or backwards; else straight. It starts and ends exactly at the two spots. One point when they meet.
 */
export function glidePath(from: XY, to: XY, lines: readonly (readonly XY[])[]): XY[] {
  if (from[0] === to[0] && from[1] === to[1]) return [[to[0], to[1]]];
  for (const line of lines) {
    const a = project(line, from);
    const b = project(line, to);
    if (a.off <= ON_LINE && b.off <= ON_LINE) {
      return [[from[0], from[1]], ...cornersBetween(line, a.along, b.along), [to[0], to[1]]];
    }
  }
  return [
    [from[0], from[1]],
    [to[0], to[1]],
  ];
}

/** The point a fraction `t` of the way along a path, by length; held to its ends outside 0..1. */
export function pointAlong(path: readonly XY[], t: number): XY {
  const first = path[0] ?? [0, 0];
  const lengths = path.slice(1).map((p, i) => {
    const q = path[i] ?? p;
    return Math.hypot(p[0] - q[0], p[1] - q[1]);
  });
  const total = lengths.reduce((s, l) => s + l, 0);
  if (t <= 0 || total === 0) return [first[0], first[1]];
  let left = Math.min(t, 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i] ?? 0;
    const [ax, ay] = path[i] ?? first;
    const [bx, by] = path[i + 1] ?? first;
    if (left <= length)
      return length === 0 ? [bx, by] : [ax + (bx - ax) * (left / length), ay + (by - ay) * (left / length)];
    left -= length;
  }
  const last = path.at(-1) ?? first;
  return [last[0], last[1]];
}
