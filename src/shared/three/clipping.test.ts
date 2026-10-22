// The cut plane keeps what is at or below the cut and clips what is above. Three clips where the distance to the
// plane is negative, so a flipped normal would slice away the floor and keep the roof.
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { cutPlane } from './clipping';

describe('cutPlane', () => {
  it('keeps a point just below the cut', () => {
    expect(cutPlane(9.6).distanceToPoint(new Vector3(5, 9.5, -3))).toBeGreaterThanOrEqual(0);
  });

  it('clips a point just above the cut', () => {
    expect(cutPlane(9.6).distanceToPoint(new Vector3(5, 9.7, -3))).toBeLessThan(0);
  });

  it('keeps a point exactly on the cut', () => {
    expect(cutPlane(9.6).distanceToPoint(new Vector3(0, 9.6, 0))).toBeCloseTo(0);
  });
});
