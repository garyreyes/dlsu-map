// Ink masks → wall and route segments, replacing the spike's OpenCV morphology and connected components. Long
// straight runs survive (text, digits and symbols don't), each blob becomes one segment, and the two thin lines an
// evacuation map draws per wall merge into one. Tests: segments.test.ts.
import { emptyMask, type Mask, type Segment } from './image.ts';

export type Direction = 'horizontal' | 'vertical';

/** Keeps only pixels inside a straight run of at least `len` in the given direction (a 1×len morphological open). */
export function longRuns(mask: Mask, len: number, dir: Direction): Mask {
  const out = emptyMask(mask.width, mask.height);
  const [lines, along] = dir === 'horizontal' ? [mask.height, mask.width] : [mask.width, mask.height];
  const index = (line: number, pos: number) =>
    dir === 'horizontal' ? line * mask.width + pos : pos * mask.width + line;
  for (let line = 0; line < lines; line++) {
    let start = -1;
    for (let pos = 0; pos <= along; pos++) {
      const on = pos < along && mask.data[index(line, pos)] === 1;
      if (on && start < 0) start = pos;
      if (!on && start >= 0) {
        if (pos - start >= len) for (let p = start; p < pos; p++) out.data[index(line, p)] = 1;
        start = -1;
      }
    }
  }
  return out;
}

/** Bounding boxes of 8-connected blobs, in scan order (top to bottom, left to right). */
function blobs(mask: Mask): { x: number; y: number; w: number; h: number }[] {
  const seen = new Uint8Array(mask.width * mask.height);
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  for (let start = 0; start < seen.length; start++) {
    if (mask.data[start] !== 1 || seen[start]) continue;
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -1, -1];
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop() ?? 0;
      const x = i % mask.width;
      const y = (i - x) / mask.width;
      [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          const n = ny * mask.width + nx;
          if (nx < 0 || ny < 0 || nx >= mask.width || ny >= mask.height || seen[n] || mask.data[n] !== 1) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
  return boxes;
}

/** Each blob that is long for its direction (more than twice as long as thick) → one segment through its middle. */
export function components(mask: Mask, dir: Direction): Segment[] {
  return blobs(mask).flatMap(({ x, y, w, h }) => {
    if (dir === 'horizontal' && w > 2 * h) return [{ x0: x, y0: y + h / 2, x1: x + w, y1: y + h / 2, t: h }];
    if (dir === 'vertical' && h > 2 * w) return [{ x0: x + w / 2, y0: y, x1: x + w / 2, y1: y + h, t: w }];
    return [];
  });
}

/** Merges close parallels that overlap for most of their length into one wall, as thick as both lines together. */
export function mergeDoubleLines(segs: readonly Segment[], dir: Direction, maxGap: number): Segment[] {
  const key = (s: Segment) => (dir === 'horizontal' ? s.y0 : s.x0);
  const span = (s: Segment): [number, number] => (dir === 'horizontal' ? [s.x0, s.x1] : [s.y0, s.y1]);
  const sorted = [...segs].sort((a, b) => key(a) - key(b));
  const used = new Set<number>();
  const out: Segment[] = [];
  sorted.forEach((a, i) => {
    if (used.has(i)) return;
    const [a0, a1] = span(a);
    // The first later line within the gap that overlaps for most of its length (sorted, so stop past the gap).
    let j = -1;
    for (let k = i + 1; k < sorted.length && j < 0; k++) {
      const b = sorted[k];
      if (!b || key(b) - key(a) > maxGap) break;
      const [b0, b1] = span(b);
      if (!used.has(k) && Math.min(a1, b1) - Math.max(a0, b0) >= 0.6 * Math.min(a1 - a0, b1 - b0)) j = k;
    }
    const b = sorted[j];
    if (!b) return void out.push(a);
    used.add(j);
    const [b0, b1] = span(b);
    const [mid, lo, hi] = [(key(a) + key(b)) / 2, Math.max(a0, b0), Math.min(a1, b1)];
    const t = key(b) - key(a) + (a.t + b.t) / 2;
    out.push(dir === 'horizontal' ? { x0: lo, y0: mid, x1: hi, y1: mid, t } : { x0: mid, y0: lo, x1: mid, y1: hi, t });
  });
  return out;
}

export interface ExtractOptions {
  /** Shortest wall run, px: longer than any digit stroke, shorter than a wall stub. */
  readonly wallMin: number;
  readonly routeMin: number;
  /** Farthest apart the two lines of one wall can be, px. */
  readonly maxGap: number;
  /** Thicker blobs are filled areas (stairs, shading), not wall lines. */
  readonly maxThickness: number;
}

/** Wall segments (double lines merged) and route segments from the two ink masks. */
export function extractSegments(dark: Mask, route: Mask, o: ExtractOptions): { walls: Segment[]; route: Segment[] } {
  const pass = (mask: Mask, len: number, dir: Direction) => components(longRuns(mask, len, dir), dir);
  const thin = (s: Segment) => s.t <= o.maxThickness;
  const walls = (['horizontal', 'vertical'] as const).flatMap((dir) =>
    mergeDoubleLines(pass(dark, o.wallMin, dir).filter(thin), dir, o.maxGap),
  );
  return { walls, route: [...pass(route, o.routeMin, 'horizontal'), ...pass(route, o.routeMin, 'vertical')] };
}

/** Pixel coordinates in the padded image → 0–1 across the plan. Thickness is across the line. */
export function normalise(s: Segment, pad: number, width: number, height: number): Segment {
  const across = s.y0 === s.y1 ? height : width;
  return {
    x0: (s.x0 - pad) / width,
    y0: (s.y0 - pad) / height,
    x1: (s.x1 - pad) / width,
    y1: (s.y1 - pad) / height,
    t: s.t / across,
  };
}
