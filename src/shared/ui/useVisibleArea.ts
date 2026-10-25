import { useSyncExternalStore } from 'react';

/** The part of the page the student can see, in layout-viewport px: below `top`, `height` tall, `inset` above the
 * layout viewport's bottom (the on-screen keyboard). */
export interface VisibleArea {
  readonly top: number;
  readonly height: number;
  readonly inset: number;
}

function subscribe(onChange: () => void): () => void {
  const vv = window.visualViewport;
  window.addEventListener('resize', onChange);
  vv?.addEventListener('resize', onChange);
  vv?.addEventListener('scroll', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    vv?.removeEventListener('resize', onChange);
    vv?.removeEventListener('scroll', onChange);
  };
}

// useSyncExternalStore needs the same object back while nothing changed, or it re-renders forever.
let last: VisibleArea = { top: 0, height: 0, inset: 0 };

function read(): VisibleArea {
  const full = window.innerHeight;
  const vv = window.visualViewport;
  const top = vv ? Math.round(vv.offsetTop) : 0;
  const height = vv ? Math.round(vv.height) : full;
  const inset = Math.max(0, full - top - height);
  if (top !== last.top || height !== last.height || inset !== last.inset) last = { top, height, inset };
  return last;
}

const SERVER: VisibleArea = { top: 0, height: 0, inset: 0 };

/**
 * The visible area, from `visualViewport` (the whole window when the browser has none). iOS Safari doesn't resize a
 * `position: fixed` element's box for the keyboard, so anything anchored to the bottom lifts itself by `inset`. It
 * changes on rotation and on the URL bar showing or hiding too, so a layout read from it stays current.
 */
export function useVisibleArea(): VisibleArea {
  return useSyncExternalStore(subscribe, read, () => SERVER);
}
