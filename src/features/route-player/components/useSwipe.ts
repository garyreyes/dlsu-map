import { useRef, type PointerEvent } from 'react';

/** A swipe moves at least this far sideways, in px, and mostly sideways, so a tap or a scroll never counts. */
const MIN_SWIPE = 48;

/**
 * A sideways swipe on the step card (user-flows §3.7): left goes on, right goes back, as pages turn. Returns the
 * pointer handlers to spread on the element; the element sets `touch-action: pan-y` so the browser leaves sideways
 * drags to it.
 */
export function useSwipe(onNext: () => void, onBack: () => void) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: PointerEvent) => {
      start.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (s?.id !== e.pointerId) return;
      const [dx, dy] = [e.clientX - s.x, e.clientY - s.y];
      if (Math.abs(dx) < MIN_SWIPE || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
      if (dx < 0) onNext();
      else onBack();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
