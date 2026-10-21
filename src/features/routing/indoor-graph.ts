// 8b: one building's indoor graph (8a, D39) weighted in seconds (D34), and the cheapest way through it with ngraph's
// A*. The compiler links an elevator's stops floor to floor, so its wait can't sit on each link: every stop gets a car
// node (its point + the point count), getting on or off costs half the wait, and riding car to car costs the floors.
// A ride of any length then waits once (the bug the 8a review caught in P1's test route). ngraph facts as in
// walk-graph.ts: `find` returns the path target first, and costs live in our own map keyed by the pair.
import createGraph from 'ngraph.graph';
import { aStar } from 'ngraph.path';
import { ELEVATOR_PER_FLOOR, ELEVATOR_WAIT, STAIRS_PER_FLOOR, WALK_SPEED } from '@/shared/config/routing';
import type { Indoor, Vertical } from '@/shared/data/indoor';
import type { XY } from '@/shared/data/route';

/** How a trip changes floors in this building: Stairs, Elevator or Auto, already decided (D34). */
export type Climb = 'stairs' | 'elevator';

/** Added to the cost of using the other way up than the one asked for: an hour, so it's only used where the asked-for
 *  one can't go (an elevator that skips the floor, or a floor it doesn't reach). Never in the time shown. */
const AVOID = 3600;

export interface IndoorPath {
  /** Graph points, start to target. A car node is shown as its stop, once. */
  readonly points: readonly number[];
  /** What the search minimised: seconds, plus AVOID for each use of the other way up. */
  readonly cost: number;
}

export interface IndoorModel {
  readonly file: Indoor;
  readonly hasElevator: boolean;
  at(point: number): XY;
  floor(point: number): number;
  /** How many other points a point links to on its own floor: 3 or more is a junction. */
  degree(point: number): number;
  /** The stairs or elevator that stops at this point. */
  vertical(point: number): Vertical | undefined;
  /** The graph point where campus.json's entrance `index` joins G, if it does. */
  entrance(index: number): number | undefined;
  /** The cheapest way from any start to any target, or null. Ties go to the earlier start, then the earlier target. */
  search(starts: readonly number[], targets: readonly number[], climb: Climb): IndoorPath | null;
}

interface Costed {
  readonly a: number;
  readonly b: number;
  readonly seconds: number;
  /** Which way up this link is, when it's part of one: an elevator's on and off links count, the ride doesn't. */
  readonly climb?: Climb;
}

const pair = (a: number, b: number): string => (a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`);

const models = new WeakMap<Indoor, IndoorModel>();

/** The model for a building file, built once per file object. */
export function indoorModel(file: Indoor): IndoorModel {
  const known = models.get(file);
  if (known !== undefined) return known;
  const model = build(file);
  models.set(file, model);
  return model;
}

function build(file: Indoor): IndoorModel {
  const g = file.graph;
  const at = (p: number): XY => [g.points[2 * p] ?? Number.NaN, g.points[2 * p + 1] ?? Number.NaN];
  const floor = (p: number): number => g.floors[p] ?? 0;
  const near = g.floors.map(() => new Set<number>());
  for (const [a, b, kind] of g.links) {
    if (kind === 'stairs' || kind === 'elevator') continue;
    near[a]?.add(b);
    near[b]?.add(a);
  }
  const stops = new Map(file.verticals.flatMap((v) => v.stops.map((s) => [s.point, v] as const)));
  const entrances = new Map(file.entrances.map((e) => [e.entrance, e.point]));
  const finders = { stairs: finder(file, 'stairs'), elevator: finder(file, 'elevator') };
  return {
    file,
    hasElevator: file.verticals.some((v) => v.kind === 'elevator'),
    at,
    floor,
    degree: (p) => near[p]?.size ?? 0,
    vertical: (p) => stops.get(p),
    entrance: (i) => entrances.get(i),
    search: (starts, targets, climb) => finders[climb](starts, targets),
  };
}

/** Every link with its seconds; elevator links become car links (see the top of this file). A link between floors
 *  counts only between two stops of a stairs or elevator: nothing else can say which way up it is. */
function costedLinks(file: Indoor): Costed[] {
  const g = file.graph;
  const cars = g.floors.length;
  const stops = new Set(file.verticals.flatMap((v) => v.stops.map((s) => s.point)));
  const floors = (a: number, b: number) => Math.abs((g.floors[a] ?? 0) - (g.floors[b] ?? 0));
  return g.links.flatMap(([a, b, kind]): Costed[] => {
    if ((kind === 'stairs' || kind === 'elevator') && !(stops.has(a) && stops.has(b))) return [];
    if (kind === 'stairs') return [{ a, b, seconds: floors(a, b) * STAIRS_PER_FLOOR, climb: 'stairs' }];
    if (kind === 'elevator') {
      return [
        { a, b: a + cars, seconds: ELEVATOR_WAIT / 2, climb: 'elevator' },
        { a: b, b: b + cars, seconds: ELEVATOR_WAIT / 2, climb: 'elevator' },
        { a: a + cars, b: b + cars, seconds: floors(a, b) * ELEVATOR_PER_FLOOR },
      ];
    }
    const dx = (g.points[2 * a] ?? 0) - (g.points[2 * b] ?? 0);
    const dy = (g.points[2 * a + 1] ?? 0) - (g.points[2 * b + 1] ?? 0);
    return [{ a, b, seconds: Math.hypot(dx, dy) / WALK_SPEED }];
  });
}

type Finder = (starts: readonly number[], targets: readonly number[]) => IndoorPath | null;

function finder(file: Indoor, climb: Climb): Finder {
  const g = file.graph;
  const graph = createGraph<undefined, undefined>();
  const cost = new Map<string, number>();
  const cars = g.floors.length;
  for (let i = 0; i < 2 * cars; i++) graph.addNode(i);
  for (const link of costedLinks(file)) {
    const key = pair(link.a, link.b);
    const c = link.seconds + (link.climb !== undefined && link.climb !== climb ? AVOID : 0);
    cost.set(key, Math.min(cost.get(key) ?? Infinity, c));
    graph.addLink(link.a, link.b);
  }
  const find = aStar(graph, {
    oriented: false,
    distance: (a, b) => cost.get(pair(Number(a.id), Number(b.id))) ?? Infinity,
  });
  return (starts, targets) => {
    let best: IndoorPath | null = null;
    for (const start of starts) {
      for (const target of targets) {
        const path = find
          .find(start, target)
          .map((n) => Number(n.id))
          .reverse();
        if (path.length === 0) continue;
        const total = path.slice(1).reduce((sum, p, i) => sum + (cost.get(pair(path[i] ?? p, p)) ?? 0), 0);
        if (best !== null && total >= best.cost) continue;
        const points = path.map((p) => p % cars).filter((p, i, all) => i === 0 || p !== all[i - 1]);
        best = { points, cost: total };
      }
    }
    return best;
  };
}
