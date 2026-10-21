import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CameraControls } from '@react-three/drei';
import { MapDidntDownload } from '@/features/offline';
import { FAR, FOV_DEG, NEAR } from '@/shared/config/camera';
import { MAP_PALETTE } from '@/shared/config/palette';
import type { Campus, CampusBuilding } from '@/shared/data/campus';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { LOADING_MAP, MapMessage } from '@/shared/ui/MapMessage';
import { useReducedMotion } from '@/shared/ui/useMediaQuery';
import { headingDeg } from '../gestures';
import { framing, homeAzimuth, mainCampusCentre } from '../home-view';
import { CameraRig, goHome, goToBuilding, type HomeView, type MapInsets } from './CameraRig';
import { LabelLayer, LabelProjector, type LabelElements } from './Labels';
import { MapButtons } from './MapButtons';
import { MapCredit } from './MapCredit';
import { MapFailed } from './MapFailed';
import { MapScene } from './MapScene';
import { useCampus } from './useCampus';

interface Props {
  /** What the chrome covers, so the camera frames the rest. */
  insets: MapInsets;
  /** Phones: the sheet's visible height, so the map buttons and credit ride just above it. */
  sheetHeight: number;
  wide: boolean;
  /** The selected building's slug, owned by the app shell. */
  selected: string | null;
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
export function CampusMap({ insets, sheetHeight, wide, selected, onSelect }: Props) {
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
      onSelect={onSelect}
    />
  );
}

type Status = 'loading' | 'ready' | 'failed';

function CampusView({ campus, insets, sheetHeight, wide, selected, onSelect }: Props & { campus: Campus }) {
  const controlsRef = useRef<CameraControls | null>(null);
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
  // A new selection flies to its building. Read the insets through a ref: the sheet growing for the card must not
  // fly again, and nor must any later pan.
  const insetsRef = useRef(insets);
  useEffect(() => {
    insetsRef.current = insets;
  });
  useEffect(() => {
    const b = selected === null ? undefined : bySlug.get(selected);
    if (b && controlsRef.current) goToBuilding(controlsRef.current, b, insetsRef.current, !reduced);
  }, [selected, bySlug, reduced]);

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
      {status !== 'failed' && <LabelLayer buildings={campus.buildings} elementsRef={elementsRef} selected={selected} />}
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
              onTap={tap}
            />
            <CameraRig controlsRef={controlsRef} insets={insets} home={home} />
            <LabelProjector
              buildings={campus.buildings}
              elementsRef={elementsRef}
              insets={insets}
              selected={selected}
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
