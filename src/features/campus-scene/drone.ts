// The drone view (D61): outdoor steps and the route overview (S5) seen from nearly straight down, turned so the walk
// runs up the screen, and zoomed so what matters fits. Pure: no React, no three.js. Points are campus meters, x east,
// y north; azimuths are camera-controls' (0 puts the camera south of its target, so north is up). Tests: drone.test.ts.
import type { XY } from '@/shared/data/route';
import { angleDelta } from './gestures.ts';

/** How far `points` reach from a centre, in the screen's frame for a camera at `azimuth`: `across` is the most any
 *  point lies left or right of the centre, `along` the most any lies above or below it, meters. */
export interface Reach {
  readonly across: number;
  readonly along: number;
}

/** Flat x, y lists (a walk's line, a building's outline) as points. */
export const pointsOf = (lists: readonly (readonly number[])[]): XY[] =>
  lists.flatMap((l) =>
    Array.from({ length: Math.floor(l.length / 2) }, (_, i): XY => [l[i * 2] ?? 0, l[i * 2 + 1] ?? 0]),
  );

/** The screen's two directions on the ground for a camera at `azimuth`: where right and up point (unit vectors, campus
 *  x, y). Up is the walking direction that azimuth faces (as facingAzimuth: up = (-sin a, cos a)). */
function screenAxes(azimuth: number): { readonly right: XY; readonly up: XY } {
  const [sin, cos] = [Math.sin(azimuth), Math.cos(azimuth)];
  return { right: [cos, sin], up: [-sin, cos] };
}

const dot = (a: XY, x: number, y: number) => a[0] * x + a[1] * y;

/** How far `points` reach from `at`, which the camera keeps in the middle of the screen (a drone step: the dot stays
 *  centred, D61). Zero both ways with no points. */
export function reachFrom(points: readonly XY[], at: XY, azimuth: number): Reach {
  const { right, up } = screenAxes(azimuth);
  let [across, along] = [0, 0];
  for (const p of points) {
    const [dx, dy] = [p[0] - at[0], p[1] - at[1]];
    across = Math.max(across, Math.abs(dot(right, dx, dy)));
    along = Math.max(along, Math.abs(dot(up, dx, dy)));
  }
  return { across, along };
}

/** The smallest box round `points` in the screen's frame for a camera at `azimuth`: its middle (campus x, y) and how far
 *  it reaches from there. Null with no points. */
export function boxAround(points: readonly XY[], azimuth: number): (Reach & { readonly centre: XY }) | null {
  if (points.length === 0) return null;
  const { right, up } = screenAxes(azimuth);
  let [minR, maxR, minU, maxU] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const p of points) {
    const [r, u] = [dot(right, p[0], p[1]), dot(up, p[0], p[1])];
    [minR, maxR, minU, maxU] = [Math.min(minR, r), Math.max(maxR, r), Math.min(minU, u), Math.max(maxU, u)];
  }
  const [midR, midU] = [(minR + maxR) / 2, (minU + maxU) / 2];
  return {
    centre: [right[0] * midR + up[0] * midU, right[1] * midR + up[1] * midU],
    across: (maxR - minR) / 2,
    along: (maxU - minU) / 2,
  };
}

/** Two spreads this close (the shorter over the longer) mean the route has no clear long side. */
const SQUARE_RATIO = 0.9;

/** The walk's stretches: their middles, their vectors and their lengths. */
function stretchesOf(walk: readonly XY[]) {
  return walk.slice(1).map((b, i) => {
    const a = walk[i] ?? b;
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    return { mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as XY, dx, dy, length: Math.hypot(dx, dy) };
  });
}

/** The unit direction of the walk's long side (either way along it); null when there is no clear one. The walk is
 *  weighed by length, as a line rather than its points, so a stretch drawn with many points counts no more than one
 *  drawn with two. */
function longAxis(walk: readonly XY[]): XY | null {
  const parts = stretchesOf(walk);
  const total = parts.reduce((s, p) => s + p.length, 0);
  if (total === 0) return null;
  const [mx, my] = [0, 1].map((k) => parts.reduce((s, p) => s + p.mid[k as 0 | 1] * p.length, 0) / total);
  let [sxx, syy, sxy] = [0, 0, 0];
  // Each stretch's second moment about the mean: its middle's, plus its own spread along itself (length² / 12).
  for (const { mid, dx, dy, length } of parts) {
    const [cx, cy] = [mid[0] - (mx ?? 0), mid[1] - (my ?? 0)];
    sxx += length * (cx * cx + (dx * dx) / 12);
    syy += length * (cy * cy + (dy * dy) / 12);
    sxy += length * (cx * cy + (dx * dy) / 12);
  }
  // The covariance's eigenvalues: the mean of the diagonal, plus and minus the half-gap.
  const [mean, gap] = [(sxx + syy) / 2, Math.hypot((sxx - syy) / 2, sxy)];
  const [long, short] = [Math.sqrt(mean + gap), Math.sqrt(Math.max(0, mean - gap))];
  if (long === 0 || short >= long * SQUARE_RATIO) return null;
  const theta = Math.atan2(2 * sxy, sxx - syy) / 2;
  return [Math.cos(theta), Math.sin(theta)];
}

/**
 * The route overview's heading (S5, D61): the route's long side runs up and down the screen, with its start at the
 * bottom and its end at the top (walking direction up, as D59). `walk` is the trip's points in walking order. Null when
 * there's nothing to turn by (fewer than two distinct points), so the camera keeps its heading. `current` is the
 * camera's azimuth, so the answer is the short way round from it (as facingAzimuth).
 *
 * The long side is the points' principal axis, signed so the walk's start-to-end runs up it. With no clear long side
 * (both spreads within 10%) the start-to-end line decides alone.
 */
export function tripAzimuth(walk: readonly XY[], current: number): number | null {
  const [first, last] = [walk[0], walk.at(-1)];
  if (!first || !last || !walk.some((p) => p[0] !== first[0] || p[1] !== first[1])) return null;
  const [dx, dy] = [last[0] - first[0], last[1] - first[1]];
  // A walk that ends where it began points nowhere.
  if (dx === 0 && dy === 0) return null;
  const axis = longAxis(walk);
  const [vx, vy] = axis ? (dot(axis, dx, dy) < 0 ? [-axis[0], -axis[1]] : axis) : [dx, dy];
  return current + angleDelta(current, Math.atan2(-vx, vy));
}
