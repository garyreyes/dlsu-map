// Camera tunables from DESIGN.md (Elevation & Depth, Motion) and the prototype (prototypes/map-home/scene.js).
// Angles are radians unless the name says DEG.

/** Vertical field of view, degrees. */
export const FOV_DEG = 40;
export const NEAR = 5;
export const FAR = 8000;

/** Home view: about 52° from straight down. */
export const HOME_POLAR = (52 * Math.PI) / 180;
// The home heading, target and distance come from the campus data: features/campus-scene/home-view.ts.

export const MIN_DISTANCE = 90;
export const MAX_DISTANCE = 2600;
/** The lowest the camera may tilt: about 70° from straight down, so the horizon never fills the screen. */
export const MAX_POLAR = 1.22;

/** camera-controls' smoothing, in seconds. About the prototype's 650 ms camera flights and its 0.12 damping. */
export const SMOOTH_TIME = 0.2;
export const DRAGGING_SMOOTH_TIME = 0.12;

/** The compass appears once the map is turned more than this far from home. */
export const COMPASS_MIN_DEG = 4;
/** A two-finger drag the full height of the screen tilts the map this far. */
export const TILT_PER_SCREEN = Math.PI / 2;

/** A press is a tap, not a pan, if it moves at most this many CSS px and lifts within this many ms (the prototype). */
export const TAP_MAX_MOVE = 6;
export const TAP_MAX_MS = 450;
/** A selected building is seen from about 58° from straight down (DESIGN.md, Camera). */
export const SELECT_POLAR = (58 * Math.PI) / 180;
/** An outdoor step in the player is seen from higher, about 40° from straight down, so the campus's tall buildings
 *  don't stand between the camera and the spot (D44). */
export const STEP_POLAR = (40 * Math.PI) / 180;
/** Outdoor steps and the route overview (S5) look down from about 8° off vertical, the "drone" view (D61). Not 0°:
 *  straight down, camera-controls can't tell which way is up and the heading jumps. Indoor steps keep STEP_POLAR. */
export const DRONE_POLAR = (8 * Math.PI) / 180;
/** A drone step fits its stretch (the dot to the next turn or entrance) with this much air, and never shows less than
 *  this many meters each way from the dot, so a short stretch still shows the paths around it (D61). */
export const STRETCH_MARGIN = 1.15;
export const STRETCH_MIN_REACH = 40;
/** An indoor step (7▸) keeps this many meters of its floor around the spot in view: the hallway ahead and the rooms
 *  beside it, large enough to read on a phone. */
export const INDOOR_STEP_RADIUS = 22;
/** The camera may dolly in this close on an indoor step, instead of MIN_DISTANCE, so the student can look at a room. */
export const INDOOR_MIN_DISTANCE = 35;
/** An indoor step looks at the point this far above its floor's slab, meters: about the cut, below eye level. */
export const INDOOR_TARGET_HEIGHT = 1;

/** The camera follow on Next (D59): 1.2 s per 100 m of walk, never under 1 s or over 3 s. */
export const FOLLOW_MS_PER_METER = 12;
export const FOLLOW_MIN_MS = 1000;
export const FOLLOW_MAX_MS = 3000;
/** A corner turns over this share of the walk ahead of the dot, held to these meters (D59). */
export const TURN_WINDOW_SHARE = 0.2;
export const TURN_WINDOW_MIN = 8;
export const TURN_WINDOW_MAX = 60;
