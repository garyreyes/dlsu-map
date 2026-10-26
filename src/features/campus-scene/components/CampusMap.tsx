import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CameraControls } from '@react-three/drei';
import type { Mesh } from 'three';
import { FloorRail, useCutaway, useIndoor, type CutawayStep } from '@/features/indoor-view';
import { MapDidntDownload } from '@/features/offline';
import { FAR, FOV_DEG, NEAR } from '@/shared/config/camera';
import { MAP_PALETTES } from '@/shared/config/palette';
import type { Campus, CampusBuilding } from '@/shared/data/campus';
import { preloadIndoor } from '@/shared/data/load';
import type { Route } from '@/shared/data/route';
import type { SpotLabel } from '@/shared/data/spot-labels';
import { useMapSettings } from '@/shared/settings/useMapSettings';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { LOADING_MAP, MapMessage } from '@/shared/ui/MapMessage';
import { useReducedMotion } from '@/shared/ui/useMediaQuery';
import { usualAzimuth } from '../flat';
import { headingDeg } from '../gestures';
import { LOW_TOP, lowCampus } from '../massing';
import { framing, homeAzimuth, mainCampusCentre } from '../home-view';
import { showsCity, TIER_DPR, type QualityTier } from '../quality';
import { SPOT_GAP, spotAnchors } from '../spot-anchors';
import { CameraRig, goHome, type HomeView, type MapInsets } from './CameraRig';
import { LabelLayer, LabelProjector, type LabelElements, type MapHere } from './Labels';
import { MapButtons } from './MapButtons';
import { MapCredit } from './MapCredit';
import { MapFailed } from './MapFailed';
import { MapScene } from './MapScene';
import { QualityMonitor } from './QualityMonitor';
import { useCameraFlights } from './useCameraFlights';
import { useCampus } from './useCampus';
import { useDotGlide } from './useDotGlide';
import { useTripMarks, type MapFloor, type MapFocus } from './useTripMarks';

export type { MapFloor, MapFocus };

/** A trip on the map (5b): the "you are here" dot and the route's line. */
export interface MapTrip {
  /** Where the student is. The same object for every route of one trip, so a new one frames the trip again, while a
   *  new route for the same trip (a route option) only redraws the line. */
  here: MapHere | null;
  /** The route, once there is one. Only its outdoor walk is drawn until the cutaway (7a, D43). */
  route: Route | null;
  /** The step the player is on (5d, D44): the dot and the camera follow it. Null on the preview. */
  focus: MapFocus | null;
  /** The step's number in its route, which goes up on Next: the camera follows the dot only going forward (D59). */
  step?: number;
  /** Buildings whose indoor map file failed only because the phone is offline (O5). */
  stillSaving?: readonly string[];
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
  /** The spots the sheet is offering as choices, named on the map while it offers them (8▸ critique, P2). */
  spotLabels: readonly SpotLabel[];
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
export function CampusMap({ insets, sheetHeight, wide, selected, floor, trip, spotLabels, onSelect }: Props) {
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
      spotLabels={spotLabels}
      onSelect={onSelect}
    />
  );
}

type Status = 'loading' | 'ready' | 'failed';

/** The indoor step the cutaway opens (7a), with what its rail needs; null on the ground. */
/** An indoor step's focus without its spot, so the camera frames the building (D46). */
function withoutSpot(focus: MapFocus | null): MapFocus | null {
  if (focus?.kind !== 'floor' || focus.at === undefined) return focus;
  return {
    kind: 'floor',
    building: focus.building,
    floor: focus.floor,
    ...(focus.goal === undefined ? {} : { goal: focus.goal }),
  };
}

const cutStep = (focus: MapFocus | null, b: CampusBuilding | undefined): CutawayStep | null =>
  focus?.kind === 'floor' && b
    ? {
        building: b.slug,
        floor: focus.floor,
        goal: focus.goal,
        levels: b.levels,
        floorLabels: b.floorLabels,
        volumes: b.volumes,
      }
    : null;

/** The route's outdoor walk as flat x, y lists, for the line and the trip's framing. */
const walkLines = (route: Route | null) =>
  (route?.legs ?? []).flatMap((l) => (l.kind === 'walk' ? [l.path.flat()] : []));

