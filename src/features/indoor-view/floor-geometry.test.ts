// The floor builder puts a floor file's walls into the 3D campus. If it put them at the wrong height, mirrored them
// or turned faces inward, the floor would sit outside its building or look hollow, and nothing else would notice:
// the shape of the output is the same either way. So each case asserts exact positions.
import { describe, expect, it } from 'vitest';
import type { Volume } from '@/shared/data/campus';
import type { IndoorFloor } from '@/shared/data/indoor';
import sample from '@/shared/data/indoor.sample.json';
import { indoorSchema } from '@/shared/data/indoor';
import { CUT_ABOVE_FLOOR } from './cutaway';
import {
  buildFloor,
  buildSlab,
  cutawayAt,
  cutHeight,
  floorOf,
  floorsFrom,
  HALLWAY_LIFT,
  HALLWAY_WIDTH,
  SLAB_LIFT,
  slabOutlines,
  WALL_THICKNESS,
} from './floor-geometry';

const indoor = indoorSchema.parse(sample);

const floor = (over: Partial<IndoorFloor>): IndoorFloor => ({
  floor: 2,
  base: 3.4,
  height: 3.4,
  checked: false,
  walls: [],
  hallways: [],
  ...over,
});

/** Smallest and largest x, y and z over a flat x, y, z array. */
function bounds(p: Float32Array) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  p.forEach((v, i) => {
    const k = i % 3;
    min[k] = Math.min(min[k] ?? v, v);
    max[k] = Math.max(max[k] ?? v, v);
  });
  return { min, max };
}

const triangles = (p: Float32Array) => p.length / 9;
const h = WALL_THICKNESS / 2;

