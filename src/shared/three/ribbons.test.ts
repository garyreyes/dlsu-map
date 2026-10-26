import { describe, expect, it } from 'vitest';
import { ribbonAlong, ribbonPositions } from './ribbons';

describe('ribbonAlong', () => {
  const lines = [
    [0, 0, 10, 0, 10, 5],
    [20, 0, 20, 10],
  ];

  it('gives one value per vertex ribbonPositions emits, tiny segments skipped in both', () => {
    const withTiny = [
      [0, 0, 0.001, 0, 5, 0],
      [3, 3, 3, 8],
    ];
    expect(ribbonAlong(withTiny, 2)).toHaveLength(ribbonPositions(withTiny, 2, 0).length / 3);
    expect(ribbonAlong(lines, 2)).toHaveLength(ribbonPositions(lines, 2, 0).length / 3);
  });

  it('pushes each quad end out by half the width and carries the distance on across lines', () => {
    // Segments: 0..10, 10..15, then line 2 from 15 to 25. Order per quad: r1, r2, l2, r1, l2, l1.
    expect(Array.from(ribbonAlong(lines, 2))).toEqual([
      -1, 11, 11, -1, 11, -1, 9, 16, 16, 9, 16, 9, 14, 26, 26, 14, 26, 14,
    ]);
  });

  it('counts a skipped tiny segment toward the distance', () => {
    // 0.005 m skipped, then 4.995 m: the quad starts at 0.005 and ends at 5.
    const [r1, r2] = Array.from(ribbonAlong([[0, 0, 0.005, 0, 5, 0]], 2));
    expect(r1).toBeCloseTo(0.005 - 1, 5);
    expect(r2).toBeCloseTo(5 + 1, 5);
  });

  it('is empty with no lines', () => {
    expect(Array.from(ribbonAlong([], 2))).toEqual([]);
  });
});
