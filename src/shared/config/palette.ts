// Map colours (DESIGN.md, "Map palettes"). The interface never samples these and the map never uses interface
// neutrals (the Two Worlds Rule). D13's palette is settled in 2c; until then the map uses A, the owner's black.
export interface MapPalette {
  ground: string;
  building: string;
  path: string;
  road: string;
  /** Distance haze and sky colour. */
  haze: string;
}

export const MAP_PALETTE_A: MapPalette = {
  ground: '#121614',
  building: '#e8edf3',
  path: '#56645d',
  road: '#77857e',
  haze: '#163326',
};

/** Light rig from DESIGN.md (Map depth). */
export const SKY_LIGHT = { color: '#ffffff', intensity: 0.72, groundTint: 0.18 };
export const SUN_LIGHT = { color: '#fff4e6', intensity: 0.46 };
/** Haze starts and ends at these multiples of the camera's distance to its target. */
export const HAZE_NEAR = 0.8;
export const HAZE_FAR = 1.5;
