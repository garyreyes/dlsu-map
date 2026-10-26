import { Color } from 'three';
import type { ColourMode } from '@/shared/settings/map-settings';

// Map colours (DESIGN.md, "Map palettes"). The interface never samples these and the map never uses interface
// neutrals (the Two Worlds Rule). Three colour modes from the prototype (D57); the student's pick is saved in
// useMapSettings, Green by default.
export interface MapPalette {
  ground: string;
  building: string;
  path: string;
  road: string;
  /** Distance haze and sky colour. */
  haze: string;
  /** How far off-campus blocks lean from the building colour toward the ground, 0–1. */
  cityMix: number;
}

export const MAP_PALETTES: Record<ColourMode, MapPalette> = {
  /** Deep green ground, warm white blocks (D13). Roads lightened from #7fb396 so the route reads on them (D62). */
  green: { ground: '#175f3c', building: '#f2eee5', path: '#5f9c7c', road: '#99c2ab', haze: '#4f9a72', cityMix: 0.5 },
  /** Near-black ground like Waze's dark mode, cool white blocks, a dark green haze so the horizon doesn't glow. */
  black: { ground: '#121614', building: '#e8edf3', path: '#56645d', road: '#77857e', haze: '#163326', cityMix: 0.4 },
  /** Light grey ground, near-white blocks, white paths. */
  grey: { ground: '#c4c7c6', building: '#fbfbfa', path: '#ffffff', road: '#ffffff', haze: '#cfe5d7', cityMix: 0.32 },
};

/** The interface accent (DESIGN.md, `accent`). On the map it marks only the selection and the floor band. */
export const CAMPUS_GREEN = '#00703c';

/** The selected building leans this far from the building colour toward Campus Green, the interface accent
 *  (DESIGN.md, the Shaped-by-Light Rule). */
export const SELECTED_TINT = { color: CAMPUS_GREEN, mix: 0.22 };

/** Off-campus buildings are see-through (DESIGN.md, Campus leads), so campus buildings show through them. */
export const CITY_OPACITY = 0.35;

/** Light rig from DESIGN.md (Map depth). */
export const SKY_LIGHT = { color: '#ffffff', intensity: 0.72, groundTint: 0.18 };
export const SUN_LIGHT = { color: '#fff4e6', intensity: 0.46 };
/** Haze starts and ends at these multiples of the camera's distance to its target (v2 request 2, was 0.8 and 1.5). */
export const HAZE_NEAR = 2.5;
export const HAZE_FAR = 5;

/** Hallway colour in the cut: the building colour at this fraction of its lightness (scaled in linear RGB), with no
 *  green in it, so the one green on the cut floor is the route (the One Green Rule). On the green palette this gives
 *  #75736e against the #d9dacf slab: 3.36:1 (WCAG contrast; 0.68 gave only 1.18:1).
 *  contrast-pairs.test.ts checks every mode. */
const CUT_HALL_SHADE = 0.2;
/** Cut walls are this fraction of the slab's lightness: the one named exception to the Shaped-by-Light Rule. */
const CUT_WALL_SHADE = 0.8;

/** The cut building's tones, all derived from the map palette (DESIGN.md, the indoor cut): the slab and walls keep the
 *  selected building's lean toward Campus Green, the walls a darker tone of it, hallways a darker neutral of the building colour. */
export function cutTones(palette: MapPalette) {
  const slab = new Color(palette.building).lerp(new Color(SELECTED_TINT.color), SELECTED_TINT.mix);
  return {
    slab: slab.clone(),
    wall: slab.clone().multiplyScalar(CUT_WALL_SHADE),
    hall: new Color(palette.building).multiplyScalar(CUT_HALL_SHADE),
  };
}
