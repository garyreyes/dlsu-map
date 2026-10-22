// The massing model's geometry (DESIGN.md, Map depth; D13): each outline raised into walls and a flat roof, the
// bottom of every wall darkened so the block sits on the ground. No React, no DOM: flat arrays that become one
// BufferGeometry per group. Data coordinates are meters, x east and y north; the scene's are x east, y up and z
// south, so north is -z and the map isn't mirrored. Tests: massing.test.ts.
import { ShapeUtils, Vector2 } from 'three';

/** One extruded block, as campus.json stores it (a flat x, y outline raised from `base` to `top`). */
export interface Block {
  outline: readonly number[];
  base: number;
  top: number;
}

/** A building's blocks under one id, so a tapped triangle can be traced back to the building. */
export interface MassGroup {
  id: string;
  volumes: readonly Block[];
}

/** Triangles `first` to `first + count - 1` belong to `id`. */
export interface Owner {
  id: string;
  first: number;
  count: number;
}

export interface Massing {
  /** x, y, z per vertex, three vertices per triangle (not indexed, so every face keeps its own normal). */
  positions: Float32Array;
  normals: Float32Array;
  /** A grey shade per vertex as r, g, b, multiplied into the building colour. */
  colors: Float32Array;
  /** In triangle order, so ownerOf can search them. */
  owners: Owner[];
}

/** The wall-foot darkening (DESIGN.md): the bottom 6 m of a wall darkens to 70% and grades up to full. */
export const FOOT_HEIGHT = 6;
export const FOOT_SHADE = 0.7;

type Vec3 = readonly [number, number, number];

interface Buffers {
  pos: number[];
  nor: number[];
  col: number[];
}

/** The shade at height `y` on a wall standing on `base`. */
const shadeAt = (y: number, base: number) => FOOT_SHADE + (1 - FOOT_SHADE) * Math.min(1, (y - base) / FOOT_HEIGHT);

/** Point `i` of a flat outline, wrapping round to the start. */
function point(outline: readonly number[], i: number): [number, number] {
  const k = (i % (outline.length / 2)) * 2;
  return [outline[k] ?? 0, outline[k + 1] ?? 0];
}

/** Twice the signed area; positive when the outline runs anticlockwise (x east, y north). */
export function signedArea(outline: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < outline.length / 2; i++) {
    const [[x1, y1], [x2, y2]] = [point(outline, i), point(outline, i + 1)];
    s += x1 * y2 - x2 * y1;
  }
  return s;
}

