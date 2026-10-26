// How far along the route's outdoor walk each step stands, for the route line that turns grey behind the "you are here"
// dot (D59). The walk is its walk legs' paths one after another, the order CampusMap draws them. Pure: no React, no
// three.js. Distances are meters. Tests: walked.test.ts.
import type { Route, XY } from '@/shared/data/route';
import { project } from './glide';

function pathLength(path: readonly XY[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1] ?? [0, 0];
    const [bx, by] = path[i] ?? [0, 0];
    total += Math.hypot(bx - ax, by - ay);
  }
  return total;
}

/** For each of `route.steps`, how far along the route's outdoor walk the step stands, in meters. A step on a walk leg
 *  is where its spot falls on that leg's path, past the walk legs before it. A step on any other leg is at the total
 *  length of the walk legs before it: 0 in the From building, the whole walk in the To building. Lengths come from the
 *  paths, not the rounded `meters`. */
export function stepsWalked(route: Route): number[] {
  // offsets[i] is the walk length before leg i.
  const offsets: number[] = [];
  let total = 0;
  for (const leg of route.legs) {
    offsets.push(total);
    if (leg.kind === 'walk') total += pathLength(leg.path);
  }
  return route.steps.map((step) => {
    const leg = route.legs[step.leg];
    const offset = offsets[step.leg] ?? 0;
    // Every step on a walk leg has a spot; one without would stand at the leg's start.
    return leg?.kind === 'walk' && step.at ? offset + project(leg.path, step.at).along : offset;
  });
}

/** The walked distance `glided` meters into a glide from a step at `from` to one at `to`: moves from `from` toward
 *  `to` by `glided`, never past `to`. Works both ways, for Back. */
export function walkedToward(from: number, to: number, glided: number): number {
  const gap = to - from;
  return Math.abs(gap) <= glided ? to : from + Math.sign(gap) * glided;
}
