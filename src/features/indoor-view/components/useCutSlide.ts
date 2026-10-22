// The cut's slide (7b), played inside the R3F <Canvas>. The plane is one three.js object for the hook's lifetime; each
// frame of a slide sets its height and asks for the next frame, because the canvas only draws on demand. What is drawn
// (the building, its floors) is React state, and changes only when a slide starts or ends. The logic is in ../slide.ts.
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Plane } from 'three';
import { cutPlane } from '@/shared/three/clipping';
import type { CutawayView } from '../cutaway';
import { IDLE_CUT, restHeight, retarget, settled, slideHeight } from '../slide';
import { SLIDE_MS, type ShownCut } from '../transition';

/** Moves the plane to `height`. A three.js object, not React state; kept out of the hook body on purpose. */
function setPlaneHeight(plane: Plane, height: number) {
  plane.constant = height;
}

/** Plays the slide from the cut before `target` to `target`, and returns what the scene draws now: the building cut
 *  at `shown.cutaway` with `plane` on every cut material, or null when no building is cut. `reduced` jumps to the end. */
export function useCutSlide(target: CutawayView | null, reduced: boolean): ShownCut | null {
  const invalidate = useThree((s) => s.invalidate);
  const plane = useMemo(() => cutPlane(0), []);
  const [state, setState] = useState(IDLE_CUT);
  const startedAt = useRef<number | null>(null);

  // A new target is worked out while rendering, so the first frame already draws the right building.
  if (state.target !== target) setState(retarget(state, target, reduced, plane.constant));

  const { slide } = state;
  const rest = restHeight(state.target);
  useLayoutEffect(() => {
    startedAt.current = slide ? performance.now() : null;
    setPlaneHeight(plane, slide ? slide.from : rest);
    invalidate();
  }, [plane, slide, rest, invalidate]);

  useFrame(() => {
    if (!slide || startedAt.current === null) return;
    const elapsed = performance.now() - startedAt.current;
    setPlaneHeight(plane, slideHeight(slide, elapsed));
    if (elapsed >= SLIDE_MS) {
      startedAt.current = null;
      setState(settled);
    }
    invalidate();
  });

  return useMemo(
    () => (state.shown ? { view: state.shown, cutaway: state.shown.cutaway, plane } : null),
    [state.shown, plane],
  );
}