/** Adds a triangle facing along `n`, swapping two corners if its winding faces the other way. */
function pushTri(buf: Buffers, corners: [Vec3, Vec3, Vec3], n: Vec3, shades: [number, number, number]) {
  const [a] = corners;
  const [sa] = shades;
  let [, b, c] = corners;
  let [, sb, sc] = shades;
  const [ux, uy, uz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const [vx, vy, vz] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const facing = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
  if (facing < 0) {
    [b, c] = [c, b];
    [sb, sc] = [sc, sb];
  }
  for (const [v, s] of [
    [a, sa],
    [b, sb],
    [c, sc],
  ] as const) {
    buf.pos.push(v[0], v[1], v[2]);
    buf.nor.push(n[0], n[1], n[2]);
    buf.col.push(s, s, s);
  }
}

function addWalls(buf: Buffers, { outline, base, top }: Block) {
  const anticlockwise = signedArea(outline) > 0;
  const footTop = Math.min(top, base + FOOT_HEIGHT);
  const bands = [
    [base, footTop],
    [footTop, top],
  ] as const;
  for (let i = 0; i < outline.length / 2; i++) {
    const [[x1, y1], [x2, y2]] = [point(outline, i), point(outline, i + 1)];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    // Outward in data coordinates is (dy, -dx) for an anticlockwise outline; z is -y in the scene.
    const [ox, oy] = anticlockwise ? [(y2 - y1) / len, (x1 - x2) / len] : [(y1 - y2) / len, (x2 - x1) / len];
    const normal: Vec3 = [ox, 0, -oy];
    for (const [lo, hi] of bands) {
      if (hi - lo < 0.01) continue;
      const [s0, s1] = [shadeAt(lo, base), shadeAt(hi, base)];
      pushTri(
        buf,
        [
          [x1, lo, -y1],
          [x2, lo, -y2],
          [x2, hi, -y2],
        ],
        normal,
        [s0, s0, s1],
      );
      pushTri(
        buf,
        [
          [x1, lo, -y1],
          [x2, hi, -y2],
          [x1, hi, -y1],
        ],
        normal,
        [s0, s1, s1],
      );
    }
  }
}

function addRoof(buf: Buffers, { outline, top }: Block) {
  const pts = Array.from({ length: outline.length / 2 }, (_, i) => new Vector2(...point(outline, i)));
  const corner = (k: number): Vec3 => {
    const [x, y] = point(outline, k);
    return [x, top, -y];
  };
  // triangulateShape always answers corner triples.
  for (const [a = 0, b = 0, c = 0] of ShapeUtils.triangulateShape(pts, [])) {
    pushTri(buf, [corner(a), corner(b), corner(c)], [0, 1, 0], [1, 1, 1]);
  }
}

/** Raises every group's blocks into one set of triangles, recording which triangles each group owns. */
export function buildMassing(groups: readonly MassGroup[]): Massing {
  const buf: Buffers = { pos: [], nor: [], col: [] };
  const owners: Owner[] = [];
  for (const { id, volumes } of groups) {
    const first = buf.pos.length / 9;
    for (const block of volumes) {
      addWalls(buf, block);
      addRoof(buf, block);
    }
    const count = buf.pos.length / 9 - first;
    if (count > 0) owners.push({ id, first, count });
  }
  return {
    positions: new Float32Array(buf.pos),
    normals: new Float32Array(buf.nor),
    colors: new Float32Array(buf.col),
    owners,
  };
}

/** The group a triangle belongs to (a raycast's `faceIndex`), or undefined when it belongs to none. */
export function ownerOf(owners: readonly Owner[], face: number): string | undefined {
  if (!Number.isInteger(face)) return undefined;
  let lo = 0;
  let hi = owners.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const o = owners[mid];
    if (!o) return undefined;
    if (face < o.first) hi = mid - 1;
    else if (face >= o.first + o.count) lo = mid + 1;
    else return o.id;
  }
  return undefined;
}

/** A draw group in vertices, as BufferGeometry.addGroup takes it. */
export interface DrawGroup {
  start: number;
  count: number;
  materialIndex: number;
}

/**
 * Draw groups that put the `selected` building's triangles on material 1 (the tinted one) and everything else on
 * material 0. `total` is the geometry's triangle count. No selection, or one with no triangles, is one plain group.
 */
export function selectionGroups(owners: readonly Owner[], selected: string | null, total: number): DrawGroup[] {
  const o = selected === null ? undefined : owners.find((x) => x.id === selected);
  if (!o) return [{ start: 0, count: total * 3, materialIndex: 0 }];
  const parts: DrawGroup[] = [
    { start: 0, count: o.first * 3, materialIndex: 0 },
    { start: o.first * 3, count: o.count * 3, materialIndex: 1 },
    { start: (o.first + o.count) * 3, count: (total - o.first - o.count) * 3, materialIndex: 0 },
  ];
  return parts.filter((g) => g.count > 0);
}

/** A building's blocks cut off at height `slab` (the cutaway's stump); blocks that start at or above it, or end up
 *  under 1 cm, go. */
export function stumpBlocks(volumes: readonly Block[], slab: number): Block[] {
  return volumes
    .filter((v) => v.base < slab && Math.min(v.top, slab) - v.base >= 0.01)
    .map((v) => ({ ...v, top: Math.min(v.top, slab) }));
}

/** One group per building, leaving out `without` (the cut building, drawn as a stump instead). Order is kept for the
 *  tap table. */
export function campusGroups(
  buildings: readonly { slug: string; volumes: readonly Block[] }[],
  without: string | null,
): MassGroup[] {
  return buildings.filter((b) => b.slug !== without).map((b) => ({ id: b.slug, volumes: b.volumes }));
}
