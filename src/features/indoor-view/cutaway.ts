// The cutaway's shared shapes (7a): what the map is told when the player is inside a building, and the floor rail's
// rows. The contract between campus-scene (the building split and its stump), indoor-view (the cut floors and the
// rail) and the app shell. Types and constants only; the functions live beside the code that uses them.

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
