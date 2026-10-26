import { CameraControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import type CameraControlsImpl from 'camera-controls';
import {
  DRAGGING_SMOOTH_TIME,
  DRONE_POLAR,
  FOV_DEG,
  INDOOR_MIN_DISTANCE,
  INDOOR_STEP_RADIUS,
  INDOOR_TARGET_HEIGHT,
  MAX_DISTANCE,
  MAX_POLAR,
  MIN_DISTANCE,
  SELECT_POLAR,
  SMOOTH_TIME,
  STEP_POLAR,
  STRETCH_MARGIN,
  STRETCH_MIN_REACH,
} from '@/shared/config/camera';
import type { CampusBuilding } from '@/shared/data/campus';
import type { XY } from '@/shared/data/route';
import type { MapView } from '@/shared/settings/map-settings';
import { useMapSettings } from '@/shared/settings/useMapSettings';
import { headingDeg } from '../gestures';
import { boxAround, pointsOf, reachFrom } from '../drone';
import { gesturesFor, northFrom, shotLens, usualAzimuth } from '../flat';
import { fitDistance, fitReach, framing } from '../home-view';
import { useHeading } from './headingStore';
import { useCameraFollow, type GlideHandle } from './useCameraFollow';
import { useTwistTilt } from './useTwistTilt';

/** Screen space the chrome covers, in px, so the camera can centre the map in what's left (DESIGN.md, Layout). */
export interface MapInsets {
  top: number;
  bottom: number;
  left: number;
}

/** The home view, worked out from the campus data: what it looks at (scene x, z), from where, and what must fit. */
export interface HomeView {
  x: number;
  z: number;
  /** camera-controls' azimuth: Taft Avenue along the bottom of the screen. */
  azimuth: number;
  /** Every campus building lies within this many meters of the target. */
  radius: number;
}

interface Props {
  controlsRef: RefObject<CameraControls | null>;
  insets: MapInsets;
  home: HomeView;
  /** The controls attached (true) or went with the canvas (false): a selection made before they attached flies once
   *  they do, and again if the canvas is ever made anew. */
  onAttach: (attached: boolean) => void;
  /** The dot's glide, which the camera rides on Next (D59). */
  glide: GlideHandle;
  /** The route player is open: in 2D, two-finger twist stays on there, to turn to the walk. */
  inPlayer: boolean;
}

/** Points the camera at the whole campus, framed in the screen the chrome leaves: in 3D from the home heading and tilt,
 *  in 2D (D58) from straight above with north up, turned the short way round. */
export function goHome(c: CameraControls, home: HomeView, insets: MapInsets, animate: boolean) {
  const { polar, northUp } = shotLens(useMapSettings.getState().settings.view, 'home');
  // The canvas fills the window (CampusMap), so the window is the view.
  const view = { width: window.innerWidth, height: window.innerHeight, fovDeg: FOV_DEG, polar };
  const distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, fitDistance(home.radius, view, insets)));
  void c.setTarget(home.x, 0, home.z, animate);
  void c.rotateTo(northUp ? northFrom(c.azimuthAngle) : home.azimuth, polar, animate);
  void c.dollyTo(distance, animate);
}

/** How much ground around a selected building stays in view, as a multiple of its own size. */
const SELECT_CONTEXT = 2;

/** What the camera looks at for a selected building (scene coordinates), and from how far. */
export interface BuildingView {
  target: Vector3;
  distance: number;
}

/** The whole building and some of its neighbours, fitted to the screen the chrome leaves, seen from `polar` (the closer
 *  angle unless told otherwise). */
export function buildingView(
  b: Pick<CampusBuilding, 'volumes'>,
  insets: MapInsets,
  polar = SELECT_POLAR,
): BuildingView {
  const { centre, radius } = framing(b.volumes.map((v) => v.outline));
  const top = Math.max(...b.volumes.map((v) => v.top));
  const view = { width: window.innerWidth, height: window.innerHeight, fovDeg: FOV_DEG, polar };
  const fit = fitDistance(Math.max(radius, top / 2) * SELECT_CONTEXT, view, insets);
  return {
    target: new Vector3(centre[0], 0, -centre[1]),
    distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, fit)),
  };
}

/** A trip's view is never tighter than this radius, in meters, so a short one still shows where it is. */
const TRIP_MIN_RADIUS = 45;
/** Air around the trip, as a multiple of what it spans. */
const TRIP_MARGIN = 1.15;
/** The drone trip view also keeps this many CSS px clear inside each edge of the free screen. From sits at the
 *  bottom, and the flight starts as From is picked, before the preview sheet has grown to its full height (about 56 px
 *  taller on a Pixel 7); the room also keeps To's label plate, drawn above its building, on screen. */
