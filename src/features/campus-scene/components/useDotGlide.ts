import { useCallback, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import type { CameraControls } from '@react-three/drei';
import type { Vector3 } from 'three';
import type { CampusBuilding } from '@/shared/data/campus';
import type { Route, XY } from '@/shared/data/route';
import { followAt, followsStep, isNext, planFollow, type Follow } from '../follow';
import { climbPath, easeOut, GLIDE_MS, levelPath, pointAlong, type XYH } from '../glide';
import type { MapInsets } from './CameraRig';
import { stepRest } from './useCameraFlights';
import type { GlideHandle, GlideShare } from './useCameraFollow';
import type { MapFocus } from './useTripMarks';

/** The level the dot is on: the ground, which takes in every building's G (floor 1), or one building's upper floor with
 *  a spot on it. Null where the dot never glides (no player, a floor without a spot). */
type Level = { readonly key: string; readonly building?: string; readonly floor?: number } | null;

function levelOf(focus: MapFocus | null): Level {
  if (focus?.kind === 'ground') return { key: 'ground' };
  if (focus?.kind !== 'floor' || focus.at === undefined) return null;
  const key = focus.floor === 1 ? 'ground' : `${focus.building}:${String(focus.floor)}`;
  return { key, building: focus.building, floor: focus.floor };
}

/** The route's lines on a level: on the ground the outdoor walks and every G's indoor legs, else that floor's. */
function linesOn(route: Route | null, level: NonNullable<Level>): (readonly XY[])[] {
  return (route?.legs ?? []).flatMap((l) => {
    if (level.key === 'ground') return l.kind === 'walk' || (l.kind === 'indoor' && l.floor === 1) ? [l.path] : [];
    return l.kind === 'indoor' && l.building === level.building && l.floor === level.floor ? [l.path] : [];
  });
}

/** The way from one drawn point to the next step's (D52): along one level's line, or up or down a floor of the same
 *  building at the stairs. Null where the dot jumps: into another building's upper floor, or off the player. */
function pathBetween(route: Route | null, from: XYH, to: XYH, was: Level, now: Level): XYH[] | null {
  if (!was || !now) return null;
  if (was.key === now.key) return levelPath(from, to, linesOn(route, now));
  if (was.building === undefined || was.building !== now.building) return null;
  return climbPath(from, to, linesOn(route, was), linesOn(route, now));
}

/** A scene point back to campus meters: x east, y north (the scene's z points south), h up (the scene's y). */
const toXYH = (v: Vector3): XYH => [v.x, -v.z, v.y];

interface Glide {
  /** The dot's target the glide was set for; a new object means a new step. */
  target: Vector3 | null;
  level: Level;
  /** The route and step the glide was set for, to tell Next from Back. */
  route: Route | null;
  step: number | undefined;
  /** The way being walked, or null when the dot is at rest. */
  path: XYH[] | null;
  /** The camera's follow of this walk, when it has one: the dot then keeps the follow's pace. */
  follow: Follow | null;
  /** Where the dot was last drawn, so a restart begins there. */
  drawn: XYH | null;
}

/** What the glide needs to know about the step and the camera, to decide whether the camera follows the dot (D59). */
export interface GlideCamera {
  /** The dot's target (where the glide ends); a new object is a new step. */
  here: Vector3 | null;
  /** The step the player is on, a number that goes up on Next. Undefined without a trip. */
  step: number | undefined;
  controlsRef: RefObject<CameraControls | null>;
  insets: MapInsets;
  /** The step as the camera's flights see it: with its spot only once its floor is cut open (CampusMap). */
  focus: MapFocus | null;
  /** The step's building, for an indoor step. */
  building: CampusBuilding | undefined;
}

/** What taking in a new step needs, besides the glide so far. */
interface StepInputs {
  route: Route | null;
  /** The player's step, or null off the player. */
  focus: MapFocus | null;
  level: Level;
  reduced: boolean;
  cam: GlideCamera;
}

/** The camera's follow of the walk the dot is about to take, or null when the camera flies or cuts to the step. `g` is
 *  still the glide of the step before. */
function planCameraFollow(g: Glide, walk: XYH[] | null, k: StepInputs): Follow | null {
  const c = k.cam.controlsRef.current;
  const focus = k.cam.focus;
  if (!walk || !c || !focus) return null;
  const rest = stepRest(focus, k.cam.building, k.cam.insets);
  const follows = followsStep({
    forward: isNext({ route: g.route, step: g.step }, { route: k.route, step: k.focus ? k.cam.step : undefined }),
    sameLevel: g.level !== null && k.level !== null && g.level.key === k.level.key,
    reduced: k.reduced,
    spotStep: rest !== null,
    moves: walk.length > 1,
  });
  if (!follows || !rest) return null;
  const from = { azimuth: c.azimuthAngle, polar: c.polarAngle, distance: c.distance };
  return planFollow(walk, focus.toward ?? null, from, rest);
}

/** Where the dot is `elapsed` ms into its walk, and whether the walk is over: at the follow's pace, or its own. */
function pointAt(path: XYH[], follow: Follow | null, elapsed: number, near: number | null) {
  if (follow) {
    const p = followAt(follow, elapsed, near ?? follow.from.azimuth);
    return { at: p.target, done: p.done };
  }
  const p = Math.min(1, elapsed / GLIDE_MS);
  return { at: pointAlong(path, easeOut(p)), done: p >= 1 };
}

const freshShare = (follow: Follow | null, focus: MapFocus | null): GlideShare => ({
  follow,
  focus,
  indoor: focus?.kind === 'floor',
  startedAt: null,
  paused: false,
  done: false,
  near: null,
  lowered: false,
});

/** Takes in a new target: the dot's walk to it and, on a Next along one level, the camera's follow. Returns a fresh
 *  share for the camera: tapping Next again mid-glide restarts both, from where the dot is drawn and the camera is. */
function takeStep(s: Glide, to: Vector3 | null, k: StepInputs): GlideShare {
  const target = to ? toXYH(to) : null;
  const path = !k.reduced && s.drawn && target ? pathBetween(k.route, s.drawn, target, s.level, k.level) : null;
  // A dot that stays put has nowhere to glide, so it asks for no frames.
  const walk = path && path.length > 1 ? path : null;
  const follow = planCameraFollow(s, walk, k);
  const step = k.focus ? k.cam.step : undefined;
  Object.assign(s, { path: walk, follow, target: to, level: k.level, route: k.route, step });
  if (!s.path) s.drawn = target;
  return freshShare(follow, follow ? k.cam.focus : null);
}

/** Writes where to draw the dot now into `out`. True while it is still walking. */
function drawDot(s: Glide, sh: GlideShare, to: Vector3 | null, out: Vector3, now: number): boolean {
  if (!to) return false;
  if (!s.path) {
    out.copy(to);
    return false;
  }
  sh.startedAt ??= now;
  const p = pointAt(s.path, s.follow, now - sh.startedAt, sh.near);
  if (p.done) {
    s.path = null;
    s.drawn = toXYH(to);
    out.copy(to);
    return false;
  }
  s.drawn = [...p.at];
  out.set(p.at[0], p.at[2], -p.at[1]);
  return true;
}

/**
 * The "you are here" dot's glide between steps (D52), shared with the camera on Next (D59). `placeDot` is called every
 * frame with the dot's target and writes where to draw it into `out`; it returns true while the dot is still moving, so
 * the caller asks for another frame. Between buildings, off the player, or with reduced motion, it jumps.
 *
 * A new target is taken in at commit time, in a layout effect, before the camera's flight effect runs: a Next along one
 * level to a spot view plans the camera's follow, and the flight to that step is skipped. The dot then walks at the
 * follow's pace instead of its own 600 ms, and the camera reads the same plan and clock through `handle`.
 */
export function useDotGlide(route: Route | null, focus: MapFocus | null, reduced: boolean, cam: GlideCamera) {
  const state = useRef<Glide>({
    target: null,
    level: null,
    route: null,
    step: undefined,
    path: null,
    follow: null,
    drawn: null,
  });
  const share = useRef<GlideShare>(freshShare(null, null));
  const level = useMemo(() => levelOf(focus), [focus]);
  const { here, step, controlsRef, insets, focus: flightFocus, building } = cam;

  const begin = useCallback(
    (to: Vector3 | null) => {
      if (to === state.current.target) return;
      const camera = { here, step, controlsRef, insets, focus: flightFocus, building };
      share.current = takeStep(state.current, to, { route, focus, level, reduced, cam: camera });
    },
    [route, focus, level, reduced, here, step, controlsRef, insets, flightFocus, building],
  );
  useLayoutEffect(() => {
    begin(here);
  }, [begin, here]);

  const placeDot = useCallback(
    (to: Vector3 | null, out: Vector3, now: number): boolean => {
      begin(to);
      return drawDot(state.current, share.current, to, out, now);
    },
    [begin],
  );

  const pause = useCallback(() => {
    share.current.paused = true;
  }, []);
  const handle = useMemo<GlideHandle>(() => ({ share, pause }), [pause]);
  return { placeDot, handle };
}
