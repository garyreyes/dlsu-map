// The cutaway's shared shapes (7a): what the map is told when the player is inside a building, and the floor rail's
// rows. The contract between campus-scene (the building split and its stump), indoor-view (the cut floors and the
// rail) and the app shell. Types and constants only; the functions live beside the code that uses them.
import type { Volume } from '@/shared/data/campus';
import type { Indoor } from '@/shared/data/indoor';

/** The building the player's step is inside and the floor its cut sits on. Null outdoors, and on a floor that
 *  isn't traced yet, where the map keeps the floor band instead (D44). */
export interface Cutaway {
  /** Building slug, as in campus.json. */
  readonly building: string;
  /** Floor number, G = 1. Always a traced floor of that building's floor file. */
  readonly floor: number;
  /** The floor's slab height above the ground, meters (its `base` in the floor file). The stump stops here. */
  readonly base: number;
}

/** The cut sits this far above the floor's slab, meters (PLAN §5, "dollhouse slice"): below eye level, so the
 *  rooms read as a plan with low walls. */
export const CUT_ABOVE_FLOOR = 1.2;

/** At most this many rows in the floor rail, gaps included. A taller building shows a window around its floor. */
export const RAIL_ROWS = 9;

/** One row of the floor rail, top to bottom. */
export type RailRow =
  | {
      readonly kind: 'floor';
      readonly floor: number;
      /** The sign's label: `floorLabels[floor]`, else "3F". */
      readonly label: string;
      /** False until that floor has a floor file; drawn muted. */
      readonly traced: boolean;
      /** The step's floor. Exactly one row has it. */
      readonly current: boolean;
    }
  /** Floors left out between two rows of a tall building. */
  | { readonly kind: 'gap' };

/** The building a step is inside, with what the rail and the slide need from campus.json. */
export interface CutawayStep {
  readonly building: string;
  readonly floor: number;
  readonly levels: number;
  readonly floorLabels?: Readonly<Record<string, string>> | undefined;
  /** The building's volumes from campus.json: the roof the slide starts from is their highest `top`, and a floor's
   *  slab is the outline of every volume standing at that floor's `base` (7b). */
  readonly volumes: readonly Volume[];
}

/** An indoor step the map can cut: built by `useCutaway` once the floor file is in. */
export interface CutawayView {
  readonly cutaway: Cutaway;
  readonly indoor: Indoor;
  readonly rail: RailRow[];
  /** The building's floor count, for the rail's spoken "3 of 4". */
  readonly levels: number;
  /** The building's highest `top`, meters: where the cut starts on the way in and ends on the way out (7b). */
  readonly roof: number;
  readonly volumes: readonly Volume[];
}
