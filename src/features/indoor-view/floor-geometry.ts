// The floor builder (6c): one floor of a building's floor file as flat arrays for three.js. Each wall line is raised
// from the floor's base to base + height as a thin box (WALL_THICKNESS), so walls read as solid from the angled
// camera and stay solid where 7a's cutaway slices them. Hallway centre lines lie flat on the floor. No React, no DOM.
// Data coordinates are meters, x east and y north, the frame of campus.json; the scene's are x east, y up and z
// south, so north is -z (as in campus-scene's massing.ts). Tests: floor-geometry.test.ts.
import { ShapeUtils, Vector2 } from 'three';
import type { Volume } from '@/shared/data/campus';
import type { Indoor, IndoorFloor } from '@/shared/data/indoor';
import { ribbonPositions } from '@/shared/three/ribbons';
import { CUT_ABOVE_FLOOR, type Cutaway } from './cutaway';

/** Wall thickness in meters. Centred on the traced line, so an outer wall stands 0.1 m outside the outline. */
export const WALL_THICKNESS = 0.2;
/** Hallway lines are drawn this wide, in meters. */
export const HALLWAY_WIDTH = 1;
/** Hallways sit this far above the floor's base so they don't flicker against a slab drawn at the base. */
export const HALLWAY_LIFT = 0.02;
/** A floor's slab sits this far above the floor's base, meters: under HALLWAY_LIFT, so hallways stay on top of it. */
export const SLAB_LIFT = 0.01;

export interface FloorGeometry {
  /** x, y, z per vertex, three vertices per triangle, each face with its own normal. */
  walls: { positions: Float32Array; normals: Float32Array };
  /** Flat triangles facing up, x, y, z per vertex. */
  hallways: Float32Array;
}

type Vec3 = readonly [number, number, number];
type Plan = readonly [number, number];

interface Buffers {
  pos: number[];
  nor: number[];
}

/** Adds a triangle facing along `n`, swapping two corners if its winding faces the other way. */
function pushTri(buf: Buffers, [a, b0, c0]: readonly [Vec3, Vec3, Vec3], n: Vec3) {
  const [ux, uy, uz] = [b0[0] - a[0], b0[1] - a[1], b0[2] - a[2]];
  const [vx, vy, vz] = [c0[0] - a[0], c0[1] - a[1], c0[2] - a[2]];
  const facing = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
  const [b, c] = facing < 0 ? [c0, b0] : [b0, c0];
  for (const v of [a, b, c]) {
    buf.pos.push(v[0], v[1], v[2]);
    buf.nor.push(n[0], n[1], n[2]);
  }
}

/** A quad from four corners in ring order, as two triangles facing along `n`. */
function pushQuad(buf: Buffers, [a, b, c, d]: readonly [Vec3, Vec3, Vec3, Vec3], n: Vec3) {
  pushTri(buf, [a, b, c], n);
  pushTri(buf, [a, c, d], n);
}

/** A plan point at height `y`, in scene coordinates. */
const at = ([x, y]: Plan, height: number): Vec3 => [x, height, -y];
/** A plan direction as a scene normal. */
const dir = ([x, y]: Plan): Vec3 => [x, 0, -y];

/** One wall segment as a box: two sides, two ends and a top. The bottom stands on the floor and is never seen. */
function addWallBox(buf: Buffers, from: Plan, to: Plan, lo: number, hi: number) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (len < 0.01) return;
  const h = WALL_THICKNESS / 2;
  const u: Plan = [(to[0] - from[0]) / len, (to[1] - from[1]) / len];
  const left: Plan = [-u[1], u[0]];
  // Each end runs on by half the thickness, so two walls meeting at a corner close it.
  const [ax, ay, bx, by] = [from[0] - u[0] * h, from[1] - u[1] * h, to[0] + u[0] * h, to[1] + u[1] * h];
  const l1: Plan = [ax + left[0] * h, ay + left[1] * h];
  const l2: Plan = [bx + left[0] * h, by + left[1] * h];
  const r1: Plan = [ax - left[0] * h, ay - left[1] * h];
  const r2: Plan = [bx - left[0] * h, by - left[1] * h];
  const side = (p: Plan, q: Plan, n: Plan) => {
    pushQuad(buf, [at(p, lo), at(q, lo), at(q, hi), at(p, hi)], dir(n));
  };
  side(l1, l2, left);
  side(r1, r2, [-left[0], -left[1]]);
  side(l2, r2, u);
  side(l1, r1, [-u[0], -u[1]]);
  pushQuad(buf, [at(l1, hi), at(l2, hi), at(r2, hi), at(r1, hi)], [0, 1, 0]);
}

