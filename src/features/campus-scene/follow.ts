// The camera follow on Next (D59): the camera rides the dot's glide, walking direction up, and turns through corners
// by looking ahead along the walk. Pure: no React, no three.js. Points are campus meters, x east, y north, h up; angles
// are camera-controls' (azimuth 0 puts the camera south of its target). Tests: follow.test.ts.
import {
  FOLLOW_MAX_MS,
  FOLLOW_MIN_MS,
  FOLLOW_MS_PER_METER,
  TURN_WINDOW_MAX,
  TURN_WINDOW_MIN,
  TURN_WINDOW_SHARE,
} from '@/shared/config/camera';
import type { XY } from '@/shared/data/route';
import { easeOut, pointAlong, type XYH } from './glide';
import { angleDelta } from './gestures';

/** The camera's angles and distance: camera-controls' azimuth and polar in radians, the distance in meters. */
export interface Lens {
  readonly azimuth: number;
  readonly polar: number;
  readonly distance: number;
}

/** One glide's follow, worked out once on Next and read every frame. */
export interface Follow {
  /** The dot's glide (levelPath). */
  readonly path: readonly XYH[];
  /** Its length, meters, a climb counting its height (as pointAlong). */
  readonly length: number;
  /** Where the walk goes after the new spot (MapFocus.toward), or null. */
  readonly toward: XY | null;
  /** The camera when Next was tapped. */
  readonly from: Lens;
  /** The new step's resting tilt and distance. */
  readonly to: Omit<Lens, 'azimuth'>;
  readonly ms: number;
  /** How far ahead the heading looks, meters. */
  readonly window: number;
  /** The path's stretches and the way the walk goes on past the spot, worked out once rather than every frame. */
  readonly parts: readonly Stretch[];
  readonly after: XY | null;
  /** Over the first `turnIn` meters the camera turns from `start` (the camera's own azimuth, unwrapped so the turn is
   *  the short way round) to the walking heading, measured from `settle`, the heading where the turn-in ends. Fixed
   *  once, so the turn can't flip sides halfway. */
  readonly turnIn: number;
  readonly start: number;
  readonly settle: number;
  /** Through a door (B4, D63): the tilt and distance take this many ms, eased out like the cut's slide, instead of the
   *  walk's progress. Null keeps them on the walk. */
  readonly lensMs: number | null;
}

export type FollowPose = Lens & { readonly target: XYH };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How long the follow takes for a walk of `meters`. */
export const followMs = (meters: number) =>
  clamp(Math.round(meters * FOLLOW_MS_PER_METER), FOLLOW_MIN_MS, FOLLOW_MAX_MS);

/** How far ahead the heading looks on a walk of `meters`, so a corner turns over about the same time at any length. */
export const turnWindow = (meters: number) => clamp(meters * TURN_WINDOW_SHARE, TURN_WINDOW_MIN, TURN_WINDOW_MAX);

/** Cubic ease-in-out of progress 0..1: exactly 0 at the start and exactly 1 at the end. */
export const easeInOut = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 4 * p ** 3 : 1 - (2 - 2 * p) ** 3 / 2);

const smoothstep = (x: number) => x * x * (3 - 2 * x);

/** One stretch of the walk: its length (height counted) and its flat direction, a unit vector or null when it only
 *  climbs. */
interface Stretch {
  readonly length: number;
  readonly dir: XY | null;
}

function unit(dx: number, dy: number): XY | null {
  const d = Math.hypot(dx, dy);
  return d === 0 ? null : [dx / d, dy / d];
}

function stretches(path: readonly XYH[]): Stretch[] {
  return path.slice(1).map((b, i) => {
    const a = path[i] ?? b;
    return { length: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), dir: unit(b[0] - a[0], b[1] - a[1]) };
  });
}

/** The way the walk carries on past the new spot: toward `toward`, else along the last stretch that goes anywhere. */
function beyond(path: readonly XYH[], toward: XY | null, parts: readonly Stretch[]): XY | null {
  const end = path.at(-1);
  const on = end && toward ? unit(toward[0] - end[0], toward[1] - end[1]) : null;
  return on ?? parts.findLast((p) => p.dir)?.dir ?? null;
}

/** The camera-controls azimuth that puts the camera behind a walk in direction `d` (as facingAzimuth). */
const azimuthOf = (d: XY) => Math.atan2(-d[0], d[1]);

/** The walking direction at `s`: the mean direction over the next `window` meters, the walk carrying on past its end.
 *  Where that cancels out exactly (a U-turn's middle), the stretch at `s`. Null on a walk that goes nowhere. */
function aheadAt(parts: readonly Stretch[], after: XY | null, s: number, window: number): XY | null {
  let [vx, vy] = [0, 0];
  let here: XY | null = after;
  let walked = 0;
  for (const p of parts) {
    const overlap = Math.min(walked + p.length, s + window) - Math.max(walked, s);
    if (overlap > 0 && p.dir) [vx, vy] = [vx + p.dir[0] * overlap, vy + p.dir[1] * overlap];
    if (s >= walked && s < walked + p.length && p.dir) here = p.dir;
    walked += p.length;
  }
  const past = s + window - Math.max(walked, s);
  if (past > 0 && after) [vx, vy] = [vx + after[0] * past, vy + after[1] * past];
  return unit(vx, vy) ?? here;
}

