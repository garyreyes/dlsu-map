// The floor band (DESIGN.md, Floor band; 3d): the found room's floor drawn as a solid Campus Green band one storey
// tall, 0.6 m outside the walls and inset 0.1 m top and bottom, with a floor chip on the stretch the camera can see.
// Pure: no React, no three.js. Data coordinates (x east, y north, meters). Tests: floor-band.test.ts.
import type { CampusBuilding } from '@/shared/data/campus';
import { signedArea } from './massing';

/** How far the band stands out from the walls. */
export const BAND_OFFSET = 0.6;
/** Kept clear top and bottom, so the storey lines above and below stay visible. */
const BAND_INSET = 0.1;
/** A sharp corner's offset is capped at the offset ÷ this, so a thin wedge doesn't shoot a spike out. */
const MITER_MIN_COS = 0.35;
/** Rounding slack when matching a storey to a volume's base and top, in meters. */
const EPS = 0.01;

export interface FloorBand {
  /** One outline per volume that holds the whole storey, pushed out by BAND_OFFSET. */
  readonly outlines: readonly (readonly number[])[];
  readonly bottom: number;
  readonly top: number;
}

/**
 * The band for `floor` (G = 1), or null when the building has no such storey. The storey height is the first
 * volume's height over `levels`, since `levels` counts that volume's storeys (campus.ts).
 */
export function floorBand(b: Pick<CampusBuilding, 'levels' | 'volumes'>, floor: number): FloorBand | null {
  const [first] = b.volumes;
  if (!first || !Number.isInteger(floor) || floor < 1 || floor > b.levels) return null;
  const storey = (first.top - first.base) / b.levels;
  const lo = first.base + (floor - 1) * storey;
  const hi = lo + storey;
  const holding = b.volumes.filter((v) => v.base <= lo + EPS && v.top >= hi - EPS);
  return {
    outlines: holding.map((v) => offsetOutline(v.outline, BAND_OFFSET)),
    bottom: lo + BAND_INSET,
    top: hi - BAND_INSET,
  };
}

/** The outward unit normal of the edge a → b. */
function outward(ax: number, ay: number, bx: number, by: number, anticlockwise: boolean): [number, number] {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const [dx, dy] = [(bx - ax) / len, (by - ay) / len];
  return anticlockwise ? [dy, -dx] : [-dy, dx];
}

/** A flat outline moved `d` meters outward at every edge, mitred at the corners. */
export function offsetOutline(outline: readonly number[], d: number): number[] {
  const n = outline.length / 2;
  const anticlockwise = signedArea(outline) > 0;
  const at = (i: number): [number, number] => {
    const k = ((i + n) % n) * 2;
    return [outline[k] ?? 0, outline[k + 1] ?? 0];
  };
  return Array.from({ length: n }, (_, i) => {
    const [[ax, ay], [px, py], [cx, cy]] = [at(i - 1), at(i), at(i + 1)];
    const [n1x, n1y] = outward(ax, ay, px, py, anticlockwise);
    const [n2x, n2y] = outward(px, py, cx, cy, anticlockwise);
    const ml = Math.hypot(n1x + n2x, n1y + n2y) || 1;
    const [mx, my] = [(n1x + n2x) / ml, (n1y + n2y) / ml];
    const cos = Math.max(MITER_MIN_COS, mx * n1x + my * n1y);
    return [px + (mx * d) / cos, py + (my * d) / cos];
  }).flat();
}

export interface BandSample {
  readonly x: number;
  readonly y: number;
  /** Height above the ground. */
  readonly h: number;
}

/** Each corner and the middle of each wall, at mid-height: where the chip may sit and what the camera must see. */
export function bandSamples(band: FloorBand): BandSample[] {
  const h = (band.bottom + band.top) / 2;
  return band.outlines.flatMap((o) => {
    const n = o.length / 2;
    return Array.from({ length: n }, (_, i) => {
      const [x1 = 0, y1 = 0] = [o[i * 2], o[i * 2 + 1]];
      const [x2 = 0, y2 = 0] = [o[((i + 1) % n) * 2], o[((i + 1) % n) * 2 + 1]];
      return [
        { x: x1, y: y1, h },
        { x: (x1 + x2) / 2, y: (y1 + y2) / 2, h },
      ];
    }).flat();
  });
}

/** Screen space the map shows, in px: inside the pill, the sheet and the side panel. */
export interface ViewRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** A sample projected to the screen, in px. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** Kept clear at the left edge, and at the right edge for the chip itself ("G Mezz" is the widest). */
const EDGE = 12;
const CHIP_ROOM = 96;

/**
 * The index of the right-most sample the camera can see, with room for the chip beside it, or null. `visible` casts
 * a ray, so it's asked right-most first and only until one answers yes.
 */
export function chipAnchor(
  samples: readonly ScreenPoint[],
  view: ViewRect,
  visible: (index: number) => boolean,
): number | null {
  const inside = (s: ScreenPoint) =>
    s.x > view.left + EDGE && s.x < view.right - CHIP_ROOM && s.y > view.top && s.y < view.bottom;
  const order = samples
    .flatMap((s, i) => (inside(s) ? [i] : []))
    .sort((a, b) => (samples[b]?.x ?? 0) - (samples[a]?.x ?? 0));
  return order.find(visible) ?? null;
}

/** Swings from the current heading, in degrees: the smallest turn first, both ways, then all the way round. */
const SWINGS = [0, 30, -30, 60, -60, 90, -90, 135, -135, 180];

/** Camera azimuths to try for a view that sees the band, nearest to the student's own heading first. */
export function headingCandidates(azimuth: number): number[] {
  return SWINGS.map((deg) => azimuth + (deg * Math.PI) / 180);
}

/**
 * The first heading whose view sees all `total` samples, so the camera turns as little as it can; failing that, the
 * one that sees the most (the earlier one on a tie). Null when there is nothing to try.
 */
export function bestHeading(candidates: readonly number[], seen: (azimuth: number) => number, total: number) {
  let best: { azimuth: number; seen: number } | null = null;
  for (const azimuth of candidates) {
    const n = seen(azimuth);
    if (!best || n > best.seen) best = { azimuth, seen: n };
    if (n >= total) break;
  }
  return best?.azimuth ?? null;
}
