// The route meeting point between the lanes (docs/SPLIT.md): Lane B's router (4b, `src/features/routing/`) returns a
// RouteResult, and Lane A's route preview, steps list and player (5b–5d) show it. 4c adds step text and 8b adds
// indoor legs, both as new fields or new leg kinds, never by changing these. Costs: `src/shared/config/routing.ts`.
import type { Campus } from './campus';
import type { Rooms } from './rooms';

/** A point in `campus.json`'s frame: x is meters east, y is meters north of its origin. */
export type XY = readonly [x: number, y: number];

/** Where the student is. Set in Where are you (S4). */
export type From =
  /** "I'm outside": a gate id from `campus.json`, e.g. `'gate-2'`. */
  | { readonly kind: 'gate'; readonly gate: string }
  /** The tap flow: building, then floor (G = 1). G starts at the main entrance; other floors at the elevator lobby
   *  (PRD UC2). */
  | { readonly kind: 'building'; readonly building: string; readonly floor: number }
  /** A room code typed into From (D23). Canonical, e.g. `'AG1104'`. */
  | { readonly kind: 'room'; readonly code: string };

/** Where the student is going: a room, or a building's ground floor. */
export type To =
  { readonly kind: 'room'; readonly code: string } | { readonly kind: 'building'; readonly building: string };

/** Route options in S5. Auto takes the elevator for 3 floors or more (PRD UC3). */
export type FloorMode = 'stairs' | 'elevator' | 'auto';

/** One end of a walk: a gate, or a building's door from `campus.json`'s entrances. */
export type WalkEnd =
  | { readonly kind: 'gate'; readonly gate: string; readonly name: string; readonly at: XY }
  | {
      readonly kind: 'door';
      readonly building: string;
      readonly door: 'main' | 'side' | 'back';
      /** Which one, when a building has more than one of a kind: `to SJ Walk`. */
      readonly name?: string;
      /** False until checked on site: its step ends in "(approximate)" (O6). */
      readonly verified: boolean;
      readonly at: XY;
    };

export type Leg =
  /** Up or down inside one building. */
  | {
      readonly kind: 'floors';
      readonly building: string;
      readonly from: number;
      readonly to: number;
      readonly by: 'stairs' | 'elevator';
      readonly seconds: number;
      /** Elevator was asked for, but the building has none: S5 says "No elevator in Andrew Hall. Using stairs." */
      readonly noElevator?: true;
    }
  /** Outdoors, from a gate or door to a door. */
  | {
      readonly kind: 'walk';
      readonly from: WalkEnd;
      readonly to: WalkEnd;
      /** The line to draw on the map, first point at `from`, last at `to`. */
      readonly path: readonly XY[];
      readonly meters: number;
      readonly seconds: number;
    };

export interface Route {
  /** In order: down in the From building, the walk, up in the To building. Within one building there is only a
   *  floors leg; on the room's own floor there are no legs (indoor walking comes in 8b). */
  readonly legs: readonly Leg[];
  /** Walked, summed over the legs. Whole meters. */
  readonly meters: number;
  /** The time estimate (S5: "about 4 min"), summed over the legs. Whole seconds. */
  readonly seconds: number;
}

export type RouteResult =
  | { readonly ok: true; readonly route: Route }
  /** From and To are the same room: S4 says "You're already at ST311" and shows S9. */
  | { readonly ok: false; readonly reason: 'same-room' }
  /** A gate, building or room that isn't in the data. A bug upstream: search and S4 only offer real ones. */
  | { readonly ok: false; readonly reason: 'unknown-place' }
  /** Nothing joins them. The data build should prevent it; S5 says "We can't find a way from … yet." */
  | { readonly ok: false; readonly reason: 'no-route' };

/** The router: built once from the loaded data, then called on every Start or route-option change. Pure. */
export type Router = (from: From, to: To, mode: FloorMode) => RouteResult;
export type CreateRouter = (campus: Campus, rooms: Rooms) => Router;
