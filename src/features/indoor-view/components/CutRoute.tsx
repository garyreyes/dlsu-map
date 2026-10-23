// The route on the cut floor (8c, D46): its walk as a 1.6 m Campus Green line on a white casing just above the slab,
// and the goal room marked by a label pin with its code at its door (GoalPin; the floor files carry no room outlines
// yet, so the room itself can't be tinted). Hallways are a neutral tone, so the route and the pin are the only green
// on the cut floor (the One Green Rule). Clipped by the cut plane like the floor, so it slides with it.
// Never tappable.
import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, type Plane } from 'three';
import type { Indoor } from '@/shared/data/indoor';
import { CAMPUS_GREEN } from '@/shared/config/palette';
import { ribbonPositions } from '@/shared/three/ribbons';
import type { CutMarks } from '../cutaway';
import { doorOf } from '../marks';
import { GoalPin } from './GoalPin';

const noHit = () => null;

/** Draw order: after the cut's hallways (11). */
const LINE_ORDER = 12;

/** Wider than the 1 m hallways on purpose: a green line on a white casing stands out from the neutral hallway fill
 *  at the indoor camera distance. */
const LINE = { width: 1.6, edge: 2.9 } as const;
/** Meters above the floor's base: over the slab and the hallways. */
const LIFT = { edge: 0.05, line: 0.07 } as const;
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

interface Props {
  marks: CutMarks;
  indoor: Indoor;
  /** The cut floor's slab height, meters. */
  base: number;
  plane: Plane;
}

export function CutRoute({ marks, indoor, base, plane }: Props) {
  const flat = useMemo(() => marks.lines.map((l) => l.flat()), [marks.lines]);
  const goal = useMemo(() => {
    const room = marks.goalRoom ? indoor.rooms.find((r) => r.code === marks.goalRoom) : undefined;
    return room ? { code: room.code, at: doorOf(indoor, room, marks.lines.at(-1)?.at(-1)) } : undefined;
  }, [marks, indoor]);
  const positions = useMemo(
    () => ({
      edge: ribbonPositions(flat, LINE.edge, base + LIFT.edge),
      line: ribbonPositions(flat, LINE.width, base + LIFT.line),
    }),
    [flat, base],
  );
  const edge = useGeometry(positions.edge);
  const line = useGeometry(positions.line);
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
      {goal && <GoalPin code={goal.code} at={goal.at} base={base} plane={plane} />}
    </>
  );
}
