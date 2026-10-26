import { useThree } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import type { CameraControls } from '@react-three/drei';
import type { Gestures } from '../flat';
import { createTwoFingerTracker } from '../gestures';

/**
 * Two-finger twist turns the map with the fingers, and two fingers dragged up or down tilt it (DESIGN.md,
 * Gestures). camera-controls handles one-finger pan and the pinch itself; it has no twist, so this adds it, the
 * same way the prototype did. The finger maths lives in gestures.ts. In 2D (D58) tilt is off, and twist is off outside
 * the route player: the fingers are still tracked, their turn is just not applied. `gestures` is read through a ref,
 * so a change of rule never re-attaches the listeners.
 */
export function useTwistTilt(controlsRef: RefObject<CameraControls | null>, gestures: Gestures) {
  const el = useThree((s) => s.gl.domElement);
  const allowed = useRef(gestures);
  useEffect(() => {
    allowed.current = gestures;
  });

  useEffect(() => {
    const tracker = createTwoFingerTracker();
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch') tracker.down(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const m = tracker.move(e.pointerId, { x: e.clientX, y: e.clientY }, el.clientHeight);
      const twist = allowed.current.twist ? m.twist : 0;
      const tilt = allowed.current.tilt ? m.tilt : 0;
      if (twist !== 0 || tilt !== 0) void controlsRef.current?.rotate(twist, tilt, false);
    };
    const lift = (e: PointerEvent) => {
      tracker.up(e.pointerId);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', lift);
    el.addEventListener('pointercancel', lift);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', lift);
      el.removeEventListener('pointercancel', lift);
    };
  }, [el, controlsRef]);
}
