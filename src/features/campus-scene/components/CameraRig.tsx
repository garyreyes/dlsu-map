import { CameraControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, type RefObject } from 'react';
import type { PerspectiveCamera } from 'three';
import type CameraControlsImpl from 'camera-controls';
import {
  DRAGGING_SMOOTH_TIME,
  HOME_AZIMUTH,
  HOME_DISTANCE,
  HOME_POLAR,
  MAX_DISTANCE,
  MAX_POLAR,
  MIN_DISTANCE,
  SMOOTH_TIME,
} from '@/shared/config/camera';
import { headingDeg } from '../gestures';
import { useHeading } from './headingStore';
import { useTwistTilt } from './useTwistTilt';

/** Screen space the chrome covers, in px, so the camera can centre the map in what's left (DESIGN.md, Layout). */
export interface MapInsets {
  top: number;
  bottom: number;
  left: number;
}

interface Props {
  controlsRef: RefObject<CameraControls | null>;
  insets: MapInsets;
}

/** Points the camera at the campus from the home heading and tilt. */
export function goHome(c: CameraControls, animate: boolean) {
  void c.setTarget(0, 0, 0, animate);
  void c.rotateTo(HOME_AZIMUTH, HOME_POLAR, animate);
  void c.dollyTo(HOME_DISTANCE, animate);
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
  goHome(c, false);
}

export function CameraRig({ controlsRef, insets }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const setHeading = useHeading((s) => s.set);
  useTwistTilt(controlsRef);

  const attach = useCallback(
    (c: CameraControls | null) => {
      controlsRef.current = c;
      if (c) configure(c);
    },
    [controlsRef],
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
    if (c) setHeading(Math.round(headingDeg(c.azimuthAngle, HOME_AZIMUTH)));
  }, [controlsRef, setHeading]);

  return <CameraControls ref={attach} makeDefault onChange={report} />;
}