/**
 * Works out a glide's follow: the path, where the walk goes after it, and the camera at the start and the end. A path
 * that goes nowhere (one point) has nothing to follow: the caller flies or cuts instead, as the dot jumps. `lensMs`
 * puts the tilt and distance on their own clock, for a step through a door (B4).
 */
export function planFollow(
  path: readonly XYH[],
  toward: XY | null,
  from: Lens,
  to: Omit<Lens, 'azimuth'>,
  lensMs: number | null = null,
): Follow {
  const parts = stretches(path);
  const after = beyond(path, toward, parts);
  const length = parts.reduce((sum, p) => sum + p.length, 0);
  const window = turnWindow(length);
  // The camera turns in from where it was (after a compass tap or a pan on the last step) over the first stretch.
  const turnIn = Math.min(window, length / 2);
  const ahead = aheadAt(parts, after, turnIn, window);
  const settle = ahead ? azimuthOf(ahead) : from.azimuth;
  const start = settle - angleDelta(from.azimuth, settle);
  const ms = followMs(length);
  return { path, length, toward, from, to, ms, window, parts, after, turnIn, start, settle, lensMs };
}

/** What decides whether the camera rides a step's glide (D59). */
export interface FollowCase {
  /** Next: the step number went up within the same route. */
  readonly forward: boolean;
  /** The dot stays on one level: the ground, every G included, or one building's upper floor. */
  readonly sameLevel: boolean;
  readonly reduced: boolean;
  /** The step's camera view is a spot: an outdoor step, or an indoor one with its floor cut open. */
  readonly spotStep: boolean;
  /** The glide goes somewhere (its path has more than one point). */
  readonly moves: boolean;
}

/** Whether the camera follows the dot to this step. Anything else flies or cuts as before (D44, D45). */
export const followsStep = (c: FollowCase) => c.forward && c.sameLevel && !c.reduced && c.spotStep && c.moves;

/** Whether a step goes through a door (B4, D63): the step before was inside a building and this one is outside, or the
 *  other way round. The camera's tilt and zoom then move with the cut sliding in or out. */
export const throughDoor = (wasInside: boolean, now: 'ground' | 'floor') => wasInside !== (now === 'floor');

/** A step of the player: the route it belongs to (compared by identity) and its number, undefined off the player. */
export interface StepOf {
  readonly route: unknown;
  readonly step: number | undefined;
}

/** Whether going from one step to another was Next: the next number on the same route. Back, a jump from All steps,
 *  Start from the preview and a new route are not (D59). */
export const isNext = (was: StepOf, now: StepOf) =>
  was.route === now.route && was.step !== undefined && now.step === was.step + 1;

/** The camera `s` meters along the glide. `near` is the azimuth drawn last frame, so the answer never wraps by 2π. */
export function poseAt(f: Follow, s: number, near: number): FollowPose {
  const ahead = aheadAt(f.parts, f.after, s, f.window);
  const walking = ahead ? f.settle + angleDelta(f.settle, azimuthOf(ahead)) : f.settle;
  const blend = f.turnIn === 0 ? 1 : smoothstep(clamp(s / f.turnIn, 0, 1));
  const azimuth = f.start + (walking - f.start) * blend;
  const u = f.length === 0 ? 1 : clamp(s / f.length, 0, 1);
  return {
    target: pointAlong(f.path, u),
    azimuth: near + angleDelta(near, azimuth),
    polar: f.from.polar + (f.to.polar - f.from.polar) * u,
    distance: f.from.distance + (f.to.distance - f.from.distance) * u,
  };
}

/** The camera `elapsed` ms into the follow, eased, and whether it's over. A bad clock (NaN) ends it at the step. Through
 *  a door the tilt and distance keep their own, shorter clock (`lensMs`). */
export function followAt(f: Follow, elapsed: number, near: number): FollowPose & { readonly done: boolean } {
  const p = Number.isFinite(elapsed) ? elapsed / f.ms : 1;
  const pose = poseAt(f, f.length * easeInOut(p), near);
  if (f.lensMs === null) return { ...pose, done: p >= 1 };
  // The cut slide's cubic ease-out (indoor-view/slide.ts, the same curve as the dot's), so the tilt moves with the cut.
  // A clock of 0 ms, or a bad one, is already there.
  const k = easeOut(Number.isFinite(elapsed) && f.lensMs > 0 ? elapsed / f.lensMs : 1);
  return {
    ...pose,
    polar: f.from.polar + (f.to.polar - f.from.polar) * k,
    distance: f.from.distance + (f.to.distance - f.from.distance) * k,
    done: p >= 1,
  };
}
