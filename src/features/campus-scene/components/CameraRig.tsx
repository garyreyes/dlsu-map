import { CameraControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import type CameraControlsImpl from 'camera-controls';
import {
  DRAGGING_SMOOTH_TIME,
  FOV_DEG,
  HOME_POLAR,
  MAX_DISTANCE,
  MAX_POLAR,
  MIN_DISTANCE,
  SELECT_POLAR,
  SMOOTH_TIME,
  STEP_POLAR,
} from '@/shared/config/camera';
import type { CampusBuilding } from '@/shared/data/campus';
import { headingDeg } from '../gestures';
import { fitDistance, framing } from '../home-view';
import { useHeading } from './headingStore';
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
}

/** Points the camera at the whole campus from the home heading and tilt, framed in the screen the chrome leaves. */
export function goHome(c: CameraControls, home: HomeView, insets: MapInsets, animate: boolean) {
  // The canvas fills the window (CampusMap), so the window is the view.
  const view = { width: window.innerWidth, height: window.innerHeight, fovDeg: FOV_DEG, polar: HOME_POLAR };
  const distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, fitDistance(home.radius, view, insets)));
  void c.setTarget(home.x, 0, home.z, animate);
  void c.rotateTo(home.azimuth, HOME_POLAR, animate);
  void c.dollyTo(distance, animate);
}

/** How much ground around a selected building stays in view, as a multiple of its own size. */
const SELECT_CONTEXT = 2;

/** What the camera looks at for a selected building (scene coordinates), and from how far. */
export interface BuildingView {
  target: Vector3;
  distance: number;
}

/** The whole building and some of its neighbours, fitted to the screen the chrome leaves, at the closer angle. */
export function buildingView(b: Pick<CampusBuilding, 'volumes'>, insets: MapInsets): BuildingView {
  const { centre, radius } = framing(b.volumes.map((v) => v.outline));
  const top = Math.max(...b.volumes.map((v) => v.top));
  const view = { width: window.innerWidth, height: window.innerHeight, fovDeg: FOV_DEG, polar: SELECT_POLAR };
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

/** A whole trip (5b): the walk, the From building and the To building, fitted to the screen the chrome leaves, at the
 *  closer angle, so goToBuilding can fly there. `outlines` are flat x, y lists: the lines and the buildings' outlines. */
export function tripView(outlines: readonly (readonly number[])[], insets: MapInsets): BuildingView {
  const { centre, radius } = framing(outlines);
  const view = { width: window.innerWidth, height: window.innerHeight, fovDeg: FOV_DEG, polar: SELECT_POLAR };
  const fit = fitDistance(Math.max(TRIP_MIN_RADIUS, radius * TRIP_MARGIN), view, insets);
  return {
    target: new Vector3(centre[0], 0, -centre[1]),
    distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, fit)),
  };
}

/** An outdoor step's spot keeps this many meters around it in view: the paths it joins and the buildings beside it. */
const STEP_RADIUS = 70;

/** An outdoor step in the player (D44): its spot and the paths around it, seen from the higher step angle. */
export function stepView(at: readonly [number, number], insets: MapInsets): BuildingView {
  const view = { width: window.innerWidth, height: window.innerHeight, fovDeg: FOV_DEG, polar: STEP_POLAR };
  const fit = fitDistance(STEP_RADIUS, view, insets);
  return {
    target: new Vector3(at[0], 0, -at[1]),
    distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, fit)),
  };
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

/** Map-style gestures: one finger pans along the ground, pinch zooms toward the fingers, mouse right-drag turns. */
function configure(c: CameraControls) {
  // drei doesn't re-export camera-controls' ACTION values, so read them from the class itself. In camera-controls 3,
  // SCREEN_PAN is the map-style pan (a vertical drag moves along the ground); TRUCK slides in the screen's plane.
  const { ACTION } = c.constructor as typeof CameraControlsImpl;
  Object.assign(c.mouseButtons, {
    left: ACTION.SCREEN_PAN,
    middle: ACTION.DOLLY,
    right: ACTION.ROTATE,
    wheel: ACTION.DOLLY,
  });
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

export function CameraRig({ controlsRef, insets, home, onAttach }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const setHeading = useHeading((s) => s.set);
  useTwistTilt(controlsRef);

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
      configure(c);
      goHome(c, homeRef.current, insetsRef.current, false);
      onAttach(true);
    },
    [controlsRef, onAttach],
  );

  // Shift the projection so the camera target sits in the middle of the uncovered map (the prototype's formula).
  useLayoutEffect(() => {
    const { width: w, height: h } = size;
    const d = insets.bottom - insets.top;
    if (d >= 0) camera.setViewOffset(w + insets.left, h + d, 0, d, w, h);
    else camera.setViewOffset(w + insets.left, h - d, 0, 0, w, h);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size, insets.top, insets.bottom, insets.left, invalidate]);

  const report = useCallback(() => {
    const c = controlsRef.current;
    if (c) setHeading(Math.round(headingDeg(c.azimuthAngle, home.azimuth)));
  }, [controlsRef, setHeading, home.azimuth]);

  return <CameraControls ref={attach} makeDefault onChange={report} />;
}
