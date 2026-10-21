import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import { CAMPUS_GREEN } from '@/shared/config/palette';
import type { FloorBand } from '../floor-band';
import { buildMassing } from '../massing';

const noHit = () => null;

/**
 * The found room's floor as a solid Campus Green band (DESIGN.md, Floor band): each outline raised from the band's
 * bottom to its top. Unlit, so it reads as one flat colour on every side; never tappable, so a tap on it picks the
 * building behind.
 */
export function FloorBandMesh({ band }: { band: FloorBand }) {
  const geometry = useMemo(() => {
    const m = buildMassing([
      { id: 'band', volumes: band.outlines.map((outline) => ({ outline, base: band.bottom, top: band.top })) },
    ]);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(m.positions, 3));
    g.computeBoundingSphere();
    return g;
  }, [band]);
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  return (
    <mesh geometry={geometry} raycast={noHit}>
      <meshBasicMaterial color={CAMPUS_GREEN} />
    </mesh>
  );
}
