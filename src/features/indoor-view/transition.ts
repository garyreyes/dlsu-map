// The cut's slide (7b, D45): how the cut plane moves when the player's step goes into a building, out of it, or to
// another floor. The contract between the slide's logic and hook (indoor-view) and the scene that draws it
// (campus-scene). Types and constants only; the functions live beside the code that uses them.
import type { Plane } from 'three';
import type { Cutaway, CutawayView } from './cutaway';

/**
 * What one step change does to the cut, from the cut before (null outdoors) to the cut after:
 * - `enter`: none before, one after. The plane slides down from the roof to the floor's cut.
 * - `exit`: one before, none after. The plane slides up to the roof, then the building rejoins the campus.
 * - `floor`: same building, another floor. The plane slides from the old floor's cut to the new one's.
 * - `swap`: another building. The old one rejoins at once; the new one enters from its roof.
 * - `none`: nothing changes (both null, or the same building and floor).
 */
export type CutMove = 'enter' | 'exit' | 'floor' | 'swap' | 'none';

/** How long one slide takes, ms (PLAN §5), with the camera flight's exponential ease-out (DESIGN.md, Motion). Under
 *  reduced motion the plane jumps to the end at once. */
export const SLIDE_MS = 600;

/** One slide of the plane. */
export interface CutSlide {
  readonly move: Exclude<CutMove, 'none'>;
  /** What the map draws cut while the slide plays: the building, its stump, and the floors from `shown.cutaway.floor`
   *  up. On `exit` it's the cut being left; going up a floor it's the lower floor, so the floors in between stay
   *  drawn; otherwise the cut being entered. */
  readonly shown: CutawayView;
  /** The plane's height at the start and the end, meters (scene y). An interrupted slide starts where the plane is. */
  readonly from: number;
  readonly to: number;
}

/** What the scene draws this frame: the building split out with its stump at `cutaway`, its floors from
 *  `cutaway.floor` up, and every cut material clipped by `plane`, whose height the slide moves. */
export interface ShownCut {
  readonly view: CutawayView;
  readonly cutaway: Cutaway;
  readonly plane: Plane;
}
