// P1's test route (8a): the cheapest way from an entrance to a room's nearest door on the indoor graph, so the owner
// can see the graph route through hallways and stairs before checking a floor. A stand-in until 8b's real router,
// which adds the Stairs / Elevator / Auto choice and the outdoor leg. Costs are D34's, in seconds. Pure; ngraph facts
// as in walk-graph.ts. Tests: test-route.test.ts.
import createGraph from 'ngraph.graph';
import { aStar } from 'ngraph.path';
import { ELEVATOR_PER_FLOOR, ELEVATOR_WAIT, STAIRS_PER_FLOOR, WALK_SPEED } from '@/shared/config/routing';
import type { Indoor } from '@/shared/data/indoor';

type Graph = Indoor['graph'];

export interface TestRoute {
  /** Graph points, from the start to the door. */
  readonly points: readonly number[];
  readonly seconds: number;
}

const pair = (a: number, b: number): string => (a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`);

/** The links to search, with their seconds. The compiler links an elevator's stops floor to floor, so its wait can't
 *  sit on each link: every stop gets a car node (point index + the point count), getting on or off costs half the
 *  wait, and riding car to car costs the floors. A ride of any length then waits once. */
function costedLinks(g: Graph): [number, number, number][] {
  const cars = g.floors.length;
  const floors = (a: number, b: number) => Math.abs((g.floors[a] ?? 0) - (g.floors[b] ?? 0));
  return g.links.flatMap(([a, b, kind]): [number, number, number][] => {
    if (kind === 'stairs') return [[a, b, floors(a, b) * STAIRS_PER_FLOOR]];
    if (kind === 'elevator') {
      return [
        [a, a + cars, ELEVATOR_WAIT / 2],
        [b, b + cars, ELEVATOR_WAIT / 2],
        [a + cars, b + cars, floors(a, b) * ELEVATOR_PER_FLOOR],
      ];
    }
    const dx = (g.points[2 * a] ?? 0) - (g.points[2 * b] ?? 0);
    const dy = (g.points[2 * a + 1] ?? 0) - (g.points[2 * b + 1] ?? 0);
    return [[a, b, Math.hypot(dx, dy) / WALK_SPEED]];
  });
}

/** The cheapest route from `from` to whichever of `doors` is cheapest to reach, or null when none can be. */
export function testRoute(g: Graph, from: number, doors: readonly number[]): TestRoute | null {
  const graph = createGraph<undefined, undefined>();
  const cost = new Map<string, number>();
  const cars = g.floors.length;
  for (let i = 0; i < 2 * cars; i++) graph.addNode(i);
  for (const [a, b, seconds] of costedLinks(g)) {
    const key = pair(a, b);
    cost.set(key, Math.min(cost.get(key) ?? Infinity, seconds));
    graph.addLink(a, b);
  }
  const finder = aStar(graph, {
    oriented: false,
    distance: (a, b) => cost.get(pair(Number(a.id), Number(b.id))) ?? Infinity,
  });
  let best: TestRoute | null = null;
  for (const door of doors) {
    const points = finder
      .find(from, door)
      .map((n) => Number(n.id))
      .reverse();
    if (points.length === 0) continue;
    const seconds = points.slice(1).reduce((sum, p, i) => sum + (cost.get(pair(points[i] ?? p, p)) ?? 0), 0);
    // A car node stands for its stop: shown as the stop, once.
    const stops = points.map((p) => p % cars).filter((p, i, all) => i === 0 || p !== all[i - 1]);
    if (!best || seconds < best.seconds) best = { points: stops, seconds };
  }
  return best;
}
