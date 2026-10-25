import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, type RefObject } from 'react';
import type { CameraControls } from '@react-three/drei';
import { INDOOR_MIN_DISTANCE, MIN_DISTANCE } from '@/shared/config/camera';
import { followAt, type Follow } from '../follow';
import type { MapFocus } from './useTripMarks';

/** What the dot's glide and the camera share on Next (D59): one plan, one clock, read by both every frame. */
export interface GlideShare {
  /** The camera's follow for the step just taken, or null when the camera flies to it instead. It stays after it ends,
   *  so the step's flight stays skipped. */
  follow: Follow | null;
  /** The step (as the camera flights see it) the follow was planned for. */
  focus: MapFocus | null;
  /** That step is indoors: its own dolly limit is the closer one (limitDolly). */
  indoor: boolean;
  /** When the first frame drew the glide, ms; null until then. Whichever of the dot and the camera frames first sets it. */
  startedAt: number | null;
  /** The student took the camera (a pan, a pinch, the compass): it stops following for this step. The dot walks on. */
  paused: boolean;
  /** The camera has been set to the step's final pose; it follows no more. */
  done: boolean;
  /** The azimuth set last frame, so the heading never wraps by 2π; null before the first frame. */
  near: number | null;
  /** The follow let the camera closer than the step's dolly limit (coming out from an indoor spot): it puts the limit
   *  back when it ends or is paused, instead of the limit snapping the camera out on the first frame. */
  lowered: boolean;
}

/** What the camera needs of the glide: its shared state, and the way to stop the camera following it. */
export interface GlideHandle {
  readonly share: RefObject<GlideShare>;
  readonly pause: () => void;
}

/** One frame of the follow: sets the camera to the glide's pose now. True while it has more frames to draw. */
function follow(s: GlideShare, c: CameraControls, now: number): boolean {
  if (!s.follow) return false;
  s.startedAt ??= now;
  const pose = followAt(s.follow, now - s.startedAt, s.near ?? s.follow.from.azimuth);
  const [x, y, h] = pose.target;
  if (pose.distance < c.minDistance) {
    c.minDistance = pose.distance;
    s.lowered = true;
  }
  void c.setTarget(x, h, -y, false);
  void c.rotateTo(pose.azimuth, pose.polar, false);
  void c.dollyTo(pose.distance, false);
  s.near = pose.azimuth;
  if (pose.done) {
    s.done = true;
    restoreLimit(s, c);
  }
  return !pose.done;
}

/** The step's own dolly limit back, once the follow has stopped holding the camera closer than it. */
function restoreLimit(s: GlideShare, c: CameraControls) {
  if (!s.lowered) return;
  c.minDistance = s.indoor ? INDOOR_MIN_DISTANCE : MIN_DISTANCE;
  s.lowered = false;
}

/**
 * Rides the camera along the dot's glide (D59): each frame while there's a follow, it sets the camera to the glide's
 * pose. It runs at priority -2, ahead of drei's controls update (-1) and the dot's placement (0), so the controls take
 * this frame's pose and the dot is projected through it. Never a positive priority: that takes R3F's rendering over.
 * Any touch or click on the map by the student pauses it.
 */
export function useCameraFollow(controlsRef: RefObject<CameraControls | null>, glide: GlideHandle) {
  const invalidate = useThree((s) => s.invalidate);
  const { share, pause } = glide;

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.addEventListener('controlstart', pause);
    return () => {
      c.removeEventListener('controlstart', pause);
    };
  }, [controlsRef, pause]);

  useFrame(() => {
    const c = controlsRef.current;
    const s = share.current;
    if (!c) return;
    if (s.paused) restoreLimit(s, c);
    else if (!s.done && follow(s, c, performance.now())) invalidate();
  }, -2);
}
