// The 2D view's camera rules (D58): which tilt and heading each shot gets, and which gestures stay on. Pure: no React, no
// three.js. In 3D every cell is what the camera always did. Tests: flat.test.ts.
import { DRONE_POLAR, FLAT_POLAR, HOME_POLAR, NORTH_UP, SELECT_POLAR, STEP_POLAR } from '@/shared/config/camera';
import type { MapView } from '@/shared/settings/map-settings';
import { angleDelta, showCompass } from './gestures';

/** Every kind of view the camera is flown to. */
export type Shot =
  | 'home'
  | 'building'
  /** The route preview with a walk. */
  | 'trip'
  /** The route preview of a trip inside one building. */
  | 'trip-no-walk'
  | 'ground-step'
  /** An indoor step with a spot. */
  | 'indoor-step'
  /** An indoor step without a spot: its building, with the band on its floor. */
  | 'indoor-band';

export interface ShotLens {
  readonly polar: number;
  readonly northUp: boolean;
}

/** Which two-finger gestures turn the map. */
export interface Gestures {
  readonly tilt: boolean;
  readonly twist: boolean;
}

/** What each shot is seen from in 3D, as it always has been. */
const POLAR_3D: Record<Shot, number> = {
  home: HOME_POLAR,
  building: SELECT_POLAR,
  trip: DRONE_POLAR,
  'trip-no-walk': SELECT_POLAR,
  'ground-step': DRONE_POLAR,
  'indoor-step': STEP_POLAR,
  'indoor-band': STEP_POLAR,
};

/** The tilt the camera looks from, and whether the heading is forced north up (else the shot's own heading rule applies:
 *  the home heading, the band's, or the walk's). The drone shots look nearly straight down already, so 2D keeps them,
 *  and the indoor steps keep facing the walk or the band; every other shot is a map, flat and north up. */
export function shotLens(view: MapView, shot: Shot): ShotLens {
  if (view === '3d') return { polar: POLAR_3D[shot], northUp: false };
  if (shot === 'trip' || shot === 'ground-step') return { polar: DRONE_POLAR, northUp: false };
  return { polar: FLAT_POLAR, northUp: shot !== 'indoor-step' && shot !== 'indoor-band' };
}

/** Which two-finger gestures turn the map: none in 2D while browsing, twist alone in the route player (the walk's
 *  direction is worth turning to), both in 3D. */
export function gesturesFor(view: MapView, inPlayer: boolean): Gestures {
  if (view === '3d') return { tilt: true, twist: true };
  return { tilt: false, twist: inPlayer };
}

/** The heading the compass calls "not turned": the home heading in 3D, north up in 2D. */
export function usualAzimuth(view: MapView, homeAzimuth: number): number {
  return view === '3d' ? homeAzimuth : NORTH_UP;
}

/** North up reached the short way round from `current`. Never a raw NORTH_UP: from 2π + 0.3 that spins a whole turn. */
export function northFrom(current: number): number {
  return current + angleDelta(current, NORTH_UP);
}

/** Whether the compass shows: only while the map is turned past COMPASS_MIN_DEG, and never in 2D outside the route
 *  player, where north is always up (D58). */
export function compassShown(headingDeg: number, view: MapView, inPlayer: boolean): boolean {
  return showCompass(headingDeg) && !(view === '2d' && !inPlayer);
}
