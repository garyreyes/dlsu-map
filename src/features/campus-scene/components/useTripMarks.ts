import { useMemo } from 'react';
import type { CampusBuilding } from '@/shared/data/campus';
import { bandSamples, floorBand } from '../floor-band';
import { herePoint, type MapHere } from './Labels';

/** A selected room's floor: drawn as the band, labelled on the chip. */
export interface MapFloor {
  /** G = 1. */
  floor: number;
  /** As the building's signs print it: "3F", "G". */
  label: string;
}

/** The step the player is on (5d, D44): a spot on the ground and the way the walk goes from it, or a building's floor
 *  while there's no cutaway (7a). */
export type MapFocus =
  | {
      readonly kind: 'ground';
      readonly at: readonly [number, number];
      readonly toward: readonly [number, number] | null;
    }
  | { readonly kind: 'floor'; readonly building: string; readonly floor: number };

const labelOf = (b: CampusBuilding | undefined, floor: number) =>
  b?.floorLabels?.[String(floor)] ?? `${String(floor)}F`;

/**
 * The band, its chip and the "you are here" dot. On the preview the band is the room's floor and the dot is From.
 * In the player the dot follows the step, and an indoor step moves the band to its own building and floor (D44).
 */
export function useTripMarks(
  bySlug: ReadonlyMap<string, CampusBuilding>,
  building: CampusBuilding | undefined,
  floor: MapFloor | null,
  here: MapHere | null,
  focus: MapFocus | null,
) {
  const onFloor = focus?.kind === 'floor' ? focus : null;
  const focusBuilding = onFloor ? bySlug.get(onFloor.building) : undefined;
  const bandBuilding = onFloor ? focusBuilding : building;
  const bandFloor = onFloor ? onFloor.floor : (floor?.floor ?? null);
  const band = useMemo(
    () => (bandBuilding && bandFloor !== null ? floorBand(bandBuilding, bandFloor) : null),
    [bandBuilding, bandFloor],
  );
  const samples = useMemo(() => (band ? bandSamples(band) : []), [band]);
  const chip = !band ? null : onFloor ? labelOf(focusBuilding, onFloor.floor) : (floor?.label ?? null);

  const dot = useMemo((): MapHere | null => {
    if (!focus) return here;
    return focus.kind === 'ground' ? { kind: 'ground', at: focus.at } : focus;
  }, [focus, here]);
  const dotBuilding = dot?.kind === 'floor' ? bySlug.get(dot.building) : undefined;
  const hereAt = useMemo(() => (dot ? herePoint(dot, dotBuilding) : null), [dot, dotBuilding]);
  const fromBuilding = here?.kind === 'floor' ? bySlug.get(here.building) : undefined;

  return { band, samples, chip, hereAt, fromBuilding, focusBuilding };
}