describe('buildFloor walls', () => {
  it('raises a wall from the floor base to base + height, as thick as WALL_THICKNESS', () => {
    const { walls } = buildFloor(floor({ walls: [[0, 0, 10, 0]] }));
    const { min, max } = bounds(walls.positions);
    // Each end runs on by half the thickness, so walls meeting at a corner close it.
    expect(min[0]).toBeCloseTo(-h);
    expect(max[0]).toBeCloseTo(10 + h);
    expect(min[1]).toBeCloseTo(3.4);
    expect(max[1]).toBeCloseTo(6.8);
    expect(min[2]).toBeCloseTo(-h);
    expect(max[2]).toBeCloseTo(h);
  });

  it('puts north at -z, so the floor is not mirrored against the campus', () => {
    const { walls } = buildFloor(floor({ walls: [[0, 5, 10, 5]] }));
    const { min, max } = bounds(walls.positions);
    expect(min[2]).toBeCloseTo(-5 - h);
    expect(max[2]).toBeCloseTo(-5 + h);
  });

  it('makes two sides, two ends and a top per segment: 10 triangles', () => {
    expect(triangles(buildFloor(floor({ walls: [[0, 0, 10, 0]] })).walls.positions)).toBe(10);
  });

  it('builds one box per segment of a line with more than two points', () => {
    const { walls } = buildFloor(
      floor({
        walls: [
          [0, 0, 10, 0, 10, 8],
          [20, 0, 20, 5],
        ],
      }),
    );
    expect(triangles(walls.positions)).toBe(30);
  });

  it('skips a segment with no length', () => {
    expect(triangles(buildFloor(floor({ walls: [[3, 3, 3, 3]] })).walls.positions)).toBe(0);
  });

  it('faces every triangle the way its normal points, with unit normals', () => {
    const { positions: p, normals: n } = buildFloor(floor({ walls: [[1, 2, 7, 9, -4, 6]] })).walls;
    expect(n.length).toBe(p.length);
    for (let t = 0; t < p.length; t += 9) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = Array.from(p.subarray(t, t + 9));
      const [ux, uy, uz] = [(bx ?? 0) - (ax ?? 0), (by ?? 0) - (ay ?? 0), (bz ?? 0) - (az ?? 0)];
      const [vx, vy, vz] = [(cx ?? 0) - (ax ?? 0), (cy ?? 0) - (ay ?? 0), (cz ?? 0) - (az ?? 0)];
      const cross = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const [nx = 0, ny = 0, nz = 0] = Array.from(n.subarray(t, t + 3));
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1);
      expect((cross[0] ?? 0) * nx + (cross[1] ?? 0) * ny + (cross[2] ?? 0) * nz).toBeGreaterThan(0);
    }
  });

  it('points every face away from the middle of the wall, so none faces inward', () => {
    // A slanted wall, so a swapped east/north or a mirrored z would show.
    const { positions: p, normals: n } = buildFloor(floor({ walls: [[2, 1, 8, 9]] })).walls;
    const middle = [5, 3.4 + 1.7, -5];
    for (let t = 0; t < p.length; t += 9) {
      const centroid = [0, 1, 2].map((k) => ((p[t + k] ?? 0) + (p[t + 3 + k] ?? 0) + (p[t + 6 + k] ?? 0)) / 3);
      const out = [0, 1, 2].map((k) => (centroid[k] ?? 0) - (middle[k] ?? 0));
      const dot = (n[t] ?? 0) * (out[0] ?? 0) + (n[t + 1] ?? 0) * (out[1] ?? 0) + (n[t + 2] ?? 0) * (out[2] ?? 0);
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('builds the sample ground floor at ground level, 10 triangles a wall', () => {
    const first = floorOf(indoor, 1);
    if (!first) throw new Error('sample has floor 1');
    const { walls } = buildFloor(first);
    expect(triangles(walls.positions)).toBe(first.walls.length * 10);
    const { min, max } = bounds(walls.positions);
    expect(min[1]).toBeCloseTo(0);
    expect(max[1]).toBeCloseTo(3.4);
  });
});

describe('buildFloor hallways', () => {
  it('lays each hallway flat, just above the floor base, HALLWAY_WIDTH wide', () => {
    const { hallways } = buildFloor(floor({ base: 6.8, hallways: [[0, 0, 10, 0]] }));
    const { min, max } = bounds(hallways);
    expect(min[1]).toBeCloseTo(6.8 + HALLWAY_LIFT);
    expect(max[1]).toBeCloseTo(6.8 + HALLWAY_LIFT);
    expect(min[2]).toBeCloseTo(-HALLWAY_WIDTH / 2);
    expect(max[2]).toBeCloseTo(HALLWAY_WIDTH / 2);
    expect(triangles(hallways)).toBe(2);
  });

  it('faces every hallway triangle up, so it shows from the camera above', () => {
    const { hallways: p } = buildFloor(floor({ hallways: [[0, 0, 10, 0, 10, 6, 3, 9]] }));
    expect(triangles(p)).toBe(6);
    for (let t = 0; t < p.length; t += 9) {
      const [ax = 0, , az = 0, bx = 0, , bz = 0, cx = 0, , cz = 0] = Array.from(p.subarray(t, t + 9));
      // The y part of (b - a) × (c - a): positive when the triangle winds anticlockwise seen from above.
      expect((bz - az) * (cx - ax) - (bx - ax) * (cz - az)).toBeGreaterThan(0);
    }
  });

  it('builds nothing for a floor with no hallways', () => {
    expect(buildFloor(floor({ walls: [[0, 0, 1, 0]] })).hallways.length).toBe(0);
  });
});

describe('floorOf', () => {
  it('finds a floor by its number, not its place in the list', () => {
    expect(floorOf(indoor, 3)?.base).toBe(6.8);
  });

  it('answers undefined for a floor not traced yet', () => {
    expect(floorOf(indoor, 2)).toBeUndefined();
  });
});

describe('cutHeight', () => {
  it('is the floor base plus CUT_ABOVE_FLOOR', () => {
    expect(cutHeight(indoor, 3)).toBeCloseTo(6.8 + CUT_ABOVE_FLOOR);
    expect(cutHeight({ ...indoor, floors: [floor({ floor: 4, base: 8.4 })] }, 4)).toBeCloseTo(9.6);
  });

  it('answers undefined for a floor not traced yet', () => {
    expect(cutHeight(indoor, 2)).toBeUndefined();
  });
});

describe('floorsFrom', () => {
  const strc = {
    ...indoor,
    floors: [1, 2, 3, 4].map((n) => floor({ floor: n, base: (n - 1) * 3.4 })),
  };

  it('lists the traced floors from the given one up, lowest first', () => {
    expect(floorsFrom(strc, 3).map((f) => f.floor)).toEqual([3, 4]);
  });

  it('starts above an untraced number, and is empty above the top', () => {
    expect(floorsFrom(indoor, 2).map((f) => f.floor)).toEqual([3]);
    expect(floorsFrom(strc, 5)).toEqual([]);
  });

  it('sorts floors that the file lists out of order', () => {
    const shuffled = { ...strc, floors: [...strc.floors].reverse() };
    expect(floorsFrom(shuffled, 1).map((f) => f.floor)).toEqual([1, 2, 3, 4]);
  });
});

describe('cutawayAt', () => {
  it('names the building, the floor and its slab for a traced floor', () => {
    expect(cutawayAt(indoor, 3)).toEqual({ building: 'strc', floor: 3, base: 6.8 });
  });

  it('is null on a floor not traced yet, so the map keeps the floor band', () => {
    expect(cutawayAt(indoor, 2)).toBeNull();
  });
});

describe('slabOutlines', () => {
  const podium: Volume = { outline: [0, 0, 20, 0, 20, 10, 0, 10], base: 0, top: 6.8 };
  const tower: Volume = { outline: [0, 0, 5, 0, 5, 5], base: 6.8, top: 20 };

  it('reads a base off by float rounding as the same height', () => {
    const lifted: Volume = { ...tower, base: 6.800000000000001 };
    expect(slabOutlines([podium, lifted], 6.8)).toEqual([lifted.outline]);
    expect(slabOutlines([{ ...podium, top: 6.799999999999999 }, tower], 6.8)).toEqual([tower.outline]);
  });

  it('keeps the outline of every volume standing at that base', () => {
    expect(slabOutlines([podium, tower], 3.4)).toEqual([podium.outline]);
    expect(slabOutlines([podium, tower], 0)).toEqual([podium.outline]);
  });

  it('includes a volume that starts exactly at the base, and drops one that ends exactly there', () => {
    expect(slabOutlines([podium, tower], 6.8)).toEqual([tower.outline]);
  });

  it('is empty above every volume', () => {
    expect(slabOutlines([podium, tower], 20)).toEqual([]);
  });
});

describe('SLAB_LIFT', () => {
  it('is above the base and below HALLWAY_LIFT, so hallways stay on top', () => {
    expect(SLAB_LIFT).toBeGreaterThan(0);
    expect(SLAB_LIFT).toBeLessThan(HALLWAY_LIFT);
  });
});

describe('buildSlab', () => {
  /** Sum of the triangles' areas seen from above, positive when they face up. */
  function areaUp(p: Float32Array) {
    let sum = 0;
    for (let t = 0; t < p.length; t += 9) {
      const [ax = 0, , az = 0, bx = 0, , bz = 0, cx = 0, , cz = 0] = Array.from(p.subarray(t, t + 9));
      sum += ((bz - az) * (cx - ax) - (bx - ax) * (cz - az)) / 2;
    }
    return sum;
  }

  it('lays a square flat at base + SLAB_LIFT as two triangles facing up', () => {
    const p = buildSlab([[0, 0, 10, 0, 10, 10, 0, 10]], 6.8);
    expect(triangles(p)).toBe(2);
    const { min, max } = bounds(p);
    expect(min[1]).toBeCloseTo(6.8 + SLAB_LIFT);
    expect(max[1]).toBeCloseTo(6.8 + SLAB_LIFT);
    expect(areaUp(p)).toBeCloseTo(100);
  });

  it('puts north at -z', () => {
    const { min, max } = bounds(buildSlab([[0, 5, 10, 5, 10, 8]], 0));
    expect(min[2]).toBeCloseTo(-8);
    expect(max[2]).toBeCloseTo(-5);
  });

  it('faces up whichever way the ring winds, and fills a concave L exactly', () => {
    const l = [0, 0, 10, 0, 10, 4, 4, 4, 4, 10, 0, 10];
    const reversed = [];
    for (let i = l.length - 2; i >= 0; i -= 2) reversed.push(l[i] ?? 0, l[i + 1] ?? 0);
    expect(areaUp(buildSlab([l], 0))).toBeCloseTo(64);
    expect(areaUp(buildSlab([reversed], 0))).toBeCloseTo(64);
  });

  it('draws one slab per outline, and nothing for none', () => {
    const square = [0, 0, 1, 0, 1, 1, 0, 1];
    expect(triangles(buildSlab([square, square.map((v) => v + 5)], 0))).toBe(4);
    expect(buildSlab([], 0).length).toBe(0);
  });
});
