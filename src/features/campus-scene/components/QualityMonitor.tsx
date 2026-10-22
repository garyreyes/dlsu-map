import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { nextQuality, startQuality, type QualityState, type QualityTier } from '../quality';

interface Props {
  /** The tier the canvas is drawing at now. */
  tier: QualityTier;
  /** Called only when the tier changes, never per frame. */
  onTier: (tier: QualityTier) => void;
}

/**
 * Watches how long drawn frames take and asks for a lower or higher tier (quality.ts, 10c). We don't use drei's
 * `PerformanceMonitor`: it counts frames over wall-clock time, and with `frameloop="demand"` the idle time between
 * touches would read as a low frame rate. Here an idle gap is just a long delta, which `nextQuality` ignores.
 */
export function QualityMonitor({ tier, onTier }: Props) {
  const state = useRef<QualityState>(startQuality());
  const invalidate = useThree((s) => s.invalidate);

  useFrame((_, delta) => {
    const next = nextQuality(state.current, delta * 1000);
    const changed = next.tier !== state.current.tier;
    state.current = next;
    if (changed) onTier(next.tier);
  });

  // The new pixel ratio only shows on a drawn frame, and the map may be sitting still.
  useEffect(() => {
    invalidate();
  }, [tier, invalidate]);

  return null;
}
