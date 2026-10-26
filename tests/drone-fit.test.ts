// The drone view (D61) fits each outdoor step's stretch: the dot to the next turn, crossing or entrance. If the stretch
// the player hands over left the next step out, the camera would fit too little and the next spot would sit off screen
// or under the sheet, and nothing else would fail. This checks it across the sample routes: the next step's spot lies
// within the reach the camera fits, at the heading the camera flies to.
import { describe, expect, it } from 'vitest';
import { reachFrom } from '../src/features/campus-scene/drone.ts';
import { facingAzimuth } from '../src/features/campus-scene/gestures.ts';
import { stepFocus } from '../src/features/route-player/player.ts';
import { STRETCH_MARGIN } from '../src/shared/config/camera.ts';
import type { Route, XY } from '../src/shared/data/route.ts';
import { sampleGateRoute, sampleIndoorRoute, sampleNoIndoorMap, sampleRoute } from '../src/shared/data/route.sample.ts';

const routes: [string, Route][] = [
  ['sampleRoute', sampleRoute],
  ['sampleGateRoute', sampleGateRoute],
  ['sampleIndoorRoute', sampleIndoorRoute],
  ['sampleNoIndoorMap', sampleNoIndoorMap],
];

/** The points each outdoor step must show: the next step's spot on the same walk, else the walk's end. */
function mustShow(route: Route, i: number): XY | null {
  const step = route.steps[i];
  const next = route.steps[i + 1];
  const leg = step && route.legs[step.leg];
  if (leg?.kind !== 'walk') return null;
  const nextAt = next && 'at' in next ? next.at : undefined;
  if (step && next?.leg === step.leg && nextAt) return nextAt;
  return leg.path.at(-1) ?? null;
}

describe('the drone view fits the next step', () => {
  let checked = 0;

  it.each(routes)('on %s, the next spot is inside the fitted reach', (_name, route) => {
    route.steps.forEach((_step, i) => {
      const focus = stepFocus(route, i);
      const target = mustShow(route, i);
      if (focus?.kind !== 'ground' || !target) return;
      const walking = focus.toward ?? focus.ahead.at(-1) ?? focus.at;
      const azimuth = facingAzimuth(focus.at, walking, 0);
      const reach = reachFrom(focus.ahead, focus.at, azimuth);
      const need = reachFrom([target], focus.at, azimuth);
      expect(need.across).toBeLessThanOrEqual(reach.across * STRETCH_MARGIN + 1e-9);
      expect(need.along).toBeLessThanOrEqual(reach.along * STRETCH_MARGIN + 1e-9);
      checked += 1;
    });
  });

  it('looked at some steps, so the check above is not empty', () => {
    expect(checked).toBeGreaterThan(3);
  });
});
