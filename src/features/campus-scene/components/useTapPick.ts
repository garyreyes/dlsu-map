import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { Vector2, type Mesh } from 'three';
import { createTapTracker } from '../gestures';
import { ownerOf, type Owner } from '../massing';

/**
 * Calls `onTap` with the slug of the campus building under a tap, or null for a tap on anything else (ground, city,
 * sky). Pans, pinches, mouse right-drags and long presses never count (gestures.ts). Lifts are heard on the window,
 * so a finger that slides off the canvas before lifting can't leave a press stuck down.
 */
export function useTapPick(
  mesh: RefObject<Mesh | null>,
  owners: readonly Owner[],
  onTap: (slug: string | null) => void,
) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const raycaster = useThree((s) => s.raycaster);
  const onTapRef = useRef(onTap);
  useLayoutEffect(() => {
    onTapRef.current = onTap;
  });

  useEffect(() => {
    const el = gl.domElement;
    const tracker = createTapTracker();
    const ndc = new Vector2();
    const down = (e: PointerEvent) => {
      if (e.button === 0) tracker.down(e.pointerId, { x: e.clientX, y: e.clientY }, e.timeStamp);
    };
    const move = (e: PointerEvent) => {
      tracker.move(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const cancel = (e: PointerEvent) => {
      tracker.cancel(e.pointerId);
    };
    const up = (e: PointerEvent) => {
      const at = tracker.up(e.pointerId, { x: e.clientX, y: e.clientY }, e.timeStamp);
      if (!at || !mesh.current) return;
      const r = el.getBoundingClientRect();
      ndc.set(((at.x - r.left) / r.width) * 2 - 1, -((at.y - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const face = raycaster.intersectObject(mesh.current, false)[0]?.faceIndex;
      onTapRef.current(face === undefined || face === null ? null : (ownerOf(owners, face) ?? null));
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [gl, camera, raycaster, mesh, owners]);
}
