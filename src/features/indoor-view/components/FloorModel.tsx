import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import type { Indoor } from '@/shared/data/indoor';
import type { MapPalette } from '@/shared/config/palette';
import { buildFloor, floorOf } from '../floor-geometry';

function wallGeometry(positions: Float32Array, normals: Float32Array) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.computeBoundingSphere();
  return g;
}

function hallwayGeometry(positions: Float32Array) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.computeBoundingSphere();
  return g;
}

interface Props {
  indoor: Indoor;
  /** Floor number, G = 1. A floor not traced yet draws nothing. */
  floor: number;
  palette: MapPalette;
}

/**
 * One floor of a building, in the campus frame, so it sits inside the 3D building (6c): walls in the building
 * colour, hallways as flat lines in the path colour. No cutaway or floor rail yet (7a).
 */
export function FloorModel({ indoor, floor, palette }: Props) {
  const geometry = useMemo(() => {
    const found = floorOf(indoor, floor);
    if (!found) return undefined;
    const { walls, hallways } = buildFloor(found);
    return { walls: wallGeometry(walls.positions, walls.normals), hallways: hallwayGeometry(hallways) };
  }, [indoor, floor]);
  useEffect(
    () => () => {
      geometry?.walls.dispose();
      geometry?.hallways.dispose();
    },
    [geometry],
  );
  if (!geometry) return null;
  return (
    <>
      <mesh geometry={geometry.walls}>
        <meshLambertMaterial color={palette.building} />
      </mesh>
      <mesh geometry={geometry.hallways} renderOrder={1}>
        <meshBasicMaterial color={palette.path} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </>
  );
}
