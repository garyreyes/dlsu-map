// From ink masks to wall and route segments: replaces OpenCV's morphology and connected components. A wrong rule
// silently drops walls or keeps text as walls, so each case is a small hand-drawn mask with an exact answer.
import { describe, expect, it } from 'vitest';
import { emptyMask, type Mask } from './image.ts';
import { components, extractSegments, longRuns, mergeDoubleLines, normalise } from './segments.ts';

/** Draws filled rectangles [x, y, w, h] on a blank mask. */
function draw(width: number, height: number, ...rects: [number, number, number, number][]): Mask {
  const mask = emptyMask(width, height);
  for (const [x, y, w, h] of rects) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) mask.data[j * width + i] = 1;
  }
  return mask;
}
const count = (m: Mask) => m.data.reduce((n, v) => n + v, 0);

describe('longRuns', () => {
  it('keeps horizontal runs at least as long as asked, and nothing else', () => {
    const mask = draw(100, 20, [10, 5, 50, 2], [10, 12, 20, 2]);
    expect(count(longRuns(mask, 45, 'horizontal'))).toBe(100);
  });

  it('keeps vertical runs for the vertical pass', () => {
    const mask = draw(20, 100, [5, 10, 2, 60], [12, 10, 2, 30]);
    expect(count(longRuns(mask, 45, 'vertical'))).toBe(120);
  });
});

describe('components', () => {
  it('turns each horizontal blob into one segment through its middle, with its thickness', () => {
    expect(components(draw(100, 20, [10, 5, 50, 4]), 'horizontal')).toStrictEqual([
      { x0: 10, y0: 7, x1: 60, y1: 7, t: 4 },
    ]);
  });

  it('turns a vertical blob into one vertical segment', () => {
    expect(components(draw(20, 100, [5, 10, 3, 60]), 'vertical')).toStrictEqual([
      { x0: 6.5, y0: 10, x1: 6.5, y1: 70, t: 3 },
    ]);
  });

  it('ignores a blob that is not long for its direction (a square of ink)', () => {
    expect(components(draw(50, 50, [10, 10, 20, 20]), 'horizontal')).toStrictEqual([]);
  });
});

describe('mergeDoubleLines (evacuation maps draw each wall as two thin lines)', () => {
  it('merges two close, overlapping parallels into one thick wall', () => {
    const a = { x0: 10, y0: 100, x1: 210, y1: 100, t: 2 };
    const b = { x0: 12, y0: 108, x1: 208, y1: 108, t: 2 };
    expect(mergeDoubleLines([a, b], 'horizontal', 24)).toStrictEqual([{ x0: 12, y0: 104, x1: 208, y1: 104, t: 10 }]);
  });

  it('keeps two parallels that are too far apart as two walls', () => {
    const a = { x0: 10, y0: 100, x1: 210, y1: 100, t: 2 };
    const b = { x0: 10, y0: 140, x1: 210, y1: 140, t: 2 };
    expect(mergeDoubleLines([a, b], 'horizontal', 24)).toStrictEqual([a, b]);
  });

  it('keeps two close parallels that barely overlap (a corridor wall and a room wall end to end)', () => {
    const a = { x0: 10, y0: 100, x1: 110, y1: 100, t: 2 };
    const b = { x0: 100, y0: 106, x1: 300, y1: 106, t: 2 };
    expect(mergeDoubleLines([a, b], 'horizontal', 24)).toStrictEqual([a, b]);
  });
});

describe('extractSegments', () => {
  // A 300×200 plan: a double-line wall along the top with a door gap, a double-line wall down the left, a stray
  // digit-sized stroke, and the green route along the middle.
  const dark = draw(
    300,
    200,
    [20, 20, 100, 2],
    [20, 28, 100, 2], // top wall, left of the door
    [160, 20, 120, 2],
    [160, 28, 120, 2], // top wall, right of the door
    [20, 40, 2, 140],
    [28, 40, 2, 140], // left wall
    [150, 100, 12, 2], // a digit stroke: too short to be a wall
  );
  const route = draw(300, 200, [40, 120, 200, 4]);
  const result = extractSegments(dark, route, { wallMin: 45, routeMin: 60, maxGap: 24, maxThickness: 40 });

  it('finds the door gap as two walls, the left wall as one, and drops the digit', () => {
    expect(result.walls).toStrictEqual([
      { x0: 20, y0: 25, x1: 120, y1: 25, t: 10 },
      { x0: 160, y0: 25, x1: 280, y1: 25, t: 10 },
      { x0: 25, y0: 40, x1: 25, y1: 180, t: 10 },
    ]);
  });

  it('finds the hallway route', () => {
    expect(result.route).toStrictEqual([{ x0: 40, y0: 122, x1: 240, y1: 122, t: 4 }]);
  });

  it('drops a blob thicker than any wall line (a filled block, not a wall)', () => {
    const block = extractSegments(draw(300, 200, [20, 20, 200, 60]), emptyMask(300, 200), {
      wallMin: 45,
      routeMin: 60,
      maxGap: 24,
      maxThickness: 40,
    });
    expect(block.walls).toStrictEqual([]);
  });
});

describe('normalise', () => {
  it('maps the plan (inside the padding) onto 0–1, thickness across the line (height, for a horizontal wall)', () => {
    expect(normalise({ x0: 10, y0: 10, x1: 110, y1: 10, t: 4 }, 10, 200, 100)).toStrictEqual({
      x0: 0,
      y0: 0,
      x1: 0.5,
      y1: 0,
      t: 0.04,
    });
  });
});
