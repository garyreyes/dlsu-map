// The 7a cut: the entered building's traced floors from the current one up, all under ONE clipping plane that sits at
// the floor's base + CUT_ABOVE_FLOOR, so upper floors and wall tops are sliced away and low walls remain (PLAN §5).
// 7b slides the plane (useCutSlide), so the floors above are drawn for it to pass through. Floors below aren't drawn
// here: campus-scene draws a solid stump up to the slab. The route ribbon, labels and dot stay unclipped.
import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide, type Plane } from 'three';
import type { Volume } from '@/shared/data/campus';
import type { Indoor } from '@/shared/data/indoor';
import { cutTones, type MapPalette } from '@/shared/config/palette';
import type { CutMarks } from '../cutaway';
import { CutRoute } from './CutRoute';
import { buildFloor, buildSlab, floorOf, floorsFrom, slabOutlines } from '../floor-geometry';

/** Draw order of the cut: after the city blocks (CITY_ORDER in campus-scene is 5). */
const CUT_ORDER = 10;

/** Taps pass through the cut floors to whatever is behind them. */
const noHit = () => null;

/** One geometry from the pieces of every floor, laid end to end. */
function merged(parts: Float32Array[], normals?: Float32Array[]) {
  const join = (chunks: Float32Array[]) => {
    const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  };
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(join(parts), 3));
  if (normals) g.setAttribute('normal', new BufferAttribute(join(normals), 3));
  g.computeBoundingSphere();
  return g;
}

/** Straight-up normals for flat triangles, so the lit slab reads in the building colour. */
const upNormals = (positions: Float32Array) => new Float32Array(positions.length).map((_, i) => (i % 3 === 1 ? 1 : 0));

interface Props {
  indoor: Indoor;
  /** Floor number, G = 1. The cut slides to this floor; it and the floors above are drawn. A floor not traced yet
   *  draws nothing. */
  floor: number;
  /** The building's volumes from campus.json: each drawn floor gets a slab of every volume standing at its base. */
  volumes: readonly Volume[];
  /** The cut plane, moved by `useCutSlide`. Every material here is clipped by it. */
  plane: Plane;
  palette: MapPalette;
  /** The route's line and goal room on the cut floor (8c). Omitted: nothing is drawn for the route. */
  marks?: CutMarks;
}

/** The traced floors from `floor` up in the campus frame, sliced at the cut: walls in the building colour, a slab
 *  under each floor so the ground doesn't show through its rooms, hallways as flat lines in the path colour. */
export function BuildingCutaway({ indoor, floor, volumes, plane, palette, marks }: Props) {
  const geometry = useMemo(() => {
    const floors = floorsFrom(indoor, floor);
    const built = floors.map(buildFloor);
    const slabs = floors.map((f) => buildSlab(slabOutlines(volumes, f.base), f.base));
    return {
      walls: merged(
        built.map((b) => b.walls.positions),
        built.map((b) => b.walls.normals),
      ),
      hallways: merged(built.map((b) => b.hallways)),
      slabs: merged(slabs, slabs.map(upNormals)),
    };
  }, [indoor, floor, volumes]);
  useEffect(
    () => () => {
      geometry.walls.dispose();
      geometry.hallways.dispose();
      geometry.slabs.dispose();
    },
    [geometry],
  );
  const tones = useMemo(() => cutTones(palette), [palette]);
  // `transparent` (at full opacity) only moves these into the pass after the opaque ones, and renderOrder puts them
  // after the see-through city blocks (renderOrder 5), so no block's film washes over the cut.
  return (
    <>
      <mesh geometry={geometry.slabs} renderOrder={CUT_ORDER} raycast={noHit}>
        <meshLambertMaterial color={tones.slab} transparent clippingPlanes={[plane]} />
      </mesh>
      <mesh geometry={geometry.walls} renderOrder={CUT_ORDER} raycast={noHit}>
        {/* Both sides: the cut takes off each wall box's top, so from above its far face is what reads as thickness. */}
        <meshLambertMaterial color={tones.wall} transparent clippingPlanes={[plane]} side={DoubleSide} />
      </mesh>
      <mesh geometry={geometry.hallways} renderOrder={CUT_ORDER + 1} raycast={noHit}>
        <meshBasicMaterial
          color={tones.hall}
          transparent
          polygonOffset
          polygonOffsetFactor={-1}
          clippingPlanes={[plane]}
        />
      </mesh>
      {marks && <CutRoute marks={marks} indoor={indoor} base={floorOf(indoor, floor)?.base ?? 0} plane={plane} />}
    </>
  );
}
