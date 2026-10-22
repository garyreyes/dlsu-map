import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CameraControls } from '@react-three/drei';
import { Vector3, type Mesh } from 'three';
import { MapDidntDownload } from '@/features/offline';
import { FAR, FOV_DEG, NEAR, SELECT_POLAR } from '@/shared/config/camera';
import { MAP_PALETTE } from '@/shared/config/palette';
import type { Campus, CampusBuilding } from '@/shared/data/campus';
import type { Route } from '@/shared/data/route';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { LOADING_MAP, MapMessage } from '@/shared/ui/MapMessage';
import { useReducedMotion } from '@/shared/ui/useMediaQuery';
import { bandSamples, bestHeading, floorBand, headingCandidates, type BandSample } from '../floor-band';
import { headingDeg } from '../gestures';
import { framing, homeAzimuth, mainCampusCentre } from '../home-view';
import {
  buildingView,
  CameraRig,
  goHome,
  goToBuilding,
  tripView,
  type BuildingView,
  type HomeView,
  type MapInsets,
} from './CameraRig';
import { herePoint, LabelLayer, LabelProjector, type LabelElements, type MapHere } from './Labels';
import { MapButtons } from './MapButtons';
import { MapCredit } from './MapCredit';
import { MapFailed } from './MapFailed';
import { MapScene } from './MapScene';
import { useCampus } from './useCampus';
import { cameraAt, sees, toScene } from './visibility';

/** A selected room's floor: drawn as the band, labelled on the chip. */
export interface MapFloor {
  /** G = 1. */
  floor: number;
  /** As the building's signs print it: "3F", "G". */
  label: string;
}

/** A trip on the map (5b): the "you are here" dot and the route's line. */
export interface MapTrip {
  /** Where the student is. The same object for every route of one trip, so a new one frames the trip again, while a
   *  new route for the same trip (a route option) only redraws the line. */
  here: MapHere | null;
  /** The route, once there is one. Only its outdoor walk is drawn until the cutaway (7a, D43). */
  route: Route | null;
}

interface Props {
  /** What the chrome covers, so the camera frames the rest. */
  insets: MapInsets;
  /** Phones: the sheet's visible height, so the map buttons and credit ride just above it. */
  sheetHeight: number;
  wide: boolean;
  /** The selected building's slug, owned by the app shell. */
  selected: string | null;
  /** The selected room's floor, when the selection is a room. */
  floor: MapFloor | null;
  /** The trip, while the route preview or its steps are open. */
  trip: MapTrip | null;
  /** A tap chose a campus building, or tapped away from one (null). */
  onSelect: (building: CampusBuilding | null) => void;
}

/** Home frames every campus building, seen from Taft Avenue's side (home-view.ts). North-up if Taft is missing. */
function homeFor(campus: Campus): HomeView {
  const taft = campus.paths.filter((p) => p.kind !== 'rail' && /taft/i.test(p.name ?? '')).map((p) => p.line);
  const { centre, radius } = framing(campus.buildings.flatMap((b) => b.volumes.map((v) => v.outline)));
  return { x: centre[0], z: -centre[1], azimuth: homeAzimuth(taft, mainCampusCentre(campus.campus)) ?? 0, radius };
}

/** The full-screen 3D campus with its labels, buttons and credit. Nothing of the campus shows until all of it can. */
export function CampusMap({ insets, sheetHeight, wide, selected, floor, trip, onSelect }: Props) {
  const campusState = useCampus();
  if (campusState.status === 'failed') return <MapDidntDownload />;
  if (campusState.status === 'loading')
    return (
      <>
        <MapMessage text={LOADING_MAP} />
        <Credit sheetHeight={sheetHeight} wide={wide} />
      </>
    );
  return (
    <CampusView
      campus={campusState.campus}
      insets={insets}
      sheetHeight={sheetHeight}
      wide={wide}
      selected={selected}
      floor={floor}
      trip={trip}
      onSelect={onSelect}
    />
  );
}

/**
 * The heading nearest the student's own whose view of `view` sees the most of the band (DESIGN.md, Camera), or null
 * to keep the heading when there's no band.
 */
function bandHeading(c: CameraControls, view: BuildingView, band: readonly BandSample[], mass: Mesh | null) {
  if (band.length === 0 || !mass) return null;
  const points = band.map((p) => toScene(p));
  const from = new Vector3();
  const seen = (azimuth: number) => {
    cameraAt(view.target, azimuth, SELECT_POLAR, view.distance, from);
    return points.filter((p) => sees(mass, from, p)).length;
  };
  return bestHeading(headingCandidates(c.azimuthAngle), seen, points.length);
}

type Status = 'loading' | 'ready' | 'failed';

/** The route's outdoor walk as flat x, y lists, for the line and the trip's framing. */
const walkLines = (route: Route | null) =>
  (route?.legs ?? []).flatMap((l) => (l.kind === 'walk' ? [l.path.flat()] : []));

