// The fit puts a sign onto its building's outline (D36). A floor turned round or mirrored would look as plausible as
// the right one, so every case here pins exact meters: which sign corner lands on which outline corner.
import { describe, expect, it } from 'vitest';
import { fitFrame, fitPoint, outlineCorners, outlineGap, type Frame } from './fit.ts';
import type { Point } from './geometry.ts';

const LANDSCAPE = { width: 400, height: 100 };
const PORTRAIT = { width: 100, height: 400 };

/** 40 m east–west by 10 m north–south, anticlockwise from the south-west corner. */
const BOX: Point[] = [
  [0, 0],
  [40, 0],
  [40, 10],
  [0, 10],
];

const rounded = (p: Point): Point => [Math.round(p[0] * 1000) / 1000 + 0, Math.round(p[1] * 1000) / 1000 + 0];
const framed = (f: Frame) => ({ tl: rounded(f.tl), tr: rounded(f.tr), br: rounded(f.br), bl: rounded(f.bl) });
/** Corners in any order: the smallest rectangle has no first corner. */
const asSet = (ps: readonly Point[]) => ps.map(rounded).sort();

describe('outlineCorners', () => {
  it("uses OSM's own 4 corners, anticlockwise, whichever way the ring runs", () => {
    const skewed: Point[] = [
      [0, 0],
      [60, 0],
      [62, 17],
      [0, 15],
    ];
    expect(outlineCorners(skewed)).toStrictEqual(skewed);
    expect(outlineCorners([...skewed].reverse())).toStrictEqual(skewed);
  });

  it('drops points where a side bends under 5°, even outward, before counting corners', () => {
    // 1.7° out at (20, -0.3): kept, it would make 5 corners and a rectangle 10.3 m deep.
    const ring: Point[] = [
      [0, 0],
      [20, -0.3],
      [40, 0],
      [40, 5],
      [40, 10],
      [0, 10],
    ];
    expect(outlineCorners(ring)).toStrictEqual(BOX);
  });

  it('takes the smallest rectangle around an outline with more than 4 corners', () => {
    const notched: Point[] = [
      [0, 0],
      [40, 0],
      [40, 10],
      [30, 10],
      [30, 8],
      [10, 8],
      [10, 10],
      [0, 10],
    ];
    expect(asSet(outlineCorners(notched))).toStrictEqual(asSet(BOX));
  });

  it('follows a turned outline: the smallest rectangle lies along it, not along north', () => {
    const c = Math.cos(Math.PI / 6);
    const s = Math.sin(Math.PI / 6);
    const turn = ([x, y]: Point): Point => [x * c - y * s, x * s + y * c];
    const notched: Point[] = [
      [0, 0],
      [40, 0],
      [40, 10],
      [30, 10],
      [30, 8],
      [10, 8],
      [10, 10],
      [0, 10],
    ].map((p) => turn(p as unknown as Point));
    expect(asSet(outlineCorners(notched))).toStrictEqual(asSet(BOX.map(turn)));
  });
});