function CampusView(props: Props & { campus: Campus }) {
  const { campus, insets, sheetHeight, wide, selected, floor, trip, spotLabels, onSelect } = props;
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
  // A slow phone steps down a tier: fewer pixels, and on the lowest the city goes (quality.ts, 10c).
  const [tier, setTier] = useState<QualityTier>('high');
  const reduced = useReducedMotion();
  // The saved colour mode (D57): only the map changes, the interface stays light.
  const colour = useMapSettings((s) => s.settings.colour);
  // In 2D (D58) every building, bridge and city block is a 3 m block; the cut building's stump keeps the real campus.
  const low = useMapSettings((s) => s.settings.view) === '2d';
  const shown = useMemo(() => (low ? lowCampus(campus) : campus), [low, campus]);
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
  // The stairs and elevators among them sit where the building's file puts them; doors need no file.
  const stairsBuilding = spotLabels.find((l) => l.spot.kind === 'vertical')?.building ?? null;
  const spotFile = useIndoor(stairsBuilding);
  const stairsFile = spotFile.status === 'ready' ? spotFile.indoor : undefined;
  const spots = useMemo(
    () => spotAnchors(spotLabels, campus, (slug) => bySlug.get(slug), stairsFile),
    [spotLabels, campus, bySlug, stairsFile],
  );

  // The trip on the map: the walk's line, the "you are here" dot, and in the player the step it's on.
  const here = trip?.here ?? null;
  const focus = trip?.focus ?? null;
  const route = trip?.route ?? null;
  const lines = useMemo(() => walkLines(route), [route]);
  // Every building the route goes inside starts loading now, so stepping in never waits on its floor file (7b).
  useEffect(() => {
    if (route) preloadIndoor(route.legs.flatMap((l) => ('building' in l ? [l.building] : [])));
  }, [route]);
  const focusBuilding = focus?.kind === 'floor' ? bySlug.get(focus.building) : undefined;
  // The cut building shows the step's floor in its place, and the rail says which one it is, so the band's chip
  // stands down.
  const cut = useCutaway(cutStep(focus, focusBuilding));
  // The camera comes in close to a step's spot only once its floor is cut open: while the floor file loads, or if it
  // fails, the step frames the whole building with the band, on the floor the student is heading for (O5).
  const cutOn = cut !== null;
  // In 2D the spot plates sit on the low block's roof, unless the building is cut open on its real floor.
  const shownSpots = useMemo(
    () => (low && !cutOn ? spots.map((s) => ({ ...s, height: Math.min(s.height, LOW_TOP + SPOT_GAP) })) : spots),
    [spots, low, cutOn],
  );
  const saving = focus?.kind === 'floor' && (trip?.stillSaving ?? []).includes(focus.building);
  const { band, samples, chip, hereAt, fromBuilding } = useTripMarks(
    bySlug,
    building,
    floor,
    here,
    focus,
    cutOn,
    saving,
    low,
  );
  const flightFocus = useMemo(() => (cutOn ? focus : withoutSpot(focus)), [focus, cutOn]);
  const { placeDot, handle: glide } = useDotGlide(route, focus, reduced, {
    here: hereAt,
    step: trip?.step,
    controlsRef,
    insets,
    focus: flightFocus,
    building: focusBuilding,
  });
  useCameraFlights({
    controlsRef,
    controlsReady,
    massRef,
    insets,
    reduced,
    building,
    samples,
    here,
    fromBuilding,
    lines,
    focus: flightFocus,
    focusBuilding,
    glide,
    homeAzimuth: home.azimuth,
  });

  const recenter = () => {
    glide.pause();
    if (controlsRef.current) goHome(controlsRef.current, home, insets, !reduced);
  };
  // Turn back to the view's usual heading (home's in 3D, north up in 2D) the short way, keeping zoom and tilt (DESIGN.md,
  // Compass).
  const unturn = () => {
    const c = controlsRef.current;
    // The student has taken the camera: it stops following the dot for this step.
    glide.pause();
    if (!c) return;
    const usual = usualAzimuth(useMapSettings.getState().settings.view, home.azimuth);
    void c.rotateAzimuthTo(c.azimuthAngle - (headingDeg(c.azimuthAngle, usual) * Math.PI) / 180, !reduced);
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
          buildings={shown.buildings}
          elementsRef={elementsRef}
          selected={selected}
          chip={cut ? null : chip}
          chipRef={chipRef}
          here={hereAt !== null}
          hereRef={hereRef}
          spots={shownSpots}
        />
      )}
      <div className="fixed inset-0 touch-none" role="application" aria-label="3D map of the DLSU Manila campus">
        <ErrorBoundary fallback={<MapFailed onShow={failed} />}>
          <Canvas
            flat
            gl={{ localClippingEnabled: true }}
            frameloop="demand"
            dpr={[1, TIER_DPR[tier]]}
            camera={{ fov: FOV_DEG, near: NEAR, far: FAR }}
            onCreated={() => {
              setStatus('ready');
            }}
          >
            <QualityMonitor tier={tier} onTier={setTier} />
            <MapScene
              controlsRef={controlsRef}
              campus={shown}
              realCampus={campus}
              palette={MAP_PALETTES[colour]}
              homeAzimuth={home.azimuth}
              selected={selected}
              band={band}
              route={lines}
              cut={cut}
              fullRoute={route}
              reduced={reduced}
              city={showsCity(tier)}
              onTap={tap}
              massRef={massRef}
            />
            <CameraRig
              controlsRef={controlsRef}
              insets={insets}
              home={home}
              onAttach={onControlsAttach}
              glide={glide}
              inPlayer={focus !== null}
            />
            <LabelProjector
              buildings={shown.buildings}
              elementsRef={elementsRef}
              insets={insets}
              selected={selected}
              band={samples}
              chipRef={chipRef}
              massRef={massRef}
              here={hereAt}
              hereRef={hereRef}
              placeDot={placeDot}
              cutSlug={cut ? (focusBuilding?.slug ?? null) : null}
              spots={shownSpots}
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
          above={cut && <FloorRail rows={cut.rail} levels={cut.levels} />}
          inPlayer={focus !== null}
          top={insets.top}
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