const TRIP_PAD = 80;

/** A whole trip (5b): the walk, the From building and the To building, fitted to the screen the chrome leaves, so
 *  goToBuilding can fly there. `outlines` are flat x, y lists: the lines and the buildings' outlines. With a `heading`
 *  (the camera's azimuth, from tripAzimuth) it is the drone view (D61): from nearly straight down, fitted to the box the
 *  trip fills on the turned screen. Without one, a circle that takes everything in, seen from `polar` (the closer angle
 *  unless told otherwise). */
export function tripView(
  outlines: readonly (readonly number[])[],
  insets: MapInsets,
  heading: number | null = null,
  polar = SELECT_POLAR,
): BuildingView {
  const size = { width: window.innerWidth, height: window.innerHeight, fovDeg: FOV_DEG };
  const box = heading === null ? null : boxAround(pointsOf(outlines), heading);
  if (!box) {
    const { centre, radius } = framing(outlines);
    const fit = fitDistance(Math.max(TRIP_MIN_RADIUS, radius * TRIP_MARGIN), { ...size, polar }, insets);
    return {
      target: new Vector3(centre[0], 0, -centre[1]),
      distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, fit)),
    };
  }
  const reach = {
    across: Math.max(TRIP_MIN_RADIUS, box.across * TRIP_MARGIN),
    along: Math.max(TRIP_MIN_RADIUS, box.along * TRIP_MARGIN),
  };
  // Equal pads top and bottom keep the free screen's middle, where the view offset puts the target, where it was.
  const padded = { top: insets.top + TRIP_PAD, bottom: insets.bottom + TRIP_PAD, left: insets.left + 2 * TRIP_PAD };
  return {
    target: new Vector3(box.centre[0], 0, -box.centre[1]),
    distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, fitReach(reach, { ...size, polar: DRONE_POLAR }, padded))),
  };
}

/** An outdoor step in the player (D44, D61): from nearly straight down, its spot in the middle of the screen and the
 *  stretch `ahead` of it (to the next turn, crossing or entrance) in view, facing `azimuth`. It shows at least
 *  STRETCH_MIN_REACH meters each way, so a short stretch still shows the paths around it. */
export function stepView(
  at: readonly [number, number],
  ahead: readonly XY[],
  azimuth: number,
  insets: MapInsets,
): BuildingView {
  const view = { width: window.innerWidth, height: window.innerHeight, fovDeg: FOV_DEG, polar: DRONE_POLAR };
  const stretch = reachFrom(ahead, at, azimuth);
  const reach = {
    across: Math.max(STRETCH_MIN_REACH, stretch.across * STRETCH_MARGIN),
    along: Math.max(STRETCH_MIN_REACH, stretch.along * STRETCH_MARGIN),
  };
  return {
    target: new Vector3(at[0], 0, -at[1]),
    distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, fitReach(reach, view, insets))),
  };
}

/** An indoor step in the player (7▸): its spot on the cut floor and the hallway round it, close enough to read the plan
 *  on a phone, seen from `polar` (the step angle unless told otherwise). `floorHeight` is the floor's height above the
 *  ground, in meters. */
export function indoorStepView(
  at: readonly [number, number],
  floorHeight: number,
  insets: MapInsets,
  polar = STEP_POLAR,
): BuildingView {
  const view = { width: window.innerWidth, height: window.innerHeight, fovDeg: FOV_DEG, polar };
  const fit = fitDistance(INDOOR_STEP_RADIUS, view, insets);
  return {
    target: new Vector3(at[0], floorHeight + INDOOR_TARGET_HEIGHT, -at[1]),
    distance: Math.min(MAX_DISTANCE, Math.max(INDOOR_MIN_DISTANCE, fit)),
  };
}

/** How close the camera may dolly: the campus's limit, or the closer one on an indoor step (7▸). Set before a flight,
 *  since the flight's own dolly is held to it. */
export function limitDolly(c: CameraControls, indoor: boolean) {
  c.minDistance = indoor ? INDOOR_MIN_DISTANCE : MIN_DISTANCE;
}

/** Flies to a selected building at the closer, lower angle (DESIGN.md, Camera), or to a step at `polar`. It keeps the
 *  heading the student has turned to, unless `azimuth` names one that sees the floor band or faces the walk. */
