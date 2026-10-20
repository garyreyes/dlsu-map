// The image types the floor-extract steps pass along. Plain arrays, so every step is a pure function that tests can
// feed hand-drawn images; only cli.ts touches files (through sharp).

/** A colour image, 3 bytes per pixel (R, G, B), row by row. */
export interface Rgb {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** A black-and-white image, 1 byte per pixel: 1 = on, 0 = off. */
export interface Mask {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** An image-space point: x to the right, y down, in pixels. */
export type Point = readonly [x: number, y: number];

/**
 * An axis-aligned line: from (x0, y0) to (x1, y1), `t` pixels thick. Horizontal ones have y0 === y1; vertical ones
 * have x0 === x1.
 */
export interface Segment {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly t: number;
}

export const emptyMask = (width: number, height: number): Mask => ({
  width,
  height,
  data: new Uint8Array(width * height),
});
