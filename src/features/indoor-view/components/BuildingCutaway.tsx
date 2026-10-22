// The 7a cut: the entered building's traced floors from the current one up, all under ONE clipping plane at the
// floor's base + CUT_ABOVE_FLOOR, so upper floors and wall tops are sliced away and low walls remain (PLAN §5).
// Drawing the floors above, not just this one, lets 7b slide the plane down from the roof. Floors below aren't drawn
// here: campus-scene draws a solid stump up to the slab. The route ribbon, labels and dot stay unclipped.
import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three';
import type { Indoor } from '@/shared/data/indoor';
import type { MapPalette } from '@/shared/config/palette';
import { cutPlane } from '@/shared/three/clipping';
import { buildFloor, cutHeight, floorsFrom } from '../floor-geometry';

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

interface Props {
  indoor: Indoor;
  /** Floor number, G = 1. The cut sits on this floor; it and the floors above are drawn. A floor not traced yet
   *  draws nothing. */
  floor: number;
  palette: MapPalette;
}

/** The traced floors from `floor` up in the campus frame, sliced at the cut: walls in the building colour,
 *  hallways as flat lines in the path colour. */
export function BuildingCutaway({ indoor, floor, palette }: Props) {
  const geometry = useMemo(() => {
    const built = floorsFrom(indoor, floor).map(buildFloor);
    return {
      walls: merged(
        built.map((b) => b.walls.positions),
        built.map((b) => b.walls.normals),
      ),
      hallways: merged(built.map((b) => b.hallways)),
    };
  }, [indoor, floor]);
  useEffect(
    () => () => {
      geometry.walls.dispose();
      geometry.hallways.dispose();
    },
    [geometry],
  );
  const height = cutHeight(indoor, floor);
  const plane = useMemo(() => (height === undefined ? undefined : cutPlane(height)), [height]);
  if (!plane) return null;
  return (
    <>
      <mesh geometry={geometry.walls} raycast={noHit}>
        {/* Both sides: the cut takes off each wall box's top, so from above its far face is what reads as thickness. */}
        <meshLambertMaterial color={palette.building} clippingPlanes={[plane]} side={DoubleSide} />
      </mesh>
      <mesh geometry={geometry.hallways} renderOrder={1} raycast={noHit}>
        <meshBasicMaterial color={palette.path} polygonOffset polygonOffsetFactor={-1} clippingPlanes={[plane]} />
      </mesh>
    </>
  );
}
