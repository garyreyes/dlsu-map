// Straightening replaces OpenCV's warpPerspective. A wrong homography stretches or shears the plan without any error,
// so the maths is checked on points with known answers and on a drawn image.
import { describe, expect, it } from 'vitest';
import type { Point, Rgb } from './image.ts';
import { applyHomography, homography, warpPlan } from './warp.ts';

const close = (a: Point, b: Point) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
};

describe('homography', () => {
  it('maps each of the 4 source corners exactly onto its target', () => {
    const src: Point[] = [
      [12, 30],
      [410, 8],
      [430, 300],
      [5, 280],
    ];
    const dst: Point[] = [
      [0, 0],
      [400, 0],
      [400, 300],
      [0, 300],
    ];
    const h = homography(src, dst);
    src.forEach((p, i) => {
      close(applyHomography(h, p), dst[i] as Point);
    });
  });

  it('is a plain shift when the shapes are the same', () => {
    const h = homography(
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      [
        [5, 7],
        [15, 7],
        [15, 17],
        [5, 17],
      ],
    );
    close(applyHomography(h, [3, 4]), [8, 11]);
  });

  it('keeps straight lines straight (the middle of an edge maps to the middle of the target edge)', () => {
    const h = homography(
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ],
      [
        [0, 0],
        [200, 0],
        [200, 100],
        [0, 100],
      ],
    );
    close(applyHomography(h, [50, 0]), [100, 0]);
  });
});

describe('warpPlan', () => {
  // A 60×40 grey photo with one red pixel; the plan is the whole photo, given as its 4 corners.
  const photo: Rgb = { width: 60, height: 40, data: new Uint8Array(60 * 40 * 3).fill(200) };
  photo.data.set([255, 0, 0], (10 * 60 + 30) * 3);

  it('sizes the output to the longer of each pair of edges, plus padding on every side', () => {
    const { image, width, height } = warpPlan(
      photo,
      [
        [0, 0],
        [59, 0],
        [59, 39],
        [0, 39],
      ],
      5,
    );
    expect([width, height, image.width, image.height]).toStrictEqual([59, 39, 69, 49]);
  });

  it('puts each photo pixel at its place in the straightened plan', () => {
    const { image } = warpPlan(
      photo,
      [
        [0, 0],
        [59, 0],
        [59, 39],
        [0, 39],
      ],
      5,
    );
    const at = (x: number, y: number) => [
      ...image.data.subarray((y * image.width + x) * 3, (y * image.width + x) * 3 + 3),
    ];
    expect(at(35, 15)).toStrictEqual([255, 0, 0]);
    expect(at(36, 15)).toStrictEqual([200, 200, 200]);
  });

  it('fills the padding by repeating the edge, so a dark outer wall never looks like a frame', () => {
    const { image } = warpPlan(
      photo,
      [
        [0, 0],
        [59, 0],
        [59, 39],
        [0, 39],
      ],
      5,
    );
    expect([...image.data.subarray(0, 3)]).toStrictEqual([200, 200, 200]);
  });
});
