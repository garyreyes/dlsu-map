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
