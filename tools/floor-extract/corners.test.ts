// The 4 corners decide how the whole plan is straightened: corners in the wrong order fold the plan over itself and
// every wall lands in the wrong place, with no error. So each kind of wrong input must be refused, by name.
import { describe, expect, it } from 'vitest';
import { checkCorners, parsePoint } from './corners.ts';

const size = { width: 4000, height: 3000 };
const tl = [100, 100] as const;
const tr = [3000, 150] as const;
const br = [2900, 2500] as const;
const bl = [150, 2400] as const;

describe('parsePoint', () => {
  it.each([
    ['120,340', [120, 340]],
    [' 120 , 340 ', [120, 340]],
    ['120.5,340', [120.5, 340]],
  ])('reads %j', (text, point) => {
    expect(parsePoint(text)).toStrictEqual(point);
  });

  it.each(['120', '120,', 'a,b', '120,340,5', '-5,10'])('refuses %j', (text) => {
    expect(parsePoint(text)).toBeNull();
  });
});

describe('checkCorners', () => {
  it('accepts a slightly tilted plan, clockwise from top-left', () => {
    expect(checkCorners([tl, tr, br, bl], size)).toStrictEqual({ corners: [tl, tr, br, bl] });
  });

  it.each([
    ['only 3 corners', [tl, tr, br], 'give 4 corners: top-left, top-right, bottom-right, bottom-left'],
    ['a corner outside the photo', [tl, [4100, 150], br, bl], 'corner 2 (4100, 150) is outside the 4000×3000 photo'],
    [
      'anticlockwise order',
      [tl, bl, br, tr],
      'corners must go clockwise: top-left, top-right, bottom-right, bottom-left',
    ],
    ['a crossed order', [tl, br, tr, bl], 'corners must go clockwise: top-left, top-right, bottom-right, bottom-left'],
    [
      'a dent (not convex)',
      [tl, tr, [1500, 300], bl],
      'corners must go clockwise: top-left, top-right, bottom-right, bottom-left',
    ],
    ['starting from another corner', [tr, br, bl, tl], 'corner 1 must be the top-left one (smallest x + y)'],
    [
      'a plan under 200 px across',
      [
        [0, 0],
        [150, 0],
        [150, 150],
        [0, 150],
      ],
      'the plan is only 150×150 px; pick the outer corners',
    ],
  ] as const)('refuses %s', (_label, points, error) => {
    expect(checkCorners(points, size)).toStrictEqual({ error });
  });
});
