import { useMemo } from 'react';
import { Vector3 } from 'three';
import { INDOOR_TARGET_HEIGHT } from '@/shared/config/camera';
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
 *  with, on a labelled floor, the spot on it and the way the walk goes from there (7▸). */
export type MapFocus =
  | {
      readonly kind: 'ground';
      readonly at: readonly [number, number];
      readonly toward: readonly [number, number] | null;
    }
  | {
      readonly kind: 'floor';
      readonly building: string;
      readonly floor: number;
      /** Where on that floor the step happens (a turn, the stairs, the room's door), when the floor is labelled (8b).
       *  Without it the map frames the whole building (7▸). */
      readonly at?: readonly [number, number];
      /** The way the student walks from `at`, so the camera faces it, as outdoors. */
      readonly toward?: readonly [number, number] | null;
      /** The floor the route's stay in this building ends on: the room's floor, or the exit floor on the way out. The
       *  floor rail marks it (7▸). */
      readonly goal?: number;
    };

/** A floor's height above the ground, meters: its slab, to within the band's 0.1 m inset. Null for a floor the building
 *  doesn't have. The indoor step's camera and dot sit on it, as the cut does. */
export function floorHeight(b: Pick<CampusBuilding, 'levels' | 'volumes'>, floor: number): number | null {
  return floorBand(b, floor)?.bottom ?? null;
}

/** The "you are here" dot for a step with a spot: that spot, a metre above the floor. Null without one, or when the
 *  building lacks the floor, and the dot falls back to the middle of the floor (herePoint). */
function spotPoint(focus: MapFocus | null, building: CampusBuilding | undefined): Vector3 | null {
  if (focus?.kind !== 'floor' || !focus.at || !building) return null;
  const base = floorHeight(building, focus.floor);
  return base === null ? null : new Vector3(focus.at[0], base + INDOOR_TARGET_HEIGHT, -focus.at[1]);
}

const labelOf = (b: CampusBuilding | undefined, floor: number) =>
  b?.floorLabels?.[String(floor)] ?? `${String(floor)}F`;

/**
 * The band, its chip and the "you are here" dot. On the preview the band is the room's floor and the dot is From.
 * In the player the dot follows the step, and an indoor step moves the band to its own building and floor (D44). On a
 * labelled floor the dot sits at the step's spot instead of the middle of the floor (7▸).
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
  const hereAt = useMemo(
    () => (dot ? (spotPoint(focus, dotBuilding) ?? herePoint(dot, dotBuilding)) : null),
    [dot, focus, dotBuilding],
  );
  const fromBuilding = here?.kind === 'floor' ? bySlug.get(here.building) : undefined;

  return { band, samples, chip, hereAt, fromBuilding, focusBuilding };
}
