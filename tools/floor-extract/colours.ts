// Sorts the straightened plan's pixels into wall ink and the hallway route. Two map styles exist on campus: STRC's
// green signs (double black walls, green route) and the white "EVACUATION MAP" template on every other building
// photographed (thin grey walls, red route). Ink is judged against the paper around it, not the page average, so glare
// and the photographer's shadow don't hide walls. Tests: colours.test.ts.
import { emptyMask, type Mask, type Rgb } from './image.ts';

/** HSV on OpenCV's 8-bit scale: H 0–180, S and V 0–255. */
export function toHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return [Math.round(h / 2) % 180, max === 0 ? 0 : Math.round((255 * d) / max), max];
}

export type Style = 'green-sign' | 'white-map';

interface StyleRules {
  /** Ink at or below this fraction of the local paper's V is a wall line. */
  readonly darkRatio: number;
  /** The route's V must lie between these fractions of the local paper's V. */
  readonly routeMinRatio: number;
  readonly routeMaxRatio: number;
  readonly isRouteHue: (h: number, s: number) => boolean;
  /** Wall ink may be tinted (STRC's photo tints black lines green); on white maps coloured ink is not a wall. */
  readonly tintedWalls: boolean;
  /** Farthest apart, px, two parallel lines can be and still be one wall (STRC draws walls as double lines). */
  readonly maxGap: number;
}

const isRed = (h: number, s: number, minS: number) => (h <= 10 || h >= 165) && s >= minS;

export const STYLES: Readonly<Record<Style, StyleRules>> = {
  // Measured by the spike on STRC 4F (paper V 208): walls V ≤ 75, route V 85–200, H 55–90, S ≥ 140.
  'green-sign': {
    darkRatio: 75 / 208,
    routeMinRatio: 85 / 208,
    routeMaxRatio: 200 / 208,
    isRouteHue: (h, s) => h >= 55 && h <= 90 && s >= 140,
    tintedWalls: true,
    maxGap: 24,
  },
  // Measured on St. Joseph 3F (paper V ~180): walls V 72–103 (S < 15), route H 173–175 S ~101 V ~129.
  'white-map': {
    darkRatio: 0.65,
    routeMinRatio: 0.45,
    routeMaxRatio: 0.9,
    isRouteHue: (h, s) => isRed(h, s, 70),
    tintedWalls: false,
    maxGap: 6,
  },
};

const vAt = (img: Rgb, i: number) => Math.max(img.data[i * 3] ?? 0, img.data[i * 3 + 1] ?? 0, img.data[i * 3 + 2] ?? 0);

/** Green and saturated paper is STRC's sign; anything else is the white template. Read from the brighter half. */
export function detectStyle(img: Rgb): Style {
  // A grid of about 150×150 samples is plenty, and covers every part of the plan (a flat stride could skip columns).
  const sx = Math.max(1, Math.floor(img.width / 150));
  const sy = Math.max(1, Math.floor(img.height / 150));
  const samples: [number, number, number][] = [];
  for (let y = 0; y < img.height; y += sy) {
    for (let x = 0; x < img.width; x += sx) {
      const i = y * img.width + x;
      samples.push(toHsv(img.data[i * 3] ?? 0, img.data[i * 3 + 1] ?? 0, img.data[i * 3 + 2] ?? 0));
    }
  }
  samples.sort((a, b) => a[2] - b[2]);
  const paper = samples.slice(Math.floor(samples.length / 2));
  const median = (k: 0 | 1) => [...paper].sort((a, b) => a[k] - b[k])[Math.floor(paper.length / 2)]?.[k] ?? 0;
  return median(1) >= 45 && median(0) >= 35 && median(0) <= 90 ? 'green-sign' : 'white-map';
}

/** Block size, px, for reading the paper's local brightness. */
const BLOCK = 64;

/**
 * The paper's brightness (V) around every pixel: the 90th percentile of each 64-px block (ink is a minority, so it
 * doesn't pull this down), blended bilinearly between block centres.
 */
export function localPaper(img: Rgb): Float32Array {
  const cols = Math.ceil(img.width / BLOCK);
  const rows = Math.ceil(img.height / BLOCK);
  const blocks = new Float32Array(cols * rows);
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const values: number[] = [];
      for (let y = by * BLOCK; y < Math.min((by + 1) * BLOCK, img.height); y++) {
        for (let x = bx * BLOCK; x < Math.min((bx + 1) * BLOCK, img.width); x++)
          values.push(vAt(img, y * img.width + x));
      }
      values.sort((a, b) => a - b);
      blocks[by * cols + bx] = values[Math.floor(values.length * 0.9)] ?? 0;
    }
  }
  const out = new Float32Array(img.width * img.height);
  const at = (bx: number, by: number) => blocks[by * cols + bx] ?? 0;
  for (let y = 0; y < img.height; y++) {
    const fy = Math.min(Math.max((y - BLOCK / 2) / BLOCK, 0), rows - 1);
    const [y0, y1, ty] = [Math.floor(fy), Math.min(Math.floor(fy) + 1, rows - 1), fy - Math.floor(fy)];
    for (let x = 0; x < img.width; x++) {
      const fx = Math.min(Math.max((x - BLOCK / 2) / BLOCK, 0), cols - 1);
      const [x0, x1, tx] = [Math.floor(fx), Math.min(Math.floor(fx) + 1, cols - 1), fx - Math.floor(fx)];
      const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
      const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
      out[y * img.width + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

/**
 * Per-photo overrides for a washed-out photo (Velasco 2F: paper V 155, grey walls at 0.76–0.85 of it, the red route
 * only S 44–58), set on `extract` by hand after measuring. `darkRatio` replaces the style's; `redSat` is the
 * least saturation that still counts as red, for the route and for red that is never a wall (70 by default).
 */
export interface Tuning {
  readonly darkRatio?: number;
  readonly redSat?: number;
}

/** Wall ink and the route, as masks the size of the image. Red (fire equipment, exit signs) is never a wall. */
export function classify(img: Rgb, style: Style, tuning: Tuning = {}): { dark: Mask; route: Mask } {
  const redSat = tuning.redSat ?? 70;
  const base = STYLES[style];
  const rules = {
    ...base,
    darkRatio: tuning.darkRatio ?? base.darkRatio,
    isRouteHue: style === 'white-map' ? (h: number, s: number) => isRed(h, s, redSat) : base.isRouteHue,
  };
  const paper = localPaper(img);
  const dark = emptyMask(img.width, img.height);
  const route = emptyMask(img.width, img.height);
  for (let i = 0; i < img.width * img.height; i++) {
    const [h, s, v] = toHsv(img.data[i * 3] ?? 0, img.data[i * 3 + 1] ?? 0, img.data[i * 3 + 2] ?? 0);
    const local = paper[i] ?? 0;
    // Route colour first: a dark edge of the red route on a white map is route, not wall ink.
    const isRoute = rules.isRouteHue(h, s) && v >= local * rules.routeMinRatio && v <= local * rules.routeMaxRatio;
    const coloured = !rules.tintedWalls && s >= 80;
    if (isRoute) route.data[i] = 1;
    else if (v <= local * rules.darkRatio && !isRed(h, s, redSat) && !coloured) dark.data[i] = 1;
  }
  return { dark, route };
}
