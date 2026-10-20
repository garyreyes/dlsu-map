// Plane geometry for the compiler. Each helper decides what is kept or cut, so a wrong answer silently drops or
// misplaces map pieces; the cases use shapes whose answers can be worked out by hand.
import { describe, expect, it } from 'vitest';
import { centroid, clipLine, expand, pointInRing, ringArea, ringsTouch, round, type Rect } from './geometry.ts';

const square: [number, number][] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

describe('ringArea', () => {
  it('is the same either way round', () => {
    expect(ringArea(square)).toBe(100);
    expect(ringArea([...square].reverse())).toBe(100);
  });
});

describe('centroid', () => {
  it('is the middle of a square', () => {
    expect(centroid(square)).toStrictEqual([5, 5]);
  });

  it('weights by area, not by how many points a side has', () => {
    const extraPoints: [number, number][] = [
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 0],
      [8, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(centroid(extraPoints)).toStrictEqual([5, 5]);
  });
});

describe('pointInRing', () => {
  it.each([
    [[5, 5], true],
    [[15, 5], false],
    [[-1, -1], false],
  ] as const)('%j → %s', (point, inside) => {
    expect(pointInRing([point[0], point[1]], square)).toBe(inside);
  });
});

describe('clipLine', () => {
  const box: Rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

  it('keeps a line fully inside', () => {
    expect(
      clipLine(
        [
          [1, 1],
          [9, 9],
        ],
        box,
      ),
    ).toStrictEqual([
      [
        [1, 1],
        [9, 9],
      ],
    ]);
  });

  it('drops a line fully outside', () => {
    expect(
      clipLine(
        [
          [20, 0],
          [30, 5],
        ],
        box,
      ),
    ).toStrictEqual([]);
  });

  it('cuts a line at the exact edge', () => {
    expect(
      clipLine(
        [
          [-10, 5],
          [5, 5],
        ],
        box,
      ),
    ).toStrictEqual([
      [
        [0, 5],
        [5, 5],
      ],
    ]);
  });

  it('splits a line that leaves and comes back into two pieces', () => {
    expect(
      clipLine(
        [
          [2, 5],
          [20, 5],
          [20, 8],
          [4, 8],
        ],
        box,
      ),
    ).toStrictEqual([
      [
        [2, 5],
        [10, 5],
      ],
      [
        [10, 8],
        [4, 8],
      ],
    ]);
  });

  it('drops a line that only grazes a corner', () => {
    expect(
      clipLine(
        [
          [-5, 5],
          [5, -5],
        ],
        box,
      ),
    ).toStrictEqual([]);
  });

  it('never repeats a point, even when a line ends on the edge and turns outward', () => {
    expect(
      clipLine(
        [
          [5, 5],
          [10, 5],
          [15, 5],
        ],
        box,
      ),
    ).toStrictEqual([
      [
        [5, 5],
        [10, 5],
      ],
    ]);
    expect(
      clipLine(
        [
          [5, 5],
          [5, 5],
          [8, 5],
        ],
        box,
      ),
    ).toStrictEqual([
      [
        [5, 5],
        [8, 5],
      ],
    ]);
  });

  it('keeps a segment that crosses the box with both ends outside', () => {
    expect(
      clipLine(
        [
          [-5, 5],
          [15, 5],
        ],
        box,
      ),
    ).toStrictEqual([
      [
        [0, 5],
        [10, 5],
      ],
    ]);
  });
});

describe('ringsTouch', () => {
  const box = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];

  it.each([
    ['one inside the other', box(2, 2, 4, 4), true],
    ['overlapping corners', box(8, 8, 12, 12), true],
    ['sharing only an edge', box(10, 2, 20, 4), true],
    [
      'crossing with no corner inside either (a plus sign)',
      [
        [-5, 4],
        [15, 4],
        [15, 6],
        [-5, 6],
      ],
      true,
    ],
    ['apart', box(20, 20, 30, 30), false],
  ] as const)('%s → %s', (_label, other, touches) => {
    expect(
      ringsTouch(
        square,
        other.map(([x, y]) => [x, y] as const),
      ),
    ).toBe(touches);
  });
});

describe('expand', () => {
  it('grows a box by the same distance on every side', () => {
    expect(expand({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 300)).toStrictEqual({
      minX: -300,
      minY: -300,
      maxX: 310,
      maxY: 310,
    });
  });
});

describe('round', () => {
  it('rounds to 0.1 m and never writes -0', () => {
    expect(round(1.26)).toBe(1.3);
    expect(round(-0.04)).toBe(0);
    expect(Object.is(round(-0.04), -0)).toBe(false);
  });
});
