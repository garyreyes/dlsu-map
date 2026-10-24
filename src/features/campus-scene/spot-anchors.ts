// Where the spots a sheet is offering are named on the map (8▸ critique, P2): a door on its walk point on the ground,
// a stairs or elevator on its stop in the building file, at that floor's height. Pure: no React, no three.js. Data
// coordinates (x east, y north, meters). A spot that can't be placed is left out. Tests: spot-anchors.test.ts.
import type { Campus, CampusBuilding } from '@/shared/data/campus';
import type { Indoor } from '@/shared/data/indoor';
import type { SpotLabel } from '@/shared/data/spot-labels';
import { floorBand } from './floor-band';

/** The plate's bottom edge sits this far above the spot, in meters, so it reads as pointing at it. */
export const SPOT_GAP = 1;

export interface SpotAnchor {
  /** Unique among the label elements; starts with a dot, which no building slug does. */
  readonly id: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  /** Meters above the ground. */
  readonly height: number;
}

/** Only what placing a door reads: the walk network's points, and the entrances' points into them. */
interface Frame {
  readonly walk: Pick<Campus['walk'], 'points'>;
  readonly entrances: readonly Pick<Campus['entrances'][number], 'point'>[];
}

const pointAt = (flat: readonly number[], i: number): [number, number] | null => {
  const [x, y] = [flat[i * 2], flat[i * 2 + 1]];
  return x === undefined || y === undefined ? null : [x, y];
};

/** One anchor per label that can be placed. `indoor` is the file of the labels' building, once loaded. */
export function spotAnchors(
  labels: readonly SpotLabel[],
  campus: Frame,
  buildingOf: (slug: string) => Pick<CampusBuilding, 'levels' | 'volumes'> | undefined,
  indoor: Indoor | undefined,
): SpotAnchor[] {
  return labels.flatMap((l): SpotAnchor[] => {
    const { spot } = l;
    if (spot.kind === 'entrance') {
      const e = campus.entrances[spot.entrance];
      const at = e && pointAt(campus.walk.points, e.point);
      return at
        ? [{ id: `.spot:${l.building}:e${String(spot.entrance)}`, text: l.label, x: at[0], y: at[1], height: SPOT_GAP }]
        : [];
    }
    const stop =
      indoor?.building === l.building
        ? indoor.verticals.find((v) => v.id === spot.id)?.stops.find((s) => s.floor === l.floor)
        : undefined;
    const at = stop && indoor && pointAt(indoor.graph.points, stop.point);
    const b = buildingOf(l.building);
    const base = b && floorBand(b, l.floor)?.bottom;
    if (!at || base === undefined) return [];
    return [{ id: `.spot:${l.building}:v-${spot.id}`, text: l.label, x: at[0], y: at[1], height: base + SPOT_GAP }];
  });
}
