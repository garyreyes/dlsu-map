// The route meeting point between the lanes (docs/SPLIT.md): Lane B's router (4b, `src/features/routing/`) returns a
// RouteResult, and Lane A's route preview, steps list and player (5b–5d) show it. 4c added `steps`; 8b adds indoor
// legs and steps, both as new fields or new kinds, never by changing these (D41); 8c-2 adds From's spot and the door
// choice the same way. Costs: `src/shared/config/routing.ts`.
import type { Campus } from './campus.ts';
import type { Indoor } from './indoor.ts';
import type { Rooms } from './rooms.ts';

/** A point in `campus.json`'s frame: x is meters east, y is meters north of its origin. */
export type XY = readonly [x: number, y: number];

/** Where the student is. Set in Where are you (S4). */
export type From =
  /** "I'm outside": a gate id from `campus.json`, e.g. `'gate-2'`. */
  | { readonly kind: 'gate'; readonly gate: string }
  /** The tap flow: building, then floor (G = 1). G starts at the main entrance; other floors at the elevator lobby
   *  (PRD UC2), unless S4's Change spot sets `spot` (D42, 8c-2). */
  | { readonly kind: 'building'; readonly building: string; readonly floor: number; readonly spot?: Spot }
  /** A room code typed into From (D23). Canonical, e.g. `'AG1104'`. */
  | { readonly kind: 'room'; readonly code: string };

/** Change spot (D42, 8c-2): where on From's floor the student stands, instead of the default. S4 offers only spots
 *  the data has, so one the router can't find is a bug upstream and gives `unknown-place`. */
export type Spot =
  /** At one of the building's doors, on G only. By its index in `campus.json`'s `entrances`. Needs no building file:
   *  the walk starts at that door. */
  | { readonly kind: 'entrance'; readonly entrance: number }
  /** At a stairs or an elevator on From's floor, by its id in the building file (`east-stairs`). Without the file,
   *  the trip is routed as before 8b and the building is named in `Route.noIndoorMap`. */
  | { readonly kind: 'vertical'; readonly id: string };

/** Where the student is going: a room, or a building's ground floor. */
export type To =
  { readonly kind: 'room'; readonly code: string } | { readonly kind: 'building'; readonly building: string };

/** Route options in S5. Auto takes the elevator for 3 floors or more (PRD UC3). */
export type FloorMode = 'stairs' | 'elevator' | 'auto';

/** Route options' door choice (D43, 8c-2), by index in `campus.json`'s `entrances`. Left out, the router picks: the
 *  main entrance from G, else the quickest door (D34). A door that isn't the right building's gives `unknown-place`.
 *  Only a trip that walks outdoors uses them. */
export interface Doors {
  /** Leave From's building by this door. Ignored when From's spot is an entrance: the student is at that door. */
  readonly exit?: number;
  /** Enter To's building by this door. In the contract now; no picker yet. */
  readonly entrance?: number;
}

