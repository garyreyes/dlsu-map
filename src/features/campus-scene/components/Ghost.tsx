import { useEffect, useMemo } from 'react';
import { LessEqualDepth, MeshBasicMaterial, MeshLambertMaterial, type BufferGeometry } from 'three';
import { CAMPUS_FADED_OPACITY } from '@/shared/config/palette';

/**
 * Draw orders of the ghost pair (D60). Both go in the transparent list, so they come after every opaque thing on the
 * map whatever their order. The city (5), the route's hidden copy (6) and the cut floor and its route (10 to 13) draw
 * before them, so the prepass hides none of those and the colour pass lays its film over them. The goal pin (20,
 * indoor-view) draws after, so it stays on top.
 */
export const GHOST_PREPASS_ORDER = 15;
export const GHOST_COLOUR_ORDER = 16;

const noHit = () => null;

interface GhostProps {
  geometry: BufferGeometry;
  /** The campus building colour: no ground tint, so a faded building reads apart from the 35% city. */
  color: string;
  /** True when the geometry's draw groups pick the faded triangles (the campus mesh, material 2); false when the whole
   *  geometry is the ghost (the bridges). */
  grouped?: boolean;
}

/**
 * A "ghost" of a geometry (D60): it shows only the near side of what it draws. A depth-only prepass keeps just the
 * nearest surface of every faded building at each pixel (its own back walls, and any faded building behind it, fail
 * the depth test), then the colour pass lays 40% of that surface over whatever is behind it. The route line, the
 * ground and the cut floor show clearly through. Never tappable: the campus mesh keeps those triangles for taps.
 */
export function Ghost({ geometry, color, grouped = false }: GhostProps) {
  const { hidden, prepass, film } = useMemo(
    () => ({
      hidden: new MeshBasicMaterial({ visible: false }),
      // Pushed a hair back, so the film (another shader) always passes its depth test, even on phones whose GPUs
      // round the two programs' positions differently.
      prepass: new MeshBasicMaterial({
        colorWrite: false,
        transparent: true,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
      film: new MeshLambertMaterial({
        vertexColors: true,
        color,
        transparent: true,
        opacity: CAMPUS_FADED_OPACITY,
        depthWrite: false,
        depthFunc: LessEqualDepth,
      }),
    }),
    [color],
  );
  // The campus mesh's groups pick material 2; the other two stay undrawn.
  const prepassSet = useMemo(() => (grouped ? [hidden, hidden, prepass] : prepass), [grouped, hidden, prepass]);
  const filmSet = useMemo(() => (grouped ? [hidden, hidden, film] : film), [grouped, hidden, film]);
  useEffect(
    () => () => {
      hidden.dispose();
      prepass.dispose();
      film.dispose();
    },
    [hidden, prepass, film],
  );
  return (
    <>
      <mesh geometry={geometry} material={prepassSet} renderOrder={GHOST_PREPASS_ORDER} raycast={noHit} />
      <mesh geometry={geometry} material={filmSet} renderOrder={GHOST_COLOUR_ORDER} raycast={noHit} />
    </>
  );
}
