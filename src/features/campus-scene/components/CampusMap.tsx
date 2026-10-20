import { Canvas } from '@react-three/fiber';
import { useCallback, useRef, useState } from 'react';
import type { CameraControls } from '@react-three/drei';
import { FAR, FOV_DEG, HOME_AZIMUTH, NEAR } from '@/shared/config/camera';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { LOADING_MAP, MapMessage } from '@/shared/ui/MapMessage';
import { useReducedMotion } from '@/shared/ui/useMediaQuery';
import { headingDeg } from '../gestures';
import { CameraRig, goHome, type MapInsets } from './CameraRig';
import { MapButtons } from './MapButtons';
import { MapCredit } from './MapCredit';
import { MapFailed } from './MapFailed';
import { MapScene } from './MapScene';

interface Props {
  /** What the chrome covers, so the camera frames the rest. */
  insets: MapInsets;
  /** Phones: the sheet's visible height, so the map buttons and credit ride just above it. */
  sheetHeight: number;
  wide: boolean;
}

type Status = 'loading' | 'ready' | 'failed';

/** The full-screen 3D map with its buttons and credit. Buildings arrive in 2c; 1c draws the bare ground. */
export function CampusMap({ insets, sheetHeight, wide }: Props) {
  const controlsRef = useRef<CameraControls | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const reduced = useReducedMotion();
  const failed = useCallback(() => {
    setStatus('failed');
  }, []);

  const recenter = () => {
    if (controlsRef.current) goHome(controlsRef.current, !reduced);
  };
  // Turn back to the home heading the short way, keeping zoom and tilt (DESIGN.md, Compass).
  const unturn = () => {
    const c = controlsRef.current;
    if (c)
      void c.rotateAzimuthTo(c.azimuthAngle - (headingDeg(c.azimuthAngle, HOME_AZIMUTH) * Math.PI) / 180, !reduced);
  };

  // No Canvas `fallback`: R3F puts it inside <canvas>, where it never shows. A WebGL failure is rethrown to the
  // boundary instead, along with anything else the scene throws.
  return (
    <>
      <div className="fixed inset-0 touch-none" role="application" aria-label="3D map of the DLSU Manila campus">
        <ErrorBoundary fallback={<MapFailed onShow={failed} />}>
          <Canvas
            frameloop="demand"
            dpr={[1, 2]}
            camera={{ fov: FOV_DEG, near: NEAR, far: FAR }}
            onCreated={() => {
              setStatus('ready');
            }}
          >
            <MapScene controlsRef={controlsRef} />
            <CameraRig controlsRef={controlsRef} insets={insets} />
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
      <MapCredit
        position={
          wide
            ? { right: 'calc(var(--gutter-r) + 64px)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }
            : { left: 'var(--gutter-l)', bottom: sheetHeight + 8 }
        }
      />
    </>
  );
}
