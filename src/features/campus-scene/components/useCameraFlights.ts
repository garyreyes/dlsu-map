import { useEffect, useRef, type RefObject } from 'react';
import type { CameraControls } from '@react-three/drei';
import { Vector3, type Mesh } from 'three';
import { SELECT_POLAR, STEP_POLAR } from '@/shared/config/camera';
import type { CampusBuilding } from '@/shared/data/campus';
import { bestHeading, headingCandidates, type BandSample } from '../floor-band';
import type { Lens } from '../follow';
import { facingAzimuth } from '../gestures';
import {
  buildingView,
  goToBuilding,
  indoorStepView,
  limitDolly,
  stepView,
  tripView,
  type BuildingView,
  type MapInsets,
} from './CameraRig';
import type { MapHere } from './Labels';
import type { GlideShare } from './useCameraFollow';
import { floorHeight, type MapFocus } from './useTripMarks';
import { cameraAt, insideOutlines, sees, toScene } from './visibility';

/**
 * The heading nearest the student's own whose view of `view` sees the most of the band (DESIGN.md, Camera), or null
 * to keep the heading when there's no band.
 */
function bandHeading(
  c: CameraControls,
  view: BuildingView,
  band: readonly BandSample[],
  mass: Mesh | null,
  polar = SELECT_POLAR,
  ignore?: (hit: Vector3) => boolean,
) {
  if (band.length === 0 || !mass) return null;
  const points = band.map((p) => toScene(p));
  const from = new Vector3();
  const seen = (azimuth: number) => {
    cameraAt(view.target, azimuth, polar, view.distance, from);
    return points.filter((p) => sees(mass, from, p, ignore)).length;
  };
  return bestHeading(headingCandidates(c.azimuthAngle), seen, points.length);
}

/** A hit this near the focus building's outline is its own wall (which sits on the outline, so inside-or-not is down
 *  to rounding), in meters. */
const WALL_MARGIN = 0.5;

interface Flights {
  controlsRef: RefObject<CameraControls | null>;
  /** The controls are attached: a flight asked for before they were waits for them. */
  controlsReady: boolean;
  /** What can hide the band from the camera. */
  massRef: RefObject<Mesh | null>;
  insets: MapInsets;
  reduced: boolean;
  /** The selected building, and the floor band's samples (empty without one): the room's floor, or in the player an
   *  indoor step's floor. */
  building: CampusBuilding | undefined;
  samples: readonly BandSample[];
  /** The trip on the map, if any: where the student is, From's building, and the walk as flat x, y lists. */
  here: MapHere | null;
  fromBuilding: CampusBuilding | undefined;
  lines: readonly (readonly number[])[];
  /** The step the player is on, and its building for an indoor step (D44). */
  focus: MapFocus | null;
  focusBuilding: CampusBuilding | undefined;
  /** The glide the camera rides on Next (D59): a step it follows is not flown to. */
  glide: RefObject<GlideShare>;
}

/**
 * Where the camera flies, always to a heading that sees the band. A new selection, or a new floor of it, flies to its
 * building. A new trip (a new `here` object) frames all of it instead: the walk, the From building or gate and the To
 * building; when the trip leaves the map (Back to the card), the building's view comes back. A route option redraws
 * the line without flying, so the lines are read through a ref, and so are the insets: the sheet growing must not fly
 * again, and nor must any later pan. In the player each step flies to its spot, facing the walk (D44). An indoor step
 * flies close to its spot on the cut floor, facing the way along the hallway, and lets the camera dolly closer (7▸);
 * one without a spot flies to its building with the band on its floor. Leaving the player frames the trip again.
 */
