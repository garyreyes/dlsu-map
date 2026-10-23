import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import { Color, type Fog, type Mesh } from 'three';
import type { CameraControls } from '@react-three/drei';
import { BuildingCutaway, cutMarks, useCutSlide, type CutawayView } from '@/features/indoor-view';
import type { Campus } from '@/shared/data/campus';
import type { Route } from '@/shared/data/route';
import { HAZE_FAR, HAZE_NEAR, SKY_LIGHT, SUN_LIGHT, type MapPalette } from '@/shared/config/palette';
import type { FloorBand } from '../floor-band';
import { FloorBandMesh } from './FloorBand';
import { CampusMasses, CityMasses, PathLines } from './Masses';
import { RouteLine } from './RouteLine';

const GROUND_SIZE = 20000;
/** The prototype's light values are for three.js's old lighting (before r155), where the same intensity lit π
 *  times brighter. */
const LEGACY = Math.PI;

interface Props {
  controlsRef: RefObject<CameraControls | null>;
  campus: Campus;
  palette: MapPalette;
  /** The home view's azimuth, so the sun comes from the screen's upper left at home (DESIGN.md, Map depth). */
  homeAzimuth: number;
  selected: string | null;
  /** The selected room's floor band, if a room is selected. */
  band: FloorBand | null;
  /** The route's outdoor walk as flat x, y lists; empty when there's no route on the map. */
  route: readonly (readonly number[])[];
  /** The building the player's step is inside (7a): cut open on its floor in place of the band. The cut slides in,
   *  out and between floors (7b, D45). */
  cut: CutawayView | null;
  /** The whole route, for the line and goal room on the cut floor (8c). Marked against the cut being shown, which
   *  trails `cut` during a slide. */
  fullRoute: Route | null;
  reduced: boolean;
  /** Whether the see-through city around the campus draws; the lowest quality tier drops it (10c). */
  city: boolean;
  onTap: (slug: string | null) => void;
  massRef: RefObject<Mesh | null>;
}

/**
 * The world under the chrome (DESIGN.md, Map depth): an unlit flat ground in the palette colour, a green haze that
 * fades the distance and fills the sky, the light rig, and the campus, city and paths on top.
 */
export function MapScene(props: Props) {
  const {
    controlsRef,
    campus,
    palette,
    homeAzimuth,
    selected,
    band,
    route,
    cut,
    fullRoute,
    reduced,
    city,
    onTap,
    massRef,
  } = props;
  const shown = useCutSlide(cut, reduced);
  const marks = useMemo(() => (shown ? cutMarks(fullRoute, shown.cutaway) : undefined), [fullRoute, shown]);
  const fog = useRef<Fog>(null);
  const skyGround = useMemo(
    () => new Color(SKY_LIGHT.color).lerp(new Color(palette.ground), SKY_LIGHT.groundTint),
    [palette],
  );
  // Seen from home, the screen's right runs along (cos az, -sin az) and "away" is -(sin az, cos az) on x, z. The sun
  // stands far left and away, high up.
  const sun = useMemo((): [number, number, number] => {
    const [s, c] = [Math.sin(homeAzimuth), Math.cos(homeAzimuth)];
    return [(-c - s) * 1000, 2000, (s - c) * 1000];
  }, [homeAzimuth]);

  // The haze tracks the camera: it starts and ends at fixed multiples of the distance to what you're looking at.
  useFrame(() => {
    const c = controlsRef.current;
    if (!fog.current || !c) return;
    fog.current.near = c.distance * HAZE_NEAR;
    fog.current.far = c.distance * HAZE_FAR;
  });

  return (
    <>
      <color attach="background" args={[palette.haze]} />
      <fog ref={fog} attach="fog" args={[palette.haze, 1000 * HAZE_NEAR, 1000 * HAZE_FAR]} />
      <hemisphereLight args={[SKY_LIGHT.color, skyGround, SKY_LIGHT.intensity * LEGACY]} />
      <directionalLight color={SUN_LIGHT.color} intensity={SUN_LIGHT.intensity * LEGACY} position={sun} />
      <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshBasicMaterial color={palette.ground} />
      </mesh>
      <PathLines campus={campus} palette={palette} />
      {route.length > 0 && <RouteLine lines={route} dimmed={!!shown} ground={palette.ground} />}
      <CampusMasses
        campus={campus}
        palette={palette}
        selected={selected}
        onTap={onTap}
        massRef={massRef}
        cutaway={shown?.cutaway ?? null}
      />
      {shown ? (
        <BuildingCutaway
          indoor={shown.view.indoor}
          floor={shown.cutaway.floor}
          volumes={shown.view.volumes}
          plane={shown.plane}
          palette={palette}
          marks={marks}
        />
      ) : (
        band && <FloorBandMesh band={band} />
      )}
      {city && <CityMasses campus={campus} palette={palette} />}
    </>
  );
}
