// One building's indoor graph (8a): its hallway lines, floor by floor, joined where they cross or where one ends
// within 1 m of another, with doors, stairs, elevators and entrances hung off the nearest hallway point. Floors are
// joined by the caller (stairs and elevators), never here. Points are in meters, rounded to 0.1 m like the rest of
// the compiled data; two points that round the same on one floor are one point. Pure. Tests: indoor-graph.test.ts.
import { round, type Point } from './geometry.ts';

export type LinkKind = 'hall' | 'door' | 'stairs' | 'elevator' | 'entrance';
export type GraphLink = [from: number, to: number, kind: LinkKind];

export interface GraphFloor {
  readonly floor: number;
  readonly hallways: readonly (readonly Point[])[];
}

/** Something to hang off the hallways: a door, a stair or elevator on one floor, or a building entrance on G. A stair
 *  or elevator joins its hallway by `hall`, walking on that floor: only its links between floors are stairs or
 *  elevator, so a router can cost those by the floors they cross. */
export interface Attach {
  readonly floor: number;
  readonly point: Point;
  readonly kind: 'hall' | 'door' | 'entrance';
  /** Further than this from every hallway, in meters, and it is left out. */
  readonly within: number;
}

export interface IndoorGraph {
  /** Flat x, y pairs. */
  readonly points: number[];
  /** The floor of each point. */
  readonly floors: number[];
  readonly links: GraphLink[];
}

export interface Built {
  readonly graph: IndoorGraph;
  /** Each attachment's point in the graph, or null when it was too far from a hallway (or its floor has none). */
  readonly nodes: (number | null)[];
  /** How far each attachment was from its floor's nearest hallway, meters; Infinity on a floor with no hallway. */
  readonly distances: number[];
}

/** A hallway that ends this close to another meets it: the evacuation route is drawn in pieces. */
const JOIN = 1;

interface Segment {
  readonly floor: number;
  readonly a: Point;
  readonly b: Point;
  /** Points along it, `t` 0 at a to 1 at b; it is linked between them in order. */
  readonly cuts: { t: number; node: number }[];
}

function nodeTable() {
  const points: number[] = [];
  const floors: number[] = [];
  const ids = new Map<string, number>();
  const add = (floor: number, [x, y]: Point): number => {
    const [rx, ry] = [round(x), round(y)];
    const key = `${String(floor)}:${String(rx)},${String(ry)}`;
    const known = ids.get(key);
    if (known !== undefined) return known;
    ids.set(key, floors.length);
    points.push(rx, ry);
    floors.push(floor);
    return floors.length - 1;
  };
  return { points, floors, add };
}

/** The point of a–b nearest p, as `t` along it, with the distance. */
function nearest([px, py]: Point, [ax, ay]: Point, [bx, by]: Point) {
  const [dx, dy] = [bx - ax, by - ay];
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  const point: Point = [ax + t * dx, ay + t * dy];
  return { t, point, distance: Math.hypot(px - point[0], py - point[1]) };
}

/** Where two segments meet, as `t` along each, or null. Parallel ones never cross (an overlap meets at its ends). */
function crossing(s: Segment, o: Segment): [number, number] | null {
  const [rx, ry] = [s.b[0] - s.a[0], s.b[1] - s.a[1]];
  const [qx, qy] = [o.b[0] - o.a[0], o.b[1] - o.a[1]];
  const cross = rx * qy - ry * qx;
  if (cross === 0) return null;
  const [wx, wy] = [o.a[0] - s.a[0], o.a[1] - s.a[1]];
  const t = (wx * qy - wy * qx) / cross;
  const u = (wx * ry - wy * rx) / cross;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}

type Nodes = ReturnType<typeof nodeTable>;

function joinHallways(segments: readonly Segment[], nodes: Nodes, links: GraphLink[]): void {
  for (const [i, s] of segments.entries()) {
    for (const o of segments.slice(i + 1).filter((x) => x.floor === s.floor)) {
      const met = crossing(s, o);
      if (!met) continue;
      const node = nodes.add(s.floor, [s.a[0] + met[0] * (s.b[0] - s.a[0]), s.a[1] + met[0] * (s.b[1] - s.a[1])]);
      s.cuts.push({ t: met[0], node });
      o.cuts.push({ t: met[1], node });
    }
  }
  for (const s of segments) {
    for (const [end, t] of [[s.a, 0] as const, [s.b, 1] as const]) {
      const endNode = s.cuts.find((c) => c.t === t)?.node ?? nodes.add(s.floor, end);
      for (const o of segments.filter((x) => x !== s && x.floor === s.floor)) {
        const near = nearest(end, o.a, o.b);
        if (near.distance > JOIN) continue;
        const node = nodes.add(o.floor, near.point);
        o.cuts.push({ t: near.t, node });
        if (node !== endNode) links.push([endNode, node, 'hall']);
      }
    }
  }
}

function attachOne(at: Attach, segments: readonly Segment[], nodes: Nodes, links: GraphLink[]) {
  let best: { s: Segment; t: number; point: Point; distance: number } | null = null;
  for (const s of segments.filter((x) => x.floor === at.floor)) {
    const near = nearest(at.point, s.a, s.b);
    if (!best || near.distance < best.distance) best = { s, ...near };
  }
  if (!best || best.distance > at.within) return { node: null, distance: best?.distance ?? Infinity };
  const node = nodes.add(at.floor, at.point);
  const onHallway = nodes.add(at.floor, best.point);
  best.s.cuts.push({ t: best.t, node: onHallway });
  if (node !== onHallway) links.push([node, onHallway, at.kind]);
  return { node, distance: best.distance };
}

/** Each link once, whichever way round it was found. */
function unique(links: readonly GraphLink[]): GraphLink[] {
  const seen = new Set<string>();
  return links.filter(([a, b]) => {
    const key = a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildGraph(floors: readonly GraphFloor[], attach: readonly Attach[]): Built {
  const nodes = nodeTable();
  const links: GraphLink[] = [];
  const segments: Segment[] = floors.flatMap((f) =>
    f.hallways.flatMap((line) =>
      line.slice(1).flatMap((b, i) => {
        const a = line[i] ?? b;
        return a[0] === b[0] && a[1] === b[1] ? [] : [{ floor: f.floor, a, b, cuts: [] }];
      }),
    ),
  );
  for (const s of segments)
    s.cuts.push({ t: 0, node: nodes.add(s.floor, s.a) }, { t: 1, node: nodes.add(s.floor, s.b) });
  joinHallways(segments, nodes, links);
  const attached = attach.map((at) => attachOne(at, segments, nodes, links));
  for (const s of segments) {
    const along = [...s.cuts].sort((x, y) => x.t - y.t);
    for (const [i, cut] of along.slice(1).entries()) {
      const before = along[i]?.node ?? cut.node;
      if (before !== cut.node) links.push([before, cut.node, 'hall']);
    }
  }
  return {
    graph: { points: nodes.points, floors: nodes.floors, links: unique(links) },
    nodes: attached.map((a) => a.node),
    distances: attached.map((a) => a.distance),
  };
}

/** Every point reachable from `from`, links walked both ways. */
export function reachable(graph: IndoorGraph, from: number): Set<number> {
  const next = new Map<number, number[]>();
  for (const [a, b] of graph.links) {
    next.set(a, [...(next.get(a) ?? []), b]);
    next.set(b, [...(next.get(b) ?? []), a]);
  }
  const seen = new Set([from]);
  const queue = [from];
  for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
    for (const n of next.get(at) ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen;
}
