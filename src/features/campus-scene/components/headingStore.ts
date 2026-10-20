import { create } from 'zustand';

/**
 * The map's heading away from home, in whole degrees. Kept in a small store rather than in CampusMap's state so a
 * turn re-renders only the compass, not the canvas, on every frame it changes.
 */
export const useHeading = create<{ deg: number; set: (deg: number) => void }>((set) => ({
  deg: 0,
  set: (deg) => {
    set({ deg });
  },
}));