describe('fitFrame', () => {
  it('turn 0: a landscape sign lies along the long side with its top to the north', () => {
    expect(framed(fitFrame(BOX, LANDSCAPE, 0))).toStrictEqual({ tl: [0, 10], tr: [40, 10], br: [40, 0], bl: [0, 0] });
  });

  it('turn 180: the same sign with its top to the south', () => {
    expect(framed(fitFrame(BOX, LANDSCAPE, 180))).toStrictEqual({ tl: [40, 0], tr: [0, 0], br: [0, 10], bl: [40, 10] });
  });

  it('a portrait sign puts its top on a short side: north on a north–south building', () => {
    const tall: Point[] = [
      [0, 0],
      [10, 0],
      [10, 40],
      [0, 40],
    ];
    expect(framed(fitFrame(tall, PORTRAIT, 0))).toStrictEqual({ tl: [0, 40], tr: [10, 40], br: [10, 0], bl: [0, 0] });
    expect(framed(fitFrame(tall, PORTRAIT, 180))).toStrictEqual({ tl: [10, 0], tr: [0, 0], br: [0, 40], bl: [10, 40] });
  });

  it('a square sign counts as landscape', () => {
    expect(fitFrame(BOX, { width: 100, height: 100 }, 0)).toStrictEqual(fitFrame(BOX, LANDSCAPE, 0));
  });

  it('on a building turned like the campus (24°), turn 0 puts the top on the north-west long side', () => {
    const a = (24 * Math.PI) / 180;
    const along: Point = [Math.cos(a), Math.sin(a)];
    const across: Point = [-Math.sin(a), Math.cos(a)];
    const at = (u: number, v: number): Point => [along[0] * u + across[0] * v, along[1] * u + across[1] * v];
    const ring = [at(0, 0), at(60, 0), at(60, 17), at(0, 17)];
    expect(framed(fitFrame(ring, LANDSCAPE, 0))).toStrictEqual(
      framed({ tl: at(0, 17), tr: at(60, 17), br: at(60, 0), bl: at(0, 0) }),
    );
    expect(framed(fitFrame(ring, LANDSCAPE, 180))).toStrictEqual(
      framed({ tl: at(60, 0), tr: at(0, 0), br: at(0, 17), bl: at(60, 17) }),
    );
  });

  it('never mirrors: walking the sign clockwise walks the outline clockwise', () => {
    for (const turn of [0, 180] as const) {
      const { tl, tr, br } = fitFrame(BOX, LANDSCAPE, turn);
      const cross = (tr[0] - tl[0]) * (br[1] - tr[1]) - (tr[1] - tl[1]) * (br[0] - tr[0]);
      expect(cross).toBeLessThan(0);
    }
  });
});

describe('fitPoint', () => {
  it('stretches the sign onto the outline: each axis on its own', () => {
    const frame = fitFrame(BOX, LANDSCAPE, 0);
    expect(rounded(fitPoint(frame, 0.25, 0.5))).toStrictEqual([10, 5]);
    expect(rounded(fitPoint(frame, 1, 0))).toStrictEqual([40, 10]);
    expect(rounded(fitPoint(frame, 0, 1))).toStrictEqual([0, 0]);
  });

  it('turned 180, the same point lands across the building', () => {
    expect(rounded(fitPoint(fitFrame(BOX, LANDSCAPE, 180), 0.25, 0.5))).toStrictEqual([30, 5]);
  });

  it("follows a skewed outline's corners exactly, and blends between them", () => {
    const skewed: Point[] = [
      [0, 0],
      [60, 0],
      [64, 16],
      [0, 16],
    ];
    const frame = fitFrame(skewed, LANDSCAPE, 0);
    expect(rounded(fitPoint(frame, 1, 0))).toStrictEqual([64, 16]);
    expect(rounded(fitPoint(frame, 1, 1))).toStrictEqual([60, 0]);
    expect(rounded(fitPoint(frame, 1, 0.5))).toStrictEqual([62, 8]);
    expect(rounded(fitPoint(frame, 0.5, 0.5))).toStrictEqual([31, 8]);
  });

  it('keeps walls traced just past the sign edge just past the outline', () => {
    expect(rounded(fitPoint(fitFrame(BOX, LANDSCAPE, 0), -0.01, 0))).toStrictEqual([-0.4, 10]);
  });
});

describe('outlineGap', () => {
  it('is 0 when walls trace the outline', () => {
    const walls = BOX.map((p, i) => [p, BOX[(i + 1) % 4] as Point]);
    expect(outlineGap(BOX, walls)).toStrictEqual({ median: 0, p90: 0 });
  });

  it('measures how far the outline is from the nearest wall', () => {
    const inset: Point[][] = [
      [
        [0, 1],
        [40, 1],
      ],
      [
        [0, 9],
        [40, 9],
      ],
    ];
    // The long sides are 1 m from a wall; the short ends are up to 5 m from one.
    const gap = outlineGap(BOX, inset);
    expect(gap.median).toBeCloseTo(1, 5);
    expect(gap.p90).toBeGreaterThan(1);
    expect(gap.p90).toBeLessThanOrEqual(4);
  });
});
