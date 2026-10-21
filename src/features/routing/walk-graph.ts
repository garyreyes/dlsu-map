// The walk network (4a) as a graph weighted in seconds (D34), and the cheapest walk over it with ngraph's A*.
// ngraph facts this relies on (PROJECT_FACTS "Routing"): `find` returns the path target first, an empty array when
// nothing joins, and throws for an unknown node; adding a link twice overwrites its data. So costs live in our own
// map, keyed by the pair, and every point is added as a node.
import createGraph, { type Graph } from 'ngraph.graph';
import { aStar } from 'ngraph.path';
import { CROSSING_WAIT, WALK_SPEED, WAY_FACTOR } from '@/shared/config/routing';
import type { Walk } from '@/shared/data/campus';
import type { XY } from '@/shared/data/route';

export interface LinkCost {
  readonly meters: number;
  /** What the router minimizes: walking seconds × the way's factor, plus any crossing wait. */
  readonly cost: number;
  /** What the student is shown: real walking seconds plus any crossing wait. */
  readonly seconds: number;
  /** Its way in `walk.ways`: of the cheapest link, when two join the same points. The directions (4c) name it. */
  readonly way: number;
}

export interface WalkGraph {
  readonly graph: Graph<undefined, LinkCost>;
  at(point: number): XY;
  /** The link between two points, either way round. */
  link(a: number, b: number): LinkCost | undefined;
}

export interface CheapestWalk {
  /** Walk points, from the start to the target. */
  readonly points: readonly number[];
  readonly meters: number;
  readonly seconds: number;
}

