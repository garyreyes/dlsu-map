import { BoxGeometry, BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import { FADED_MATERIAL, PLAIN_MATERIAL } from '../massing';
import { insideOutlines, isFadedFace, sees } from './visibility';

/** A box centred on scene (x, 5, z), 4 wide and deep, 10 tall. */
function box(x: number, z: number) {
  const m = new Mesh(new BoxGeometry(4, 10, 4));
  m.position.set(x, 5, z);
  m.updateMatrixWorld();
  return m;
}

/** The campus outline (x, y) of a square 4 m wide centred on scene (x, z): scene z = -y. */
const square = (x: number, z: number) => [x - 2, -z - 2, x + 2, -z - 2, x + 2, -z + 2, x - 2, -z + 2];

const from = new Vector3(-20, 5, 0);
const to = new Vector3(20, 5, 0);

describe('sees', () => {
  it('is blocked by a box between the two points', () => {
    expect(sees(box(0, 0), from, to)).toBe(false);
  });

  it('is not blocked when every hit is ignored', () => {
    const outline = [square(0, 0)];
    expect(sees(box(0, 0), from, to, (hit) => insideOutlines(hit, outline))).toBe(true);
  });

  it('is not blocked when the only hits are side faces on the outline edge', () => {
    const outline = [square(0, 0)];
    expect(sees(box(0, 0), from, to, (hit) => insideOutlines(hit, outline, 0.5))).toBe(true);
  });

  it('is still blocked by a box outside the ignored outline', () => {
    const near = new BoxGeometry(4, 10, 4).translate(0, 5, 0);
    const far = new BoxGeometry(4, 10, 4).translate(10, 5, 0);
    const blockers = new Mesh(mergeGeometries([near, far]));
    blockers.updateMatrixWorld();
    const outline = [square(0, 0)];
    expect(sees(blockers, from, to, (hit) => insideOutlines(hit, outline))).toBe(false);
  });
});

describe('isFadedFace', () => {
  // Non-indexed: 6 triangles = 18 vertices. Triangles 0-1 plain, 2-3 faded, 4-5 plain.
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(54), 3));
  geometry.addGroup(0, 6, PLAIN_MATERIAL);
  geometry.addGroup(6, 6, FADED_MATERIAL);
  geometry.addGroup(12, 6, PLAIN_MATERIAL);

  it('is true for the triangles in a faded group', () => {
    expect(isFadedFace(geometry, 2)).toBe(true);
    expect(isFadedFace(geometry, 3)).toBe(true);
  });

  it('is false just before and just after the faded group', () => {
    expect(isFadedFace(geometry, 1)).toBe(false);
    expect(isFadedFace(geometry, 4)).toBe(false);
  });

  it('is false for no face', () => {
    expect(isFadedFace(geometry, undefined)).toBe(false);
  });

  it('lets a ray through a faded building to the band behind it', () => {
    // The box's 12 triangles are all faded: 36 vertices.
    const mesh = new Mesh(new BoxGeometry(4, 10, 4).toNonIndexed());
    mesh.geometry.clearGroups();
    mesh.geometry.addGroup(0, 36, FADED_MATERIAL);
    mesh.position.set(0, 5, 0);
    mesh.updateMatrixWorld();
    expect(sees(mesh, from, to)).toBe(false);
    expect(sees(mesh, from, to, (_, face) => isFadedFace(mesh.geometry, face))).toBe(true);
  });
});

describe('insideOutlines', () => {
  const outlines = [[0, 0, 10, 0, 10, 10, 0, 10]];

  it('is true for a point inside an outline', () => {
    expect(insideOutlines(new Vector3(5, 3, -5), outlines)).toBe(true);
  });

  it('is false for a point outside every outline', () => {
    expect(insideOutlines(new Vector3(15, 3, -5), outlines)).toBe(false);
  });

  it('reads scene z as minus y', () => {
    expect(insideOutlines(new Vector3(5, 0, -5), outlines)).toBe(true);
    expect(insideOutlines(new Vector3(5, 0, 5), outlines)).toBe(false);
  });

  it('counts a point exactly on an edge when given a margin', () => {
    expect(insideOutlines(new Vector3(10, 0, -5), outlines, 0.5)).toBe(true);
    expect(insideOutlines(new Vector3(0, 0, -5), outlines, 0.5)).toBe(true);
  });

  it('counts a point 0.3 m outside an edge with a 0.5 m margin', () => {
    expect(insideOutlines(new Vector3(10.3, 0, -5), outlines, 0.5)).toBe(true);
  });

  it('does not count a point 1 m outside an edge with a 0.5 m margin', () => {
    expect(insideOutlines(new Vector3(11, 0, -5), outlines, 0.5)).toBe(false);
  });

  it('checks every outline', () => {
    expect(insideOutlines(new Vector3(25, 0, -5), [...outlines, [20, 0, 30, 0, 30, 10, 20, 10]])).toBe(true);
  });
});