export function goToBuilding(
  c: CameraControls,
  view: BuildingView,
  azimuth: number | null,
  animate: boolean,
  polar = SELECT_POLAR,
) {
  void c.setTarget(view.target.x, view.target.y, view.target.z, animate);
  if (azimuth === null) void c.rotatePolarTo(polar, animate);
  else void c.rotateTo(azimuth, polar, animate);
  void c.dollyTo(view.distance, animate);
}

/** Mouse right-drag turns the map, and tilts it with the drag's other axis: so only in 3D (phones are the target). */
function setRightButton(c: CameraControls, view: MapView) {
  const { ACTION } = c.constructor as typeof CameraControlsImpl;
  c.mouseButtons.right = view === '3d' ? ACTION.ROTATE : ACTION.NONE;
}

/** Map-style gestures: one finger pans along the ground, pinch zooms toward the fingers, mouse right-drag turns (3D). */
function configure(c: CameraControls, view: MapView) {
  // drei doesn't re-export camera-controls' ACTION values, so read them from the class itself. In camera-controls 3,
  // SCREEN_PAN is the map-style pan (a vertical drag moves along the ground); TRUCK slides in the screen's plane.
  const { ACTION } = c.constructor as typeof CameraControlsImpl;
  Object.assign(c.mouseButtons, { left: ACTION.SCREEN_PAN, middle: ACTION.DOLLY, wheel: ACTION.DOLLY });
  setRightButton(c, view);
  Object.assign(c.touches, { one: ACTION.TOUCH_SCREEN_PAN, two: ACTION.TOUCH_DOLLY, three: ACTION.NONE });
  Object.assign(c, {
    dollyToCursor: true,
    minDistance: MIN_DISTANCE,
    maxDistance: MAX_DISTANCE,
    maxPolarAngle: MAX_POLAR,
    smoothTime: SMOOTH_TIME,
    draggingSmoothTime: DRAGGING_SMOOTH_TIME,
  });
}

/** The right mouse button follows the view live: it is set on attach too, but the setting can change after. */
function useRightButton(controlsRef: RefObject<CameraControls | null>, view: MapView) {
  useEffect(() => {
    if (controlsRef.current) setRightButton(controlsRef.current, view);
  }, [controlsRef, view]);
}

/** Tells the compass how far the map is turned from the view's usual heading. A change of view says so at once, even
 *  if the camera hasn't moved. Returns the report, for the controls' change event. */
function useHeadingReport(controlsRef: RefObject<CameraControls | null>, view: MapView, homeAzimuth: number) {
  const setHeading = useHeading((s) => s.set);
  const report = useCallback(() => {
    const c = controlsRef.current;
    if (c) setHeading(Math.round(headingDeg(c.azimuthAngle, usualAzimuth(view, homeAzimuth))));
  }, [controlsRef, setHeading, homeAzimuth, view]);
  useEffect(() => {
    report();
  }, [report]);
  return report;
}

export function CameraRig({ controlsRef, insets, home, onAttach, glide, inPlayer }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const view = useMapSettings((s) => s.settings.view);
  useTwistTilt(controlsRef, gesturesFor(view, inPlayer));
  useCameraFollow(controlsRef, glide);

  // Read through refs so the attach callback stays the same: a new one would re-attach and jump the camera home
  // every time the sheet moved.
  const homeRef = useRef(home);
  const insetsRef = useRef(insets);
  useLayoutEffect(() => {
    homeRef.current = home;
    insetsRef.current = insets;
  });

  const attach = useCallback(
    (c: CameraControls | null) => {
      controlsRef.current = c;
      if (!c) {
        onAttach(false);
        return;
      }
      configure(c, useMapSettings.getState().settings.view);
      goHome(c, homeRef.current, insetsRef.current, false);
      onAttach(true);
    },
    [controlsRef, onAttach],
  );

  useRightButton(controlsRef, view);

  // Shift the projection so the camera target sits in the middle of the uncovered map (the prototype's formula).
  useLayoutEffect(() => {
    const { width: w, height: h } = size;
    const d = insets.bottom - insets.top;
    if (d >= 0) camera.setViewOffset(w + insets.left, h + d, 0, d, w, h);
    else camera.setViewOffset(w + insets.left, h - d, 0, 0, w, h);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size, insets.top, insets.bottom, insets.left, invalidate]);

  const report = useHeadingReport(controlsRef, view, home.azimuth);

  return <CameraControls ref={attach} makeDefault onChange={report} />;
}
