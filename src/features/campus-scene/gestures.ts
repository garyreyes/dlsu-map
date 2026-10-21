// Gesture maths for the map: no React, no DOM. Screen points are CSS pixels with y growing downward. The touch
// wiring that feeds these lives in components/useTwistTilt.ts.
import { COMPASS_MIN_DEG, TAP_MAX_MOVE, TAP_MAX_MS, TILT_PER_SCREEN } from '@/shared/config/camera';

export interface Point {
  x: number;
  y: number;
}

const TURN = 2 * Math.PI;

/** The signed change from one angle to another the short way round, in (-π, π]. */
export function angleDelta(from: number, to: number): number {
  const d = to - from;
  return d - TURN * Math.ceil((d - Math.PI) / TURN);
}

/** The angle of the line from `a` to `b` on screen. A two-finger twist is the change in this angle. */
export function lineAngle(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * How far a two-finger drag tilts the map, as a change in the camera's angle from straight down. Only counts when
 * both fingers move vertically in the same direction, so a pinch or a sideways slide never tilts. Fingers moving up
 * tilt toward the horizon (positive), down tilts back toward straight down.
 */
export function tiltDelta(prev: [Point, Point], next: [Point, Point], viewportHeight: number): number {
  if (viewportHeight <= 0) return 0;
  const move = (i: 0 | 1) => ({ dx: next[i].x - prev[i].x, dy: next[i].y - prev[i].y });
  const a = move(0);
  const b = move(1);
  const together = Math.sign(a.dy) !== 0 && Math.sign(a.dy) === Math.sign(b.dy);
  const vertical = Math.abs(a.dy) >= Math.abs(a.dx) && Math.abs(b.dy) >= Math.abs(b.dx);
  if (!together || !vertical) return 0;
  return (-(a.dy + b.dy) / 2 / viewportHeight) * TILT_PER_SCREEN;
}

/** How far the map is turned from its home heading, in degrees within [-180, 180). Drives the compass. */
export function headingDeg(azimuth: number, homeAzimuth: number): number {
  const deg = ((azimuth - homeAzimuth) * 180) / Math.PI;
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** The compass shows only while the map is turned more than a few degrees (DESIGN.md, Compass). */
export function showCompass(deg: number): boolean {
  return Math.abs(deg) > COMPASS_MIN_DEG;
}

export interface TwoFingerTracker {
  down: (id: number, at: Point) => void;
  /** How far this move turns (radians, `twist`) and tilts (radians, `tilt`) the map. */
  move: (id: number, at: Point, viewportHeight: number) => { twist: number; tilt: number };
  up: (id: number) => void;
}

/**
 * Follows the fingers on the map for twist and tilt. Pointer events move one finger at a time, so twist is judged on
 * every move (the angle between the fingers changes either way), but tilt waits until both fingers have moved since
 * it was last judged; otherwise the still finger always reads as "not moving" and tilt could never fire.
 */
export function createTwoFingerTracker(): TwoFingerTracker {
  const at = new Map<number, Point>();
  const moved = new Set<number>();
  let tiltFrom: [Point, Point] | null = null;

  const pair = (): [Point, Point] | null => {
    const [a, b] = [...at.values()];
    return at.size === 2 && a && b ? [a, b] : null;
  };
  const restart = () => {
    tiltFrom = pair();
    moved.clear();
  };

  return {
    down(id, point) {
      at.set(id, point);
      restart();
    },
    up(id) {
      at.delete(id);
      restart();
    },
    move(id, point, viewportHeight) {
      const before = pair();
      if (!at.has(id)) return { twist: 0, tilt: 0 };
      at.set(id, point);
      const after = pair();
      if (!before || !after) return { twist: 0, tilt: 0 };
      moved.add(id);
      const twist = angleDelta(lineAngle(...before), lineAngle(...after));
      if (moved.size < 2 || !tiltFrom) return { twist, tilt: 0 };
      const tilt = tiltDelta(tiltFrom, after, viewportHeight);
      tiltFrom = after;
      moved.clear();
      return { twist, tilt };
    },
  };
}

export interface TapTracker {
  down: (id: number, at: Point, ms: number) => void;
  /** Every move counts, so a drag that comes back to where it started is still a pan. */
  move: (id: number, at: Point) => void;
  /** Where the tap landed, or null when this lift ends a pan, a pinch or something it never saw start. */
  up: (id: number, at: Point, ms: number) => Point | null;
  cancel: (id: number) => void;
}

/**
 * Tells a tap from a pan or a pinch. Only a lone finger counts, and only if it never strays more than TAP_MAX_MOVE
 * from where it went down: once a second finger goes down, nothing in that gesture is a tap, even after it lifts.
 */
export function createTapTracker(): TapTracker {
  const down = new Set<number>();
  let press: { id: number; at: Point; ms: number } | null = null;
  const strays = (from: Point, to: Point) => Math.hypot(to.x - from.x, to.y - from.y) > TAP_MAX_MOVE;

  return {
    down(id, at, ms) {
      down.add(id);
      press = down.size === 1 ? { id, at, ms } : null;
    },
    move(id, at) {
      if (press?.id === id && strays(press.at, at)) press = null;
    },
    up(id, at, ms) {
      const known = down.delete(id);
      const p = press;
      if (!known || p?.id !== id) return null;
      press = null;
      return !strays(p.at, at) && ms - p.ms <= TAP_MAX_MS ? at : null;
    },
    cancel(id) {
      down.delete(id);
      if (press?.id === id) press = null;
    },
  };
}
