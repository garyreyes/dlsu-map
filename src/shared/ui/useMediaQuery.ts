import { useSyncExternalStore } from 'react';

/** Live result of a CSS media query. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    () => window.matchMedia(query).matches,
  );
}

/** Wide screens get Google Maps' desktop layout: a left panel instead of a bottom sheet (DESIGN.md, Layout). */
export const useIsWide = () => useMediaQuery('(min-width: 768px)');

/** Every transition and camera flight becomes a cut when this is on (DESIGN.md, Motion). */
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
