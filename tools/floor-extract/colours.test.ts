// Which pixels count as wall ink and which as the hallway route. Two map styles exist on campus (checked on one floor
// of each photographed building, 2026-10-20): STRC's green signs (double black walls, green route) and the white
// "EVACUATION MAP" template everywhere else (thin grey walls, red route, often under glare). Ink is judged against
// the paper around it, so glare and shadows don't hide walls. The ratios were measured on STRC 4F and St. Joseph 3F.
import { describe, expect, it } from 'vitest';
import { STYLES, classify, detectStyle, localPaper, toHsv, type Style } from './colours.ts';
import type { Rgb } from './image.ts';

type Px = readonly [number, number, number];

/** A `width`×`height` photo filled with `bg`, with the given pixels set after (by index). */
function photo(bg: Px, pixels: Px[] = [], width = 64, height = 64): Rgb {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) data.set(bg, i * 3);
  pixels.forEach((p, i) => {
    data.set(p, i * 3);
  });
  return { width, height, data };
}

describe('toHsv (OpenCV scale: H 0–180, S and V 0–255)', () => {
  it.each([
    [
      [255, 0, 0],
      [0, 255, 255],
    ],
    [
      [0, 255, 0],
      [60, 255, 255],
    ],
    [
      [0, 0, 255],
      [120, 255, 255],
    ],
    [
      [208, 208, 208],
      [0, 0, 208],
    ],
    [
      [0, 0, 0],
      [0, 0, 0],
    ],
    [
      [129, 78, 90],
      [173, 101, 129],
    ],
  ] as const)('%j → %j', (rgb, hsv) => {
    expect(toHsv(rgb[0], rgb[1], rgb[2])).toStrictEqual(hsv);
  });
});

describe('STYLES', () => {
  it('keeps the spike’s STRC thresholds on its paper (V 208): walls ≤ 75, route 85–200', () => {
    const s = STYLES['green-sign'];
    expect([s.darkRatio, s.routeMinRatio, s.routeMaxRatio].map((r) => Math.round(r * 208))).toStrictEqual([
      75, 85, 200,
    ]);
  });

  it('lets the white template’s grey walls through (V 103 on paper 180, St. Joseph 3F)', () => {
    expect(103 <= STYLES['white-map'].darkRatio * 180).toBe(true);
  });
});

describe('detectStyle', () => {
  it.each([
    ['STRC’s light-green sign', [170, 209, 150], 'green-sign'],
    ['white paper', [180, 180, 178], 'white-map'],
    ['white paper under a warm light', [200, 185, 170], 'white-map'],
  ] as const)('%s → %s', (_label, paper, style) => {
    expect(detectStyle(photo(paper))).toBe(style);
  });
});

describe('localPaper', () => {
  it('follows glare and shadow: each half of the photo gets its own paper brightness', () => {
    const img = photo([180, 180, 180], [], 128, 64);
    for (let y = 0; y < 64; y++) for (let x = 64; x < 128; x++) img.data.set([230, 230, 230], (y * 128 + x) * 3);
    const paper = localPaper(img);
    expect(paper[32 * 128 + 10]).toBe(180);
    expect(paper[32 * 128 + 120]).toBe(230);
  });

  it('is not pulled down by ink (the paper is the bright majority of each block)', () => {
    const inky = photo(
      [180, 180, 180],
      Array.from({ length: 1000 }, () => [20, 20, 20] as Px),
    );
    expect(localPaper(inky)[40 * 64 + 40]).toBe(180);
  });
});

describe('classify', () => {
  const one = (style: Style, bg: Px, px: Px) => {
    const { dark, route } = classify(photo(bg, [px]), style);
    return dark.data[0] ? 'wall' : route.data[0] ? 'route' : 'neither';
  };

  it.each([
    ['black ink', [30, 30, 30], 'wall'],
    ['ink tinted green by the photo', [25, 50, 30], 'wall'],
    ['the green route line', [20, 110, 40], 'route'],
    ['red (fire equipment, ignored)', [200, 30, 30], 'neither'],
    ['dark red', [70, 10, 10], 'neither'],
    ['paper', [170, 209, 150], 'neither'],
    ['mid-grey shading', [120, 120, 120], 'neither'],
  ] as const)('green sign: %s → %s', (_label, px, expected) => {
    expect(one('green-sign', [170, 209, 150], px)).toBe(expected);
  });

  it.each([
    ['a thin grey wall (V 103)', [103, 103, 103], 'wall'],
    ['a darker wall (V 72)', [72, 72, 70], 'wall'],
    ['black text', [30, 30, 30], 'wall'],
    ['the pink-red route line', [129, 78, 90], 'route'],
    ['a darker, paler edge of the route (S 74, V 100): route, never wall', [100, 71, 78], 'route'],
    ['a bright red fire symbol', [220, 40, 40], 'neither'],
    ['the green "you are here" arrow', [40, 140, 90], 'neither'],
    ['paper', [180, 180, 178], 'neither'],
    ['light grey hatching', [150, 150, 150], 'neither'],
  ] as const)('white map: %s → %s', (_label, px, expected) => {
    expect(one('white-map', [180, 180, 178], px)).toBe(expected);
  });

  it.each([
    ['a faint grey wall (V 125, 0.81 of the paper)', [125, 125, 125], 'neither', 'wall'],
    ['the pale route (S 55, V 98)', [98, 77, 80], 'wall', 'route'],
    ['paper texture (V 147)', [147, 147, 147], 'neither', 'neither'],
    ['a bright red fire symbol', [220, 40, 40], 'neither', 'neither'],
  ] as const)('a washed-out photo (Velasco 2F, paper V 155), plain and tuned: %s', (_label, px, plain, tuned) => {
    const bg = [155, 155, 155] as const;
    expect(one('white-map', bg, px)).toBe(plain);
    const { dark, route } = classify(photo(bg, [px]), 'white-map', { darkRatio: 0.88, redSat: 40 });
    expect(dark.data[0] ? 'wall' : route.data[0] ? 'route' : 'neither').toBe(tuned);
  });

  it('finds a grey wall under glare that a whole-page threshold would miss', () => {
    // Left half paper 180, right half glare 230; the same V 140 pixel is a wall only where the paper around it is 230.
    const img = photo([180, 180, 180], [], 128, 64);
    for (let y = 0; y < 64; y++) for (let x = 64; x < 128; x++) img.data.set([230, 230, 230], (y * 128 + x) * 3);
    img.data.set([140, 140, 140], (32 * 128 + 10) * 3);
    img.data.set([140, 140, 140], (32 * 128 + 120) * 3);
    const { dark } = classify(img, 'white-map');
    expect([dark.data[32 * 128 + 10], dark.data[32 * 128 + 120]]).toStrictEqual([0, 1]);
  });
});
