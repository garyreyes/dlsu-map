import { useEffect, useRef, type RefObject } from 'react';
import type { CameraControls } from '@react-three/drei';
import { Vector3, type Mesh } from 'three';
import { DRONE_POLAR, SELECT_POLAR } from '@/shared/config/camera';
import type { CampusBuilding } from '@/shared/data/campus';
import type { MapView } from '@/shared/settings/map-settings';
import { useMapSettings } from '@/shared/settings/useMapSettings';
import { bestHeading, headingCandidates, type BandSample } from '../floor-band';
import { pointsOf, tripAzimuth } from '../drone';
import { northFrom, shotLens } from '../flat';
import type { Lens } from '../follow';
import { angleDelta, facingAzimuth } from '../gestures';
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
import type { GlideHandle } from './useCameraFollow';
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
  glide: GlideHandle;
  /** The home view's heading, which 3D turns back to when the view changes with nothing on the map. */
  homeAzimuth: number;
}

/** What the view switch reads as it is now, not as it was when the view last changed. */
interface Latest {
  idle: boolean;
  reduced: boolean;
  homeAzimuth: number;
}

/** A change of view with nothing on the map to re-fly turns the camera in place: flat and north up in 2D, back to the
 *  home tilt and heading in 3D, both the short way round. Not on the first view, which attach goes home to, and only
 *  once the controls are there to turn. */
function useViewSwitch(
  controlsRef: RefObject<CameraControls | null>,
  controlsReady: boolean,
  view: MapView,
  latest: RefObject<Latest>,
) {
  const shownView = useRef(view);
  useEffect(() => {
    const c = controlsRef.current;
    if (shownView.current === view || !c || !controlsReady) return;
    shownView.current = view;
    if (!latest.current.idle) return;
    const lens = shotLens(view, 'home');
    const at = c.azimuthAngle;
    const azimuth = lens.northUp ? northFrom(at) : at + angleDelta(at, latest.current.homeAzimuth);
    void c.rotateTo(azimuth, lens.polar, !latest.current.reduced);
  }, [controlsRef, controlsReady, view, latest]);
}

/**
 * Where the camera flies, always to a heading that sees the band. A new selection, or a new floor of it, flies to its
 * building. A new trip (a new `here` object) frames all of it instead: the walk, the From building or gate and the To
 * building; when the trip leaves the map (Back to the card), the building's view comes back. A route option redraws
 * the line without flying, so the lines are read through a ref, and so are the insets: the sheet growing must not fly
 * again, and nor must any later pan. In the player each step flies to its spot, facing the walk (D44). An indoor step
 * flies close to its spot on the cut floor, facing the way along the hallway, and lets the camera dolly closer (7▸);
 * one without a spot flies to its building with the band on its floor. Leaving the player frames the trip again.
 *
 * In 2D (D58) the building, the walkless trip and home look straight down with north up, and an indoor step looks
 * straight down facing its walk (flat.ts). Changing the view re-flies whatever is on screen; with nothing selected the
 * camera turns in place, keeping its target and distance.
 */
export function useCameraFlights(f: Flights) {
  const { controlsRef, controlsReady, massRef, reduced, building, samples, here, fromBuilding, focus } = f;
  const view = useMapSettings((s) => s.settings.view);
  const tripOn = here !== null;
  const focused = focus !== null;
  const idle = !building && !tripOn && !focused;
  const latest = useRef({ insets: f.insets, lines: f.lines, idle, reduced, homeAzimuth: f.homeAzimuth });
  useEffect(() => {
    latest.current = { insets: f.insets, lines: f.lines, idle, reduced, homeAzimuth: f.homeAzimuth };
  });

  useEffect(() => {
    const c = controlsRef.current;
    if (!building || !c || !controlsReady || tripOn) return;
    const lens = shotLens(view, 'building');
    const target = buildingView(building, latest.current.insets, lens.polar);
    const heading = lens.northUp ? northFrom(c.azimuthAngle) : bandHeading(c, target, samples, massRef.current);
    goToBuilding(c, target, heading, !reduced, lens.polar);
  }, [controlsRef, massRef, building, samples, controlsReady, reduced, tripOn, view]);

  useEffect(() => {
    const c = controlsRef.current;
    if (!here || !c || !controlsReady || focused) return;
    const outlines = [
      ...latest.current.lines,
      ...[fromBuilding, building].flatMap((b) => b?.volumes.map((v) => v.outline) ?? []),
      ...(here.kind === 'ground' ? [here.at] : []),
    ];
    // The walk's lines are the route's walk legs in order, From to To: the overview turns to run along them (D61). A
    // trip with no walk (inside one building) keeps the closer angle and the heading that sees its band in 3D, and
    // looks straight down with north up in 2D.
    const heading = tripAzimuth(pointsOf(latest.current.lines), c.azimuthAngle);
    if (heading !== null) {
      goToBuilding(c, tripView(outlines, latest.current.insets, heading), heading, !reduced, DRONE_POLAR);
      return;
    }
    const lens = shotLens(view, 'trip-no-walk');
    const target = tripView(outlines, latest.current.insets, null, lens.polar);
    const faces = lens.northUp ? northFrom(c.azimuthAngle) : bandHeading(c, target, samples, massRef.current);
    goToBuilding(c, target, faces, !reduced, lens.polar);
  }, [controlsRef, massRef, here, fromBuilding, building, samples, controlsReady, reduced, focused, view]);

  useViewSwitch(controlsRef, controlsReady, view, latest);

  useStepFlight(f, view, latest);
}

