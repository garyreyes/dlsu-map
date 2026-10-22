import { describe, expect, it } from 'vitest';
import type { FloorSource } from '../../src/shared/data/floor-source.ts';
import { gapsInBand, wallsInPx } from './plan-px.ts';

/** A 1000 × 200 px sign: a corridor wall at y 100 in three pieces, one slightly slanted, and two room dividers. */
const floor: FloorSource = {
  building: 'strc',
  floor: 2,
  extractedFrom: 'strc_02F.jpg',
  checked: false,
  plan: { width: 1000, height: 200 },
  fit: { turn: 180 },
  walls: [
    [0.6, 0.5, 1, 0.5],
    [0, 0.5, 0.3, 0.5025],
    [0.35, 0.5, 0.5, 0.5],
    [0.4, 0.5, 0.4, 1],
    [0.7, 0.5, 0.7, 1],
    [0.45, 0.49, 0.58, 0.5],
  ],
  hallways: [[0, 0.25, 1, 0.25]],
};

describe('wallsInPx', () => {
  it('lists the walls in plan px, across by y then x and down by x then y, each with its index in the file', () => {
    expect(wallsInPx(floor)).toStrictEqual({
      across: [
        { y: 99, from: 450, to: 580, index: 5 },
        { y: 100, from: 0, to: 300, index: 1 },
        { y: 100, from: 350, to: 500, index: 2 },
        { y: 100, from: 600, to: 1000, index: 0 },
      ],
      down: [
        { x: 400, from: 100, to: 200, index: 3 },
        { x: 700, from: 100, to: 200, index: 4 },
      ],
    });
  });
});

describe('gapsInBand', () => {
  it('gives the gaps between the walls lying across a band, merging walls that overlap', () => {
    // 0–300, 350–500 and 450–580 (merged to 350–580), 600–1000: gaps 300–350 and 580–600.
    expect(gapsInBand(floor, 90, 110)).toStrictEqual([
      [300, 350],
      [580, 600],
    ]);
  });

  it('leaves out gaps no wider than the given width (10 px unless given)', () => {
    expect(gapsInBand(floor, 90, 110, 30)).toStrictEqual([[300, 350]]);
  });

  it('ignores walls whose middle is outside the band', () => {
    expect(gapsInBand(floor, 99.5, 110)).toStrictEqual([
      [300, 350],
      [500, 600],
    ]);
  });
});
