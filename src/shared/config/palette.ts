// Map colours (DESIGN.md, "Map palettes"). The interface never samples these and the map never uses interface
// neutrals (the Two Worlds Rule). D13's palette is settled in 2c on real phones outdoors; until then the map uses A,
// the owner's black, and a preview link can ask for another with `?palette=b` or `?palette=c`.
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

export type MapPaletteKey = 'a' | 'b' | 'c';

export const MAP_PALETTES: Record<MapPaletteKey, MapPalette> = {
  /** Black, like Waze's dark mode (the owner's choice). */
  a: { ground: '#121614', building: '#e8edf3', path: '#56645d', road: '#77857e', haze: '#163326', cityMix: 0.4 },
  /** Green: deep green ground, warm white blocks. */
  b: { ground: '#175f3c', building: '#f2eee5', path: '#5f9c7c', road: '#7fb396', haze: '#4f9a72', cityMix: 0.5 },
  /** Grey: the quiet one. */
  c: { ground: '#c4c7c6', building: '#fbfbfa', path: '#ffffff', road: '#ffffff', haze: '#cfe5d7', cityMix: 0.32 },
};

export const DEFAULT_PALETTE: MapPaletteKey = 'a';

/** Off-campus buildings are see-through (DESIGN.md, Campus leads), so campus buildings show through them. */
export const CITY_OPACITY = 0.35;

/** Light rig from DESIGN.md (Map depth). */
export const SKY_LIGHT = { color: '#ffffff', intensity: 0.72, groundTint: 0.18 };
export const SUN_LIGHT = { color: '#fff4e6', intensity: 0.46 };
/** Haze starts and ends at these multiples of the camera's distance to its target. */
export const HAZE_NEAR = 0.8;
export const HAZE_FAR = 1.5;
