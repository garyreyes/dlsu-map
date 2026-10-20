// Straightens the plan: the 4 corners in the photo → a flat rectangle, like OpenCV's warpPerspective. Each output
// pixel is looked up in the photo through the inverse homography, with bilinear sampling. Tests: warp.test.ts.
import type { Point, Rgb } from './image.ts';

/** A 3×3 homography, row by row, with the last entry fixed at 1. */
export type Homography = readonly number[];

/** Solves A·x = b in place by Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) pivot = r;
    [a[col], a[pivot]] = [a[pivot] ?? [], a[col] ?? []];
    [b[col], b[pivot]] = [b[pivot] ?? 0, b[col] ?? 0];
    const row = a[col] ?? [];
    const p = row[col] ?? 0;
    if (Math.abs(p) < 1e-12) throw new Error('the 4 points are degenerate (three in a line?)');
    for (let r = col + 1; r < n; r++) {
      const other = a[r] ?? [];
      const f = (other[col] ?? 0) / p;
      for (let c = col; c < n; c++) other[c] = (other[c] ?? 0) - f * (row[c] ?? 0);
      b[r] = (b[r] ?? 0) - f * (b[col] ?? 0);
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    const row = a[r] ?? [];
    let s = b[r] ?? 0;
    for (let c = r + 1; c < n; c++) s -= (row[c] ?? 0) * (x[c] ?? 0);
    x[r] = s / (row[r] ?? 1);
  }
  return x;
}

/** The homography taking each `src[i]` to `dst[i]` (4 point pairs, no three in a line). */
export function homography(src: readonly Point[], dst: readonly Point[]): Homography {
  const a: number[][] = [];
  const b: number[] = [];
  src.forEach(([x, y], i) => {
    const [u, v] = dst[i] ?? [0, 0];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  });
  return [...solve(a, b), 1];
}

export function applyHomography(h: Homography, [x, y]: Point): [number, number] {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, k = 0, l = 1] = h;
  const w = g * x + k * y + l;
  return [(a * x + b * y + c) / w, (d * x + e * y + f) / w];
}

const dist = (p: Point, q: Point): number => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** One channel at (x, y), bilinear, clamped to the photo's edge (so the padding repeats the edge). */
function sample(img: Rgb, x: number, y: number, ch: number): number {
  const cx = Math.min(Math.max(x, 0), img.width - 1);
  const cy = Math.min(Math.max(y, 0), img.height - 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, img.width - 1);
  const y1 = Math.min(y0 + 1, img.height - 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const at = (px: number, py: number) => img.data[(py * img.width + px) * 3 + ch] ?? 0;
  const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx;
  const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx;
  return Math.round(top * (1 - fy) + bottom * fy);
}

/**
 * The plan inside the 4 corners, straightened. `width` × `height` is the plan itself (the longer of each pair of
 * opposite edges); the image adds `pad` pixels on every side so the outer wall is never cut off.
 */
export function warpPlan(photo: Rgb, corners: readonly Point[], pad: number) {
  const [tl = [0, 0], tr = [0, 0], br = [0, 0], bl = [0, 0]] = corners;
  const width = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
  const height = Math.round(Math.max(dist(tl, bl), dist(tr, br)));
  const target: Point[] = [
    [pad, pad],
    [width + pad, pad],
    [width + pad, height + pad],
    [pad, height + pad],
  ];
  const back = homography(target, [tl, tr, br, bl]); // output pixel → photo position
  const out: Rgb = {
    width: width + 2 * pad,
    height: height + 2 * pad,
    data: new Uint8Array((width + 2 * pad) * (height + 2 * pad) * 3),
  };
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const [sx, sy] = applyHomography(back, [x, y]);
      const i = (y * out.width + x) * 3;
      for (let ch = 0; ch < 3; ch++) out.data[i + ch] = sample(photo, sx, sy, ch);
    }
  }
  return { image: out, width, height };
}