/** Builds one floor: its walls raised from `base` to `base + height`, its hallways flat on the floor. */
export function buildFloor({ base, height, walls, hallways }: IndoorFloor): FloorGeometry {
  const buf: Buffers = { pos: [], nor: [] };
  for (const line of walls) {
    for (let i = 0; i + 3 < line.length; i += 2) {
      const from: Plan = [line[i] ?? 0, line[i + 1] ?? 0];
      const to: Plan = [line[i + 2] ?? 0, line[i + 3] ?? 0];
      addWallBox(buf, from, to, base, base + height);
    }
  }
  return {
    walls: { positions: new Float32Array(buf.pos), normals: new Float32Array(buf.nor) },
    hallways: ribbonPositions(hallways, HALLWAY_WIDTH, base + HALLWAY_LIFT),
  };
}

/** Heights closer than this are the same, meters: a base summed from floor heights can be off by float rounding. */
const SAME_HEIGHT = 1e-6;

/** The outlines of the volumes standing at a floor's `base`, meters above the ground: those that start at or below it
 *  and end above it. A podium and a tower each count only on the floors they have (7b). */
export const slabOutlines = (volumes: readonly Volume[], base: number): (readonly number[])[] =>
  volumes.filter((v) => v.base <= base + SAME_HEIGHT && base < v.top - SAME_HEIGHT).map((v) => v.outline);

/** Flat slab triangles for plan outlines (flat x, y pairs) at `base` + SLAB_LIFT, facing up, x, y, z per vertex. Rings
 *  may wind either way and may be concave. */
export function buildSlab(outlines: readonly (readonly number[])[], base: number): Float32Array {
  const pos: number[] = [];
  const height = base + SLAB_LIFT;
  for (const ring of outlines) {
    const points: Vector2[] = [];
    for (let i = 0; i + 1 < ring.length; i += 2) points.push(new Vector2(ring[i], ring[i + 1]));
    const corner = (k: number | undefined): Vec3 => {
      const point = points[k ?? 0];
      return at([point?.x ?? 0, point?.y ?? 0], height);
    };
    for (const [a, b, c] of ShapeUtils.triangulateShape(points, [])) {
      const [p, q, r] = [corner(a), corner(b), corner(c)];
      // Seen from above (x east, z south) the triangle must wind so this is positive; swap two corners if not.
      const up = (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]);
      for (const v of up < 0 ? [p, r, q] : [p, q, r]) pos.push(v[0], v[1], v[2]);
    }
  }
  return new Float32Array(pos);
}

/** A building's floor by its number (G = 1), or undefined when that floor isn't traced yet. */
export const floorOf = (indoor: Indoor, floor: number): IndoorFloor | undefined =>
  indoor.floors.find((f) => f.floor === floor);

/** Where the cut sits for a floor: its base + CUT_ABOVE_FLOOR, or undefined when that floor isn't traced yet. */
export function cutHeight(indoor: Indoor, floor: number): number | undefined {
  const found = floorOf(indoor, floor);
  return found && found.base + CUT_ABOVE_FLOOR;
}

/** The traced floors numbered `floor` or higher, lowest first. The cut slices them all under one plane. */
export const floorsFrom = (indoor: Indoor, floor: number): IndoorFloor[] =>
  indoor.floors.filter((f) => f.floor >= floor).sort((a, b) => a.floor - b.floor);

/** What the map is told on a step inside the building (7a), or null when that floor isn't traced yet (the map keeps
 *  the floor band, D44). */
export function cutawayAt(indoor: Indoor, floor: number): Cutaway | null {
  const found = floorOf(indoor, floor);
  return found ? { building: indoor.building, floor, base: found.base } : null;
}
