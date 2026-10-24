// The spots a sheet is offering as choices, named on the map while it offers them (8▸ critique, P2 recognition):
// S4's Change spot step and Route options' door chips report them; the campus scene places each one. Types only.
import type { Spot } from './route';

export interface SpotLabel {
  readonly building: string;
  /** The floor the spot is on: 1 (G) for a door. */
  readonly floor: number;
  readonly spot: Spot;
  /** As the chip says it, capitalised: `Main entrance facing Agno`, `East stairs`. */
  readonly label: string;
}

/** What a sheet calls with its spots while they show, and with an empty list when they stop showing. */
export type OnSpotLabels = (labels: readonly SpotLabel[]) => void;
