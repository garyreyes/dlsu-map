import { useEffect, useRef, type RefObject } from 'react';
import type { CameraControls } from '@react-three/drei';
import { Vector3, type Mesh } from 'three';
import { SELECT_POLAR, STEP_POLAR } from '@/shared/config/camera';
import type { CampusBuilding } from '@/shared/data/campus';
import { bestHeading, headingCandidates, type BandSample } from '../floor-band';
import { facingAzimuth } from '../gestures';
import { buildingView, goToBuilding, stepView, tripView, type BuildingView, type MapInsets } from './CameraRig';
import type { MapHere } from './Labels';
import type { MapFocus } from './useTripMarks';
import { cameraAt, sees, toScene } from './visibility';

/**
 * The heading nearest the student's own whose view of `view` sees the most of the band (DESIGN.md, Camera), or null
 * to keep the heading when there's no band.
 */
function bandHeading(c: CameraControls, view: BuildingView, band: readonly BandSample[], mass: Mesh | null) {
  if (band.length === 0 || !mass) return null;
  const points = band.map((p) => toScene(p));
  const from = new Vector3();
  const seen = (azimuth: number) => {
    cameraAt(view.target, azimuth, SELECT_POLAR, view.distance, from);
    return points.filter((p) => sees(mass, from, p)).length;
  };
  return bestHeading(headingCandidates(c.azimuthAngle), seen, points.length);
}

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
}

/**
 * Where the camera flies, always to a heading that sees the band. A new selection, or a new floor of it, flies to its
 * building. A new trip (a new `here` object) frames all of it instead: the walk, the From building or gate and the To
 * building; when the trip leaves the map (Back to the card), the building's view comes back. A route option redraws
 * the line without flying, so the lines are read through a ref, and so are the insets: the sheet growing must not fly
 * again, and nor must any later pan. In the player each step flies to its spot, facing the walk, or to its building
 * with the band on its floor (D44); leaving the player frames the trip again.
 */
export function useCameraFlights(f: Flights) {
  const { controlsRef, controlsReady, massRef, reduced, building, samples, here, fromBuilding, focus, focusBuilding } =
    f;
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

  useEffect(() => {
    const c = controlsRef.current;
    if (!focus || !c || !controlsReady) return;
    if (focus.kind === 'ground') {
      const view = stepView(focus.at, latest.current.insets);
      const azimuth = focus.toward && facingAzimuth(focus.at, focus.toward, c.azimuthAngle);
      goToBuilding(c, view, azimuth, !reduced, STEP_POLAR);
      return;
    }
    if (!focusBuilding) return;
    const view = buildingView(focusBuilding, latest.current.insets);
    goToBuilding(c, view, bandHeading(c, view, samples, massRef.current), !reduced);
  }, [controlsRef, massRef, focus, focusBuilding, samples, controlsReady, reduced]);
}
