import { useMemo } from 'react';
import type { CutawayStep, CutawayView } from '../cutaway';
import { cutawayAt } from '../floor-geometry';
import { railRows } from '../floor-rail';
import { useIndoor } from './useIndoor';

export type { CutawayStep, CutawayView };

/** The cutaway for an indoor step (7a): null outdoors, while the floor file loads, when it fails, and on a floor not
 *  traced yet, so the map keeps the floor band in every one of those cases (D44). */
export function useCutaway(step: CutawayStep | null): CutawayView | null {
  const state = useIndoor(step?.building ?? null);
  const indoor = state.status === 'ready' ? state.indoor : null;
  const floor = step?.floor;
  const levels = step?.levels;
  const labels = step?.floorLabels;
  const volumes = step?.volumes;
  return useMemo(() => {
    if (!indoor || floor === undefined || levels === undefined || !volumes) return null;
    const cutaway = cutawayAt(indoor, floor);
    if (!cutaway) return null;
    const traced = indoor.floors.map((f) => f.floor);
    const roof = Math.max(...volumes.map((v) => v.top));
    return { cutaway, indoor, rail: railRows(levels, labels, traced, floor), levels, roof, volumes };
  }, [indoor, floor, levels, labels, volumes]);
}
