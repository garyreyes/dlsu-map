import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import { Color, type Fog } from 'three';
import type { CameraControls } from '@react-three/drei';
import { HOME_DISTANCE } from '@/shared/config/camera';
import { HAZE_FAR, HAZE_NEAR, MAP_PALETTE_A, SKY_LIGHT, SUN_LIGHT } from '@/shared/config/palette';

const palette = MAP_PALETTE_A;
const GROUND_SIZE = 20000;

/**
 * The world under the chrome (DESIGN.md, Map depth): an unlit flat ground in the palette colour, a green haze that
 * fades the distance and fills the sky, and the light rig the buildings will use in 2c.
 */
export function MapScene({ controlsRef }: { controlsRef: RefObject<CameraControls | null> }) {
  const fog = useRef<Fog>(null);
  const skyGround = useMemo(() => new Color(SKY_LIGHT.color).lerp(new Color(palette.ground), SKY_LIGHT.groundTint), []);

  // The haze tracks the camera: it starts and ends at fixed multiples of the distance to what you're looking at.
  useFrame(() => {
    if (!fog.current) return;
    const distance = controlsRef.current?.distance ?? HOME_DISTANCE;
    fog.current.near = distance * HAZE_NEAR;
    fog.current.far = distance * HAZE_FAR;
  });

  return (
    <>
      <color attach="background" args={[palette.haze]} />
      <fog ref={fog} attach="fog" args={[palette.haze, HOME_DISTANCE * HAZE_NEAR, HOME_DISTANCE * HAZE_FAR]} />
      <hemisphereLight args={[SKY_LIGHT.color, skyGround, SKY_LIGHT.intensity]} />
      <directionalLight color={SUN_LIGHT.color} intensity={SUN_LIGHT.intensity} position={[-1000, 2000, 1000]} />
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshBasicMaterial color={palette.ground} />
      </mesh>
    </>
  );
}