/** The heading a step with a spot faces: the way the walk goes on from it, or null to keep the camera's heading. An
 *  outdoor step with nothing ahead of it to face (no `toward`) faces its stretch's far end, if that is anywhere else. */
function stepHeading(focus: MapFocus, current: number): number | null {
  if (focus.kind === 'ground') return facingAzimuth(focus.at, focus.toward ?? focus.ahead.at(-1) ?? focus.at, current);
  return focus.at && focus.toward ? facingAzimuth(focus.at, focus.toward, current) : null;
}

/** A step's spot view with the tilt it is seen at: an outdoor step's drone view of its stretch (D61), or an indoor
 *  step's spot on its floor (the building must have it; flat in 2D). Null for a step that frames its building instead.
 *  `current` is the camera's heading, `mapView` the 2D or 3D setting. The flight and the follow both go here, so they
 *  end on the same view. */
function stepSpotView(
  focus: MapFocus,
  building: CampusBuilding | undefined,
  insets: MapInsets,
  current: number,
  mapView: MapView,
): { readonly view: BuildingView; readonly polar: number } | null {
  if (focus.kind === 'ground') {
    const azimuth = stepHeading(focus, current) ?? current;
    return { view: stepView(focus.at, focus.ahead, azimuth, insets), polar: DRONE_POLAR };
  }
  const height = building && focus.at ? floorHeight(building, focus.floor) : null;
  if (!focus.at || height === null) return null;
  const { polar } = shotLens(mapView, 'indoor-step');
  return { view: indoorStepView(focus.at, height, insets, polar), polar };
}

/** Where the camera rests on a step with a spot view: its tilt and distance. Null for a step that has none. `current`
 *  is the camera's azimuth when the step is taken, `mapView` the 2D or 3D setting. */
export function stepRest(
  focus: MapFocus,
  building: CampusBuilding | undefined,
  insets: MapInsets,
  current: number,
  mapView: MapView,
): Omit<Lens, 'azimuth'> | null {
  const spot = stepSpotView(focus, building, insets, current, mapView);
  return spot && { polar: spot.polar, distance: spot.view.distance };
}

/** The player's flight to a step (D44, D46): outdoors to its spot from above, facing the walk (D61); indoors to its spot
 *  on the cut floor facing the walk, or without a spot to its building with the band on its floor. */
function flyToStep(
  c: CameraControls,
  focus: MapFocus,
  building: CampusBuilding | undefined,
  samples: readonly BandSample[],
  mass: Mesh | null,
  insets: MapInsets,
  animate: boolean,
  mapView: MapView,
) {
  const spot = stepSpotView(focus, building, insets, c.azimuthAngle, mapView);
  if (spot) {
    // No band heading: the band isn't drawn while the cut is up. Keep the student's heading when nothing is ahead.
    goToBuilding(c, spot.view, stepHeading(focus, c.azimuthAngle), animate, spot.polar);
    return;
  }
  if (!building) return;
  // The band's floor is seen from the step's tilt; in 3D the building is still fitted at the closer angle, as ever.
  const { polar } = shotLens(mapView, 'indoor-band');
  const view = buildingView(building, insets, mapView === '3d' ? SELECT_POLAR : polar);
  // The building's own walls never hide its band, in the merged mesh or cut out of it (D45).
  const outlines = building.volumes.map((v) => v.outline);
  const ignore = (hit: Vector3) => insideOutlines(hit, outlines, WALL_MARGIN);
  goToBuilding(c, view, bandHeading(c, view, samples, mass, polar, ignore), animate, polar);
}

/** The player's flight to each step (D44), unless the camera is riding the dot's glide to it (D59). */
function useStepFlight(f: Flights, view: MapView, latest: RefObject<{ insets: MapInsets }>) {
  const { controlsRef, controlsReady, massRef, reduced, samples, focus, focusBuilding, glide } = f;
  // The closer dolly limit goes on before the step's flight, which is held to it, and off again on any other view.
  const indoorSpot = focus?.kind === 'floor' && focus.at !== undefined;
  useEffect(() => {
    const c = controlsRef.current;
    if (c && controlsReady) limitDolly(c, indoorSpot);
  }, [controlsRef, controlsReady, indoorSpot]);

  const flownView = useRef(view);
  useEffect(() => {
    const switched = flownView.current !== view;
    flownView.current = view;
    const c = controlsRef.current;
    if (!focus || !c || !controlsReady) return;
    const g = glide.share.current;
    // A follow riding to this step (planned at commit, before this effect) has the camera. Once it ends or the student
    // takes over, the step flies as before if anything moves it again. A change of view mid-follow takes the camera
    // back, since the follow ends on the old view's lens.
    if (switched) glide.pause();
    else if (g.follow && !g.done && !g.paused && g.focus === focus) return;
    flyToStep(c, focus, focusBuilding, samples, massRef.current, latest.current.insets, !reduced, view);
  }, [controlsRef, massRef, glide, focus, focusBuilding, samples, controlsReady, reduced, view]);
}
