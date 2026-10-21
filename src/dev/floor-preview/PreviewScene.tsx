import { CameraControls, Line } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { Shape, Vector2 } from 'three';
import { FloorModel } from '@/features/indoor-view';
import type { MapPalette } from '@/shared/config/palette';
import type { Campus, CampusBuilding } from '@/shared/data/campus';
import type { Indoor } from '@/shared/data/indoor';
import { entrancesOf, frameOf, outlinesAt, type Ring } from './view';

/** The OSM outline the floor was fitted to (D36), and the main-entrance pin: the two things a wrong turn shows up
 *  against. Picked to stand apart from the map palette, since this page is a tool, not the map. */
const OUTLINE = '#3ecf7a';
const SLAB = '#232b27';
const MAIN_PIN = '#fb8c00';
const SIDE_PIN = '#c9a46a';
/** The hallway line, which the map's own path colour leaves nearly invisible on the dark slab. */
const HALLWAY = '#4a9eff';

interface Props {
  campus: Campus;
  building: CampusBuilding;
  indoor: Indoor;
  floor: number;
  base: number;
  palette: MapPalette;
}

/** One floor of one building, standing in its OSM outline at its own height, with the entrances and a north arrow. */
export function PreviewScene({ campus, building, indoor, floor, base, palette }: Props) {
  const controls = useRef<CameraControls>(null);
  const frame = useMemo(() => frameOf(building), [building]);
  const outlines = useMemo(() => outlinesAt(building, base), [building, base]);
  const pins = useMemo(() => entrancesOf(campus, building.slug), [campus, building.slug]);

  // A new building: look at it from the south-east, high enough to see over the walls. A new floor only moves the
  // target up or down, keeping the angle the owner turned to.
  const framed = useRef<typeof frame>(null);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (framed.current === frame) {
      void c.moveTo(frame.cx, base, -frame.cy, true);
      return;
    }
    framed.current = frame;
    const r = frame.radius;
    void c.setLookAt(frame.cx + r, base + r * 1.3, -frame.cy + r, frame.cx, base, -frame.cy, false);
  }, [frame, base]);

  return (
    <>
      <color attach="background" args={[palette.ground]} />
      <hemisphereLight args={['#ffffff', '#3a4a42', 2.2]} />
      <directionalLight position={[-300, 600, 200]} intensity={1.6} />
      <CameraControls ref={controls} makeDefault />
      {outlines.map((ring, i) => (
        <group key={i}>
          <Slab ring={ring} y={base - 0.02} />
          <Line
            points={[...ring, ring[0] ?? [0, 0]].map(([x, y]) => [x, base + 0.05, -y])}
            color={OUTLINE}
            lineWidth={2}
          />
        </group>
      ))}
      <FloorModel indoor={indoor} floor={floor} palette={{ ...palette, path: HALLWAY }} />
      {pins.map((p, i) => (
        <mesh key={i} position={[p.x, base + 2, -p.y]}>
          <cylinderGeometry args={[0.7, 0.7, 4, 16]} />
          <meshBasicMaterial color={p.main ? MAIN_PIN : SIDE_PIN} />
        </mesh>
      ))}
      <NorthArrow x={frame.cx} z={-(frame.north + 8)} y={base} />
    </>
  );
}

function Slab({ ring, y }: { ring: Ring; y: number }) {
  const shape = useMemo(() => new Shape(ring.map(([x, y]) => new Vector2(x, y))), [ring]);
  // The shape is drawn in x, y (north); laid flat, its y becomes -z, which is north in the scene.
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={y}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color={SLAB} />
    </mesh>
  );
}

/** A white arrowhead lying flat just past the building's north edge, pointing north (-z). No text label: drei's <Html>
 *  mounts a React root per label, which StrictMode's double mount turns into console errors. */
function NorthArrow({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <mesh position={[x, y + 0.1, z]} rotation-x={-Math.PI / 2}>
      <coneGeometry args={[2.5, 7, 3]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  );
}