const pair = (a: number, b: number): string => (a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`);

/**
 * The wait on each link of a named crossing (D34: 45 s for Taft), by link index. A crossing is a run of crossing links
 * joined at points that aren't on a sidewalk, and it waits only if it reaches two sidewalk points, so a crosswalk
 * drawn in pieces waits once and a crossing-tagged footway past the curb doesn't wait at all. The wait is shared
 * between the run's sidewalk ends.
 */
export function crossingWaits(walk: Walk): Map<number, number> {
  const onSidewalk = new Set<number>();
  const waiting: number[] = [];
  walk.links.forEach(([a, b, w], i) => {
    const way = walk.ways[w];
    if (way?.kind === 'sidewalk') onSidewalk.add(a).add(b);
    if (way?.kind === 'crossing' && way.name !== undefined && way.name in CROSSING_WAIT) waiting.push(i);
  });
  const byPoint = new Map<number, number[]>();
  for (const i of waiting) for (const p of ends(walk, i)) byPoint.set(p, [...(byPoint.get(p) ?? []), i]);
  const waits = new Map<number, number>();
  const seen = new Set<number>();
  for (const first of waiting) {
    if (seen.has(first)) continue;
    const run = crossingRun(walk, first, byPoint, onSidewalk, seen);
    // One entry per link end on a sidewalk: a one-link crossing has two, a crossing through a median one per piece.
    const curbs = run.flatMap((i) =>
      ends(walk, i)
        .filter((p) => onSidewalk.has(p))
        .map((point) => ({ i, point })),
    );
    if (new Set(curbs.map((c) => c.point)).size < 2) continue;
    const wait = CROSSING_WAIT[nameOf(walk, first) ?? ''] ?? 0;
    for (const { i } of curbs) waits.set(i, (waits.get(i) ?? 0) + wait / curbs.length);
  }
  return new Map([...waits].sort(([a], [b]) => a - b));
}

const ends = (walk: Walk, i: number): number[] => {
  const link = walk.links[i];
  return link === undefined ? [] : [link[0], link[1]];
};
const nameOf = (walk: Walk, i: number): string | undefined => walk.ways[walk.links[i]?.[2] ?? -1]?.name;

/** The links joined to `first` through points off the sidewalk, all of the same crossing. */
function crossingRun(
  walk: Walk,
  first: number,
  byPoint: ReadonlyMap<number, readonly number[]>,
  onSidewalk: ReadonlySet<number>,
  seen: Set<number>,
): number[] {
  const run: number[] = [];
  const queue = [first];
  seen.add(first);
  for (let i = queue.pop(); i !== undefined; i = queue.pop()) {
    run.push(i);
    const next = ends(walk, i)
      .filter((p) => !onSidewalk.has(p))
      .flatMap((p) => byPoint.get(p) ?? [])
      .filter((j) => !seen.has(j) && nameOf(walk, j) === nameOf(walk, first));
    // A link sharing both off-sidewalk ends would be listed twice.
    for (const j of new Set(next)) {
      seen.add(j);
      queue.push(j);
    }
  }
  return run.sort((a, b) => a - b);
}

export function buildWalkGraph(walk: Walk): WalkGraph {
  const waits = crossingWaits(walk);
  const at = (p: number): XY => [walk.points[2 * p] ?? Number.NaN, walk.points[2 * p + 1] ?? Number.NaN];
  const costs = new Map<string, LinkCost>();
  walk.links.forEach(([a, b, w], i) => {
    const [ax, ay] = at(a);
    const [bx, by] = at(b);
    const meters = Math.hypot(bx - ax, by - ay);
    const walking = meters / WALK_SPEED;
    const wait = waits.get(i) ?? 0;
    const cost = walking * WAY_FACTOR[walk.ways[w]?.kind ?? 'path'] + wait;
    const old = costs.get(pair(a, b));
    if (old === undefined || cost < old.cost) costs.set(pair(a, b), { meters, cost, seconds: walking + wait, way: w });
  });
  const graph = createGraph<undefined, LinkCost>();
  for (let p = 0; p < walk.points.length / 2; p++) graph.addNode(p);
  for (const [key, cost] of costs) {
    const [a = 0, b = 0] = key.split('-').map(Number);
    graph.addLink(a, b, cost);
  }
  return { graph, at, link: (a, b) => costs.get(pair(a, b)) };
}

/** What it costs to reach each start and to go on from each target, in the same order (8b: the walk inside to or from
 *  that door). Infinity leaves that one out. Without it, every start and target is free. */
export interface EndCosts {
  readonly starts: readonly number[];
  readonly targets: readonly number[];
}

/** The cheapest walk from any start to any target (A*), or null if none joins them. Ties go to the earlier start,
 *  then the earlier target, so the same trip always gives the same route. `ends` adds the cost on either side. */
export function cheapestWalk(
  g: WalkGraph,
  starts: readonly number[],
  targets: readonly number[],
  ends?: EndCosts,
): CheapestWalk | null {
  const finder = aStar(g.graph, {
    distance: (_from, _to, link) => link.data.cost,
    // Straight-line walking time never overestimates: every factor is at least 1 and waits only add.
    heuristic: (from, to) => {
      const [ax, ay] = g.at(Number(from.id));
      const [bx, by] = g.at(Number(to.id));
      return Math.hypot(bx - ax, by - ay) / WALK_SPEED;
    },
  });
  let best: { points: number[]; cost: number } | null = null;
  for (const [i, start] of starts.entries()) {
    for (const [j, target] of targets.entries()) {
      const extra = (ends?.starts[i] ?? 0) + (ends?.targets[j] ?? 0);
      if (extra === Infinity) continue;
      const points = finder
        .find(start, target)
        .map((n) => Number(n.id))
        .reverse();
      const cost = sum(g, points, 'cost') + extra;
      if (points.length > 0 && (best === null || cost < best.cost)) best = { points, cost };
    }
  }
  if (best === null) return null;
  return { points: best.points, meters: sum(g, best.points, 'meters'), seconds: sum(g, best.points, 'seconds') };
}

function sum(g: WalkGraph, points: readonly number[], field: 'meters' | 'cost' | 'seconds'): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += g.link(points[i - 1] ?? -1, points[i] ?? -1)?.[field] ?? 0;
  return total;
}
