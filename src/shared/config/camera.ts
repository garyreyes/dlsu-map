// Camera tunables from DESIGN.md (Elevation & Depth, Motion) and the prototype (prototypes/map-home/scene.js).
// Angles are radians unless the name says DEG.

/** Vertical field of view, degrees. */
export const FOV_DEG = 40;
export const NEAR = 5;
export const FAR = 8000;

/** Home view: about 52° from straight down. */
export const HOME_POLAR = (52 * Math.PI) / 180;
/** Home heading: the camera sits east of campus so Taft Avenue runs along the bottom of the screen. 2c works it
 *  out from the real Taft Avenue line; this is the stand-in until then. */
export const HOME_AZIMUTH = Math.PI / 2;
export const HOME_DISTANCE = 900;

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
