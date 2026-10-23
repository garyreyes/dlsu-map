// Which floor the band and its chip show for a step inside a building. Pure: no React, no three.
import type { CampusBuilding } from '@/shared/data/campus';

/** A floor as the building's signs print it: "3F", or "G" where the building labels its ground floor so. */
export const floorLabelOf = (b: Pick<CampusBuilding, 'floorLabels'> | undefined, floor: number): string =>
  b?.floorLabels?.[String(floor)] ?? `${String(floor)}F`;

/**
 * The floor the band frames for an indoor step. While the step's own floor is cut open, that floor. When the building's
 * indoor map is still saving or its file failed (`saving`, offline only) the map can't show the step's floor, so the
 * band and chip name the floor the student is heading for, as the step text does (O5). While the file is merely loading
 * online, or the step's floor is untraced in a loaded building, the step's own floor stays. A step with no goal keeps
 * its own floor.
 */
export function bandFloorOf(
  focus: { readonly floor: number; readonly goal?: number },
  cutOn: boolean,
  saving: boolean,
): number {
  return cutOn || !saving || focus.goal === undefined || focus.goal <= 0 ? focus.floor : focus.goal;
}
