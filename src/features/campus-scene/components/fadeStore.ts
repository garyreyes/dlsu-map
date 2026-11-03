import { create } from 'zustand';

/**
 * The campus buildings to fade right now because they stand between the camera and the route (D60 point 2). Lane B's
 * camera code fills it during a route and empties it after (v2-B6); Masses.tsx reads it through fadedSlugs, which
 * never fades the goal, selected or entered building whatever this holds. Slugs of campus buildings only. A change
 * re-renders the whole campus view, so setting the same list again changes nothing.
 */
export const useFade = create<{ faded: ReadonlySet<string>; set: (slugs: Iterable<string>) => void }>((set) => ({
  faded: new Set(),
  set: (slugs) => {
    set((s) => {
      const next = new Set(slugs);
      const same = next.size === s.faded.size && [...next].every((slug) => s.faded.has(slug));
      return same ? s : { faded: next };
    });
  },
}));