/** One end of a walk: a gate, or a building's door from `campus.json`'s entrances. */
export type WalkEnd =
  | { readonly kind: 'gate'; readonly gate: string; readonly name: string; readonly at: XY }
  | {
      readonly kind: 'door';
      readonly building: string;
      readonly door: 'main' | 'side' | 'back';
      /** Which one, when a building has more than one of a kind: `to SJ Walk`. */
      readonly name?: string;
      /** Its index in `campus.json`'s `entrances`, so Route options can show which door the route took (8c-2). */
      readonly entrance?: number;
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
      /** Which stairs or elevator, by its id in the building file (`east-stairs`), and where it is. Only on labelled
       *  floors (8b); without them the route doesn't know which one. */
      readonly via?: string;
      readonly at?: XY;
    }
  /** Walking on one labelled floor (8b): from a door, a room or a stairs to the next of these. One per floor walked. */
  | {
      readonly kind: 'indoor';
      readonly building: string;
      readonly floor: number;
      /** The line to draw on that floor, in the same frame as the walk. First point where the walking starts. */
      readonly path: readonly XY[];
      readonly meters: number;
      readonly seconds: number;
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

/** A turn's side and size (PLAN §6.3): slight 30–60°, a turn 60–135°, sharp over 135°. Under 30° is straight on, which
 *  is never a step. */
export type Turn = 'slight-left' | 'left' | 'sharp-left' | 'slight-right' | 'right' | 'sharp-right';

interface StepBase {
  /** One line for the step card (S6) and the list (S8, S11): "Turn left onto SJ Walk". No distance; that's `meters`.
   *  Ends with "(approximate)" when the door isn't checked yet (O6). */
  readonly text: string;
  /** Which of `Route.legs` the step belongs to. */
  readonly leg: number;
}

/** Where a walk step happens, and how far to walk after it. */
interface WalkStepBase extends StepBase {
  /** Where the camera looks: the gate or door, the turn, the curb. */
  readonly at: XY;
  /** To the next step, rounded for showing: to 5 m under 100 m, to 10 m from there (D35). 0 when the next step is on
   *  the same spot, as when a gate sits on the curb of a crossing. */
  readonly meters: number;
}

/** The directions (4c, D35), in order. A step is where the student has a choice: a turn at a junction, a crossing, a
 *  door, a floor change. Bends with no other way to go aren't steps. */
export type Step =
  /** "Start at Gate 1 (South)", "Leave Velasco by the main entrance (approximate)". */
  | (WalkStepBase & { readonly kind: 'start'; readonly approximate?: true })
  /** "Turn left onto SJ Walk", "Bear right onto the covered walk", "Turn sharp left at Velasco", "Turn right". */
  | (WalkStepBase & { readonly kind: 'turn'; readonly turn: Turn })
  /** "Cross Taft Avenue at the crosswalk". `at` is the curb it starts from. */
  | (WalkStepBase & { readonly kind: 'cross'; readonly street: string })
  /** "Enter STRC by the main entrance (approximate)". The last step of a walk. `meters` is the walk inside to the next
   *  step, when the floor is labelled (8b). */
  | (StepBase & {
      readonly kind: 'enter';
      readonly building: string;
      readonly at: XY;
      readonly approximate?: true;
      readonly meters?: number;
    })
  /** "Take the elevator down to G", "ST311 is on 3F: take the stairs up to 3F". Matches its floors leg. On labelled
   *  floors (8b) it names which one, "Take the east stairs up to 3F", with where it is and the walk after it. */
  | (StepBase & {
      readonly kind: 'floors';
      readonly building: string;
      readonly to: number;
      readonly by: 'stairs' | 'elevator';
      readonly at?: XY;
      readonly meters?: number;
    })
  /** "ST311 is on your left": the last step of a route to a room on a labelled floor (8b). `at` is its door. Which
   *  side is worked out from the way the student walks up to the door; `ahead` when it's at the end of the hallway. */
  | (StepBase & {
      readonly kind: 'arrive';
      readonly code: string;
      readonly side: 'left' | 'right' | 'ahead';
      readonly at: XY;
    });

export interface Route {
  /** In order: down in the From building, the walk, up in the To building. In a building with labelled floors (8b)
   *  the floors legs sit between indoor legs: [indoor 3F, floors 3→1, indoor G, walk, indoor G, floors 1→4, indoor
   *  4F]. Without them, within one building there is only a floors leg, and none on the room's own floor. Indoor steps
   *  (start, turn) use the step kinds above; their `leg` points at an indoor leg. */
  readonly legs: readonly Leg[];
  /** The directions over all the legs. Empty when there are no legs. */
  readonly steps: readonly Step[];
  /** Walked, summed over the legs. Whole meters. */
  readonly meters: number;
  /** The time estimate (S5: "about 4 min"), summed over the legs. Whole seconds. */
  readonly seconds: number;
  /** Buildings where the route needed to go inside but had no labelled floor plan (no file passed, or the floor isn't
   *  labelled), so it stops at the door or has floors legs only. S9 says "ST311 is on 3F · indoor map coming" (O5). */
  readonly noIndoorMap?: readonly string[];
}

export type RouteResult =
  | { readonly ok: true; readonly route: Route }
  /** From and To are the same room: S4 says "You're already at ST311" and shows S9. */
  | { readonly ok: false; readonly reason: 'same-room' }
  /** A gate, building or room that isn't in the data. A bug upstream: search and S4 only offer real ones. */
  | { readonly ok: false; readonly reason: 'unknown-place' }
  /** Nothing joins them. The data build should prevent it; S5 says "We can't find a way from … yet." */
  | { readonly ok: false; readonly reason: 'no-route' };

/** The building files a trip can use, by slug (D41): the From and To buildings' `loadIndoor` results that loaded.
 *  A building left out (no file yet, or it failed) is routed as before 8b, and named in `Route.noIndoorMap`. */
export type IndoorFiles = ReadonlyMap<string, Indoor>;

/** The router: built once from the loaded data, then called on every Start or route-option change. Pure. `indoor`
 *  can differ call to call; the router keeps what it builds from each file for as long as that file object lives.
 *  `doors` came in 8c-2, last so that every earlier call still means the same. */
export type Router = (from: From, to: To, mode: FloorMode, indoor?: IndoorFiles, doors?: Doors) => RouteResult;
export type CreateRouter = (campus: Campus, rooms: Rooms) => Router;
