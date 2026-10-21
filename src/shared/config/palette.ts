// Map colours (DESIGN.md, "Map palettes"). The interface never samples these and the map never uses interface
// neutrals (the Two Worlds Rule). D13 settled on the green palette, the owner's pick in 2c.
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

/** Green: deep green ground, warm white blocks (D13). */
export const MAP_PALETTE: MapPalette = {
  ground: '#175f3c',
  building: '#f2eee5',
  path: '#5f9c7c',
  road: '#7fb396',
  haze: '#4f9a72',
  cityMix: 0.5,
};

/** The selected building leans this far from the building colour toward Campus Green, the interface accent
 *  (DESIGN.md, the Shaped-by-Light Rule). */
export const SELECTED_TINT = { color: '#00703c', mix: 0.22 };

/** Off-campus buildings are see-through (DESIGN.md, Campus leads), so campus buildings show through them. */
export const CITY_OPACITY = 0.35;

/** Light rig from DESIGN.md (Map depth). */
export const SKY_LIGHT = { color: '#ffffff', intensity: 0.72, groundTint: 0.18 };
export const SUN_LIGHT = { color: '#fff4e6', intensity: 0.46 };
/** Haze starts and ends at these multiples of the camera's distance to its target. */
export const HAZE_NEAR = 0.8;
export const HAZE_FAR = 1.5;