function CampusView(props: Props & { campus: Campus }) {
  const { campus, insets, sheetHeight, wide, selected, floor, trip, onSelect } = props;
  const controlsRef = useRef<CameraControls | null>(null);
  const massRef = useRef<Mesh>(null);
  const chipRef = useRef<HTMLElement>(null);
  const hereRef = useRef<HTMLElement>(null);
  const [controlsReady, setControlsReady] = useState(false);
  const onControlsAttach = useCallback((attached: boolean) => {
    setControlsReady(attached);
  }, []);
  const elementsRef = useRef<LabelElements>(new Map());
  const [status, setStatus] = useState<Status>('loading');
  const reduced = useReducedMotion();
  const home = useMemo(() => homeFor(campus), [campus]);
  const failed = useCallback(() => {
    setStatus('failed');
  }, []);

  const bySlug = useMemo(() => new Map(campus.buildings.map((b) => [b.slug, b])), [campus]);
  const tap = useCallback(
    (slug: string | null) => {
      onSelect(slug === null ? null : (bySlug.get(slug) ?? null));
    },
    [bySlug, onSelect],
  );
  const building = selected === null ? undefined : bySlug.get(selected);
  const floorNumber = floor?.floor ?? null;
  const band = useMemo(
    () => (building && floorNumber !== null ? floorBand(building, floorNumber) : null),
    [building, floorNumber],
  );
  const samples = useMemo(() => (band ? bandSamples(band) : []), [band]);

  // A new selection, or a new floor of it, flies to its building, turning to a heading that sees the band. Read the
  // insets through a ref: the sheet growing for the card must not fly again, and nor must any later pan. A selection
  // made before the controls attached (a deep link opened while the map loads) flies once they do.
  const insetsRef = useRef(insets);
  useEffect(() => {
    insetsRef.current = insets;
  });
  useEffect(() => {
    const c = controlsRef.current;
    if (!building || !c || !controlsReady) return;
    const view = buildingView(building, insetsRef.current);
    goToBuilding(c, view, bandHeading(c, view, samples, massRef.current), !reduced);
  }, [building, samples, controlsReady, reduced]);

  // A new trip frames all of it: the walk, the From building or gate and the To building, from a heading that sees the
  // band (DESIGN.md, "You are here" dot). A route option redraws the line without flying again, so the lines are read
  // through a ref.
  const here = trip?.here ?? null;
  const route = trip?.route ?? null;
  const lines = useMemo(() => walkLines(route), [route]);
  const linesRef = useRef(lines);
  useEffect(() => {
    linesRef.current = lines;
  });
  const fromBuilding = here?.kind === 'floor' ? bySlug.get(here.building) : undefined;
  const hereAt = useMemo(() => (here ? herePoint(here, fromBuilding) : null), [here, fromBuilding]);
  useEffect(() => {
    const c = controlsRef.current;
    if (!here || !c || !controlsReady) return;
    const outlines = [
      ...linesRef.current,
      ...[fromBuilding, building].flatMap((b) => b?.volumes.map((v) => v.outline) ?? []),
      ...(here.kind === 'ground' ? [here.at] : []),
    ];
    const view = tripView(outlines, insetsRef.current);
    goToBuilding(c, view, bandHeading(c, view, samples, massRef.current), !reduced);
  }, [here, fromBuilding, building, samples, controlsReady, reduced]);

  const recenter = () => {
    if (controlsRef.current) goHome(controlsRef.current, home, insets, !reduced);
  };
  // Turn back to the home heading the short way, keeping zoom and tilt (DESIGN.md, Compass).
  const unturn = () => {
    const c = controlsRef.current;
    if (c)
      void c.rotateAzimuthTo(c.azimuthAngle - (headingDeg(c.azimuthAngle, home.azimuth) * Math.PI) / 180, !reduced);
  };

  // No Canvas `fallback`: R3F puts it inside <canvas>, where it never shows. A WebGL failure is rethrown to the
  // boundary instead, along with anything else the scene throws. `flat` turns tone mapping off, so the unlit ground
  // is exactly its palette colour (DESIGN.md, Map depth).
  return (
    <>
      {/* Mounted with the canvas, so every plate exists before the first frame places it: frames only run on demand,
          and a layer added later might wait for the next touch. */}
      {status !== 'failed' && (
        <LabelLayer
          buildings={campus.buildings}
          elementsRef={elementsRef}
          selected={selected}
          chip={band ? (floor?.label ?? null) : null}
          chipRef={chipRef}
          here={hereAt !== null}
          hereRef={hereRef}
        />
      )}
      <div className="fixed inset-0 touch-none" role="application" aria-label="3D map of the DLSU Manila campus">
        <ErrorBoundary fallback={<MapFailed onShow={failed} />}>
          <Canvas
            flat
            frameloop="demand"
            dpr={[1, 2]}
            camera={{ fov: FOV_DEG, near: NEAR, far: FAR }}
            onCreated={() => {
              setStatus('ready');
            }}
          >
            <MapScene
              controlsRef={controlsRef}
              campus={campus}
              palette={MAP_PALETTE}
              homeAzimuth={home.azimuth}
              selected={selected}
              band={band}
              route={lines}
              onTap={tap}
              massRef={massRef}
            />
            <CameraRig controlsRef={controlsRef} insets={insets} home={home} onAttach={onControlsAttach} />
            <LabelProjector
              buildings={campus.buildings}
              elementsRef={elementsRef}
              insets={insets}
              selected={selected}
              band={samples}
              chipRef={chipRef}
              massRef={massRef}
              here={hereAt}
              hereRef={hereRef}
            />
          </Canvas>
        </ErrorBoundary>
      </div>
      {status === 'loading' && <MapMessage text={LOADING_MAP} />}
      {status === 'ready' && (
        <MapButtons
          onCompass={unturn}
          onRecenter={recenter}
          bottom={wide ? 'calc(env(safe-area-inset-bottom, 0px) + 24px)' : sheetHeight + 12}
        />
      )}
      <Credit sheetHeight={sheetHeight} wide={wide} />
    </>
  );
}

function Credit({ sheetHeight, wide }: { sheetHeight: number; wide: boolean }) {
  return (
    <MapCredit
      position={
        wide
          ? { right: 'calc(var(--gutter-r) + 64px)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }
          : { left: 'var(--gutter-l)', bottom: sheetHeight + 8 }
      }
    />
  );
}
