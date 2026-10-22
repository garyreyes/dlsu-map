import { useMemo } from 'react';
import type { Indoor } from '@/shared/data/indoor';
import type { Cutaway, RailRow } from '../cutaway';
import { cutawayAt } from '../floor-geometry';
import { railRows } from '../floor-rail';
import { useIndoor } from './useIndoor';

/** The building a step is inside, with what its rail needs from campus.json. */
export interface CutawayStep {
  readonly building: string;
  readonly floor: number;
  readonly levels: number;
  readonly floorLabels?: Readonly<Record<string, string>> | undefined;
}

export interface CutawayView {
  cutaway: Cutaway;
  indoor: Indoor;
  rail: RailRow[];
  /** The building's floor count, for the rail's spoken "3 of 4". */
  levels: number;
}

/** The cutaway for an indoor step (7a): null outdoors, while the floor file loads, when it fails, and on a floor not
 *  traced yet, so the map keeps the floor band in every one of those cases (D44). */
export function useCutaway(step: CutawayStep | null): CutawayView | null {
  const state = useIndoor(step?.building ?? null);
  const indoor = state.status === 'ready' ? state.indoor : null;
  const floor = step?.floor;
  const levels = step?.levels;
  const labels = step?.floorLabels;
  return useMemo(() => {
    if (!indoor || floor === undefined || levels === undefined) return null;
    const cutaway = cutawayAt(indoor, floor);
    if (!cutaway) return null;
    const traced = indoor.floors.map((f) => f.floor);
    return { cutaway, indoor, rail: railRows(levels, labels, traced, floor), levels };
  }, [indoor, floor, levels, labels]);
}
