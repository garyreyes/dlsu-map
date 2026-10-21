// What P1 draws around a floor, worked out from campus.json: the outline it was fitted to, the entrance pins, where to
// put the camera, and how to name a floor. Pure. Data coordinates are meters, x east and y north; the scene's are x
// east, y up and z south (as in the floor builder).
import type { Campus, CampusBuilding } from '@/shared/data/campus';

export type Ring = [number, number][];

const pairs = (flat: readonly number[]): Ring => {
  const out: Ring = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i] ?? 0, flat[i + 1] ?? 0]);
  return out;
};

/** The outlines standing at a floor's height: the volumes a slab at `base` sits inside (an outline and its parts). */
export function outlinesAt(building: CampusBuilding, base: number): Ring[] {
  const holding = building.volumes.filter((v) => v.base <= base + 0.01 && v.top > base + 0.01);
  return (holding.length > 0 ? holding : building.volumes.slice(0, 1)).map((v) => pairs(v.outline));
}

export interface Pin {
  x: number;
  y: number;
  main: boolean;
}

/** The building's entrance pins (D31), as walk points. */
export function entrancesOf(campus: Campus, slug: string): Pin[] {
  return campus.entrances
    .filter((e) => e.building === slug)
    .map((e) => ({
      x: campus.walk.points[2 * e.point] ?? 0,
      y: campus.walk.points[2 * e.point + 1] ?? 0,
      main: e.kind === 'main',
    }));
}

/** Centre and size of the building's own outline, to aim the camera and place the north arrow. */
export function frameOf(building: CampusBuilding): { cx: number; cy: number; radius: number; north: number } {
  const ring = pairs(building.volumes[0]?.outline ?? []);
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    radius: Math.max(10, Math.hypot(maxX - minX, maxY - minY) / 2),
    north: maxY,
  };
}

/** The floor's name as its signs print it ("G"), else "2F". */
export const floorName = (building: CampusBuilding, floor: number): string =>
  building.floorLabels?.[String(floor)] ?? `${String(floor)}F`;
