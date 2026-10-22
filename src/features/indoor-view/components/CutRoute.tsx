// The route on the cut floor (8c, D46): its walk as a Campus Green line just above the slab, and the goal room as one
// green disc on a white ring at the room's label. The one green the Indoor Cut Rule allows. Clipped by the cut plane
// like the floor, so it slides with it. Never tappable.
import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, type Plane } from 'three';
import type { Indoor } from '@/shared/data/indoor';
import { CAMPUS_GREEN } from '@/shared/config/palette';
import { ribbonPositions } from '@/shared/three/ribbons';
import type { CutMarks } from '../cutaway';

const noHit = () => null;

/** Draw order: after the cut's hallways (11). */
const LINE_ORDER = 12;

/** Wider than the 1 m hallways on purpose: a green ribbon on a broad white casing stands out from the deep-green
 *  hallway fill at the indoor camera distance. */
const LINE = { width: 1.1, edge: 2.4 } as const;
/** Meters above the floor's base: over the slab and the hallways. */
const LIFT = { edge: 0.05, line: 0.07, dot: 0.09 } as const;
/** The goal mark: a hollow green ring on a wider white casing, radii in meters. Bigger than the position dot, and
 *  empty, so it reads as a destination. */
const GOAL = { inner: 1.4, outer: 2.1, casingInner: 1.1, casingOuter: 2.4, sides: 32 } as const;

function useGeometry(positions: Float32Array) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.computeBoundingSphere();
    return g;
  }, [positions]);
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  return geometry;
}

/** A flat ring of triangles around (x, y) in data coordinates: x east, y north, so the scene's z is -y. */
function ringPositions(x: number, y: number, inner: number, outer: number, height: number): Float32Array {
  const out = new Float32Array(GOAL.sides * 18);
  const at = (r: number, t: number) => [x + r * Math.cos(t), height, -(y + r * Math.sin(t))];
  for (let i = 0; i < GOAL.sides; i++) {
    const a = (i / GOAL.sides) * Math.PI * 2;
    const b = ((i + 1) / GOAL.sides) * Math.PI * 2;
    out.set(
      [...at(inner, a), ...at(outer, a), ...at(outer, b), ...at(inner, a), ...at(outer, b), ...at(inner, b)],
      i * 18,
    );
  }
  return out;
}

interface Props {
  marks: CutMarks;
  indoor: Indoor;
  /** The cut floor's slab height, meters. */
  base: number;
  plane: Plane;
}

export function CutRoute({ marks, indoor, base, plane }: Props) {
  const flat = useMemo(() => marks.lines.map((l) => l.flat()), [marks.lines]);
  const label = useMemo(
    () => (marks.goalRoom ? indoor.rooms.find((r) => r.code === marks.goalRoom)?.label : undefined),
    [marks.goalRoom, indoor],
  );
  const positions = useMemo(() => {
    const none = new Float32Array(0);
    return {
      edge: ribbonPositions(flat, LINE.edge, base + LIFT.edge),
      line: ribbonPositions(flat, LINE.width, base + LIFT.line),
      ring: label ? ringPositions(label[0], label[1], GOAL.casingInner, GOAL.casingOuter, base + LIFT.edge) : none,
      disc: label ? ringPositions(label[0], label[1], GOAL.inner, GOAL.outer, base + LIFT.dot) : none,
    };
  }, [flat, label, base]);
  const edge = useGeometry(positions.edge);
  const line = useGeometry(positions.line);
  const ring = useGeometry(positions.ring);
  const disc = useGeometry(positions.disc);
  const clip = [plane];
  return (
    <>
      {marks.lines.length > 0 && (
        <>
          <mesh geometry={edge} renderOrder={LINE_ORDER} raycast={noHit}>
            <meshBasicMaterial
              color="#ffffff"
              transparent
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-2}
              clippingPlanes={clip}
            />
          </mesh>
          <mesh geometry={line} renderOrder={LINE_ORDER + 1} raycast={noHit}>
            <meshBasicMaterial
              color={CAMPUS_GREEN}
              transparent
              polygonOffset
              polygonOffsetFactor={-3}
              clippingPlanes={clip}
            />
          </mesh>
        </>
      )}
      {label && (
        <>
          <mesh geometry={ring} renderOrder={LINE_ORDER} raycast={noHit}>
            <meshBasicMaterial
              color="#ffffff"
              transparent
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-2}
              clippingPlanes={clip}
            />
          </mesh>
          <mesh geometry={disc} renderOrder={LINE_ORDER + 1} raycast={noHit}>
            <meshBasicMaterial
              color={CAMPUS_GREEN}
              transparent
              polygonOffset
              polygonOffsetFactor={-3}
              clippingPlanes={clip}
            />
          </mesh>
        </>
      )}
    </>
  );
}
