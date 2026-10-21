// Turn geometry for the directions (4c, D35). Headings are in the campus frame, x east and y north, so a positive
// change of heading (counterclockwise) is a LEFT turn.
import type { Turn, XY } from '@/shared/data/route';

/** Turns closer than this along the walk merge into one, by their overall change of direction (D35). */
export const MERGE_METERS = 15;
/** A bend under this is a wobble in the drawing: it never starts or joins a merged turn. */
export const WOBBLE_DEGREES = 10;
/** A building this close to a turn can name it (D35). */
export const LANDMARK_METERS = 20;

/** Degrees counterclockwise from east. */
export const heading = (a: XY, b: XY): number => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

/** The change from one heading to the next, in (-180, 180]: positive is left. */
export function bend(before: number, after: number): number {
  const d = (after - before) % 360;
  if (d > 180) return d - 360;
  return d <= -180 ? d + 360 : d;
}

/** PLAN §6.3: under 30° is straight on (null), slight to 60°, a turn to 135°, sharp beyond. */
export function turnOf(degrees: number): Turn | null {
  const size = Math.abs(degrees);
  if (size < 30) return null;
  const side = degrees > 0 ? 'left' : 'right';
  if (size < 60) return side === 'left' ? 'slight-left' : 'slight-right';
  if (size <= 135) return side;
  return side === 'left' ? 'sharp-left' : 'sharp-right';
}

/** The verb for a turn: "Bear left", "Turn left", "Turn sharp left". */
export function turnWords(turn: Turn): string {
  if (turn.startsWith('slight-')) return `Bear ${turn.slice('slight-'.length)}`;
  if (turn.startsWith('sharp-')) return `Turn sharp ${turn.slice('sharp-'.length)}`;
  return `Turn ${turn}`;
}

/** Meters from a point to a closed outline (flat x, y pairs); 0 inside it. */
export function distanceToOutline([x, y]: XY, outline: readonly number[]): number {
  const n = outline.length / 2;
  let inside = false;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = outline[2 * j] ?? 0;
    const ay = outline[2 * j + 1] ?? 0;
    const bx = outline[2 * i] ?? 0;
    const by = outline[2 * i + 1] ?? 0;
    if (by > y !== ay > y && x < ((ax - bx) * (y - by)) / (ay - by) + bx) inside = !inside;
    best = Math.min(best, toSegment([x, y], [ax, ay], [bx, by]));
  }
  return inside ? 0 : best;
}

function toSegment([x, y]: XY, [ax, ay]: XY, [bx, by]: XY): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** Rounded for showing (D35): to 5 m under 100 m, and to 10 m from there. A short walk is never shown below 5 m, but
 *  none at all (the next step is on the same spot) is 0. */
export function shownMeters(meters: number): number {
  if (meters === 0) return 0;
  if (meters < 100) return Math.max(5, Math.round(meters / 5) * 5);
  return Math.round(meters / 10) * 10;
}
