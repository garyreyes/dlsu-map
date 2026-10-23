import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, GreaterDepth } from 'three';
import { CAMPUS_GREEN } from '@/shared/config/palette';
import { ribbonPositions } from '@/shared/three/ribbons';

const noHit = () => null;

/** The route's width on the ground, and the white edge each side of it, in meters: over three times a footpath, so
 *  it reads as the route, not one more path, at the whole-trip view. */
const ROUTE = { width: 5.5, edge: 1.1 } as const;
/** How strongly the route shows through a campus building that stands in front of it. */
const HIDDEN_OPACITY = 0.45;
/** How much of the route's colour shows while the player is indoors, so the ribbon doesn't swamp the entrance. */
const DIMMED_OPACITY = 0.45;

type Lines = readonly (readonly number[])[];

function useRibbon(lines: Lines, width: number, lift: number) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(ribbonPositions(lines, width, lift), 3));
    g.computeBoundingSphere();
    return g;
  }, [lines, width, lift]);
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  return geometry;
}

/** A colour faded `DIMMED_OPACITY` of the way from the ground to itself: what the ribbon would look like at that
 *  opacity over flat ground, but opaque, so its overlapping pieces never double-blend into bands. */
function fadedOver(color: string, ground: string): string {
  return `#${new Color(ground).lerp(new Color(color), DIMMED_OPACITY).getHexString()}`;
}

interface Props {
  lines: Lines;
  /** Fade the route to 45% (a building is cut open and the walk is indoors). Needs `ground`. */
  dimmed?: boolean;
  /** The ground colour the dimmed route fades into. */
  ground: string;
}

/**
 * The route's outdoor walk on the ground (5b): a Campus Green ribbon on a white edge, so it reads on the deep-green
 * ground the way the "you are here" dot's white ring does. Where a building stands in front of it, it shows faintly
 * through, so the whole way stays traceable. While a building is cut open (`dimmed`) both fade to 45% over the ground
 * and the see-through copy goes, so the 5.5 m ribbon doesn't swamp the entrance. Never tappable. `lines` are flat
 * x, y pairs in data coordinates.
 */
export function RouteLine({ lines, dimmed = false, ground }: Props) {
  const edge = useRibbon(lines, ROUTE.width + 2 * ROUTE.edge, 0.1);
  const line = useRibbon(lines, ROUTE.width, 0.1);
  const colors = useMemo(
    () => ({
      edge: dimmed ? fadedOver('#ffffff', ground) : '#ffffff',
      line: dimmed ? fadedOver(CAMPUS_GREEN, ground) : CAMPUS_GREEN,
    }),
    [dimmed, ground],
  );
  // The edge writes no depth and the green comes after it, so the two never fight over which is on top.
  return (
    <>
      <mesh geometry={edge} renderOrder={4} raycast={noHit}>
        <meshBasicMaterial color={colors.edge} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      <mesh geometry={line} renderOrder={5} raycast={noHit}>
        <meshBasicMaterial color={colors.line} polygonOffset polygonOffsetFactor={-5} />
      </mesh>
      {/* Drawn only where something nearer already is: the stretches a building hides. */}
      <mesh geometry={line} renderOrder={6} raycast={noHit} visible={!dimmed}>
        <meshBasicMaterial
          color={CAMPUS_GREEN}
          transparent
          opacity={HIDDEN_OPACITY}
          depthWrite={false}
          depthFunc={GreaterDepth}
          polygonOffset
          polygonOffsetFactor={-5}
        />
      </mesh>
    </>
  );
}