export function useCameraFlights(f: Flights) {
  const { controlsRef, controlsReady, massRef, reduced, building, samples, here, fromBuilding, focus, focusBuilding } =
    f;
  const { glide } = f;
  const latest = useRef({ insets: f.insets, lines: f.lines });
  useEffect(() => {
    latest.current = { insets: f.insets, lines: f.lines };
  });
  const tripOn = here !== null;
  const focused = focus !== null;

  useEffect(() => {
    const c = controlsRef.current;
    if (!building || !c || !controlsReady || tripOn) return;
    const view = buildingView(building, latest.current.insets);
    goToBuilding(c, view, bandHeading(c, view, samples, massRef.current), !reduced);
  }, [controlsRef, massRef, building, samples, controlsReady, reduced, tripOn]);

  useEffect(() => {
    const c = controlsRef.current;
    if (!here || !c || !controlsReady || focused) return;
    const outlines = [
      ...latest.current.lines,
      ...[fromBuilding, building].flatMap((b) => b?.volumes.map((v) => v.outline) ?? []),
      ...(here.kind === 'ground' ? [here.at] : []),
    ];
    const view = tripView(outlines, latest.current.insets);
    goToBuilding(c, view, bandHeading(c, view, samples, massRef.current), !reduced);
  }, [controlsRef, massRef, here, fromBuilding, building, samples, controlsReady, reduced, focused]);

  // The closer dolly limit goes on before the step's flight, which is held to it, and off again on any other view.
  const indoorSpot = focus?.kind === 'floor' && focus.at !== undefined;
  useEffect(() => {
    const c = controlsRef.current;
    if (c && controlsReady) limitDolly(c, indoorSpot);
  }, [controlsRef, controlsReady, indoorSpot]);

  useEffect(() => {
    const c = controlsRef.current;
    if (!focus || !c || !controlsReady) return;
    const g = glide.current;
    // A follow riding to this step (planned at commit, before this effect) has the camera. Once it ends or the student
    // takes over, the step flies as before if anything moves it again.
    if (g.follow && !g.done && !g.paused && g.focus === focus) return;
    flyToStep(c, focus, focusBuilding, samples, massRef.current, latest.current.insets, !reduced);
  }, [controlsRef, massRef, glide, focus, focusBuilding, samples, controlsReady, reduced]);
}

/** A step's spot view: an outdoor step's spot, or an indoor step's spot on its floor (the building must have it). Null
 *  for a step that frames its building instead. The flight and the follow both go here, so they end on the same view. */
function stepSpotView(focus: MapFocus, building: CampusBuilding | undefined, insets: MapInsets): BuildingView | null {
  if (focus.kind === 'ground') return stepView(focus.at, insets);
  const height = building && focus.at ? floorHeight(building, focus.floor) : null;
  return focus.at && height !== null ? indoorStepView(focus.at, height, insets) : null;
}

/** Where the camera rests on a step with a spot view: its tilt and distance. Null for a step that has none. */
export function stepRest(
  focus: MapFocus,
  building: CampusBuilding | undefined,
  insets: MapInsets,
): Omit<Lens, 'azimuth'> | null {
  const view = stepSpotView(focus, building, insets);
  return view && { polar: STEP_POLAR, distance: view.distance };
}

/** The player's flight to a step (D44, D46): outdoors to its spot facing the walk; indoors to its spot on the cut floor
 *  facing the walk, or without a spot to its building with the band on its floor. */
function flyToStep(
  c: CameraControls,
  focus: MapFocus,
  building: CampusBuilding | undefined,
  samples: readonly BandSample[],
  mass: Mesh | null,
  insets: MapInsets,
  animate: boolean,
) {
  const spot = stepSpotView(focus, building, insets);
  if (spot) {
    // No band heading: the band isn't drawn while the cut is up. Keep the student's heading when nothing is ahead.
    const azimuth = focus.at && focus.toward ? facingAzimuth(focus.at, focus.toward, c.azimuthAngle) : null;
    goToBuilding(c, spot, azimuth, animate, STEP_POLAR);
    return;
  }
  if (!building) return;
  const view = buildingView(building, insets);
  // The building's own walls never hide its band, in the merged mesh or cut out of it (D45).
  const outlines = building.volumes.map((v) => v.outline);
  const ignore = (hit: Vector3) => insideOutlines(hit, outlines, WALL_MARGIN);
  goToBuilding(c, view, bandHeading(c, view, samples, mass, STEP_POLAR, ignore), animate, STEP_POLAR);
}
