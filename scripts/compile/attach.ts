// Gates and building entrances joined to the walking network (4a), and the build's reachability check (ARCHITECTURE
// §3.4: every room reachable; outdoors that means every building's main entrance, from every gate). A pin is snapped
// onto its building's wall (D30), then joined to the nearest path by a straight `door` link that must not pass
// through a building. Pure. Tests: attach.test.ts.
import type { Entrance, Gate, Walk } from '../../src/shared/data/campus.ts';
import { pointInRing, round, type Point } from './geometry.ts';
import type { Link, Network, WayInfo } from './walk.ts';

/** A pin further than this from its building is on the wrong building, or mistyped. */
const MAX_PIN = 15;
/** A door further than this from any path means a path is missing from the map. */
const MAX_DOOR = 30;
/** Closer than this is the same place. Also how close to a wall a door link may run. */
const SAME = 0.5;
const ON_WALL = 0.3;

export interface GateInput {
  readonly id: string;
  readonly name: string;
  /** Its OSM node (`lon,lat`), found among the network's keys if a path passes through the gate. */
  readonly key: string;
  readonly point: Point;
}
export interface EntranceInput {
  readonly building: string;
  readonly kind: Entrance['kind'];
  /** The pin, in meters. */
  readonly point: Point;
  readonly verified: boolean;
  readonly name?: string;
}
export interface AttachInput {
  readonly network: Network;
  readonly buildings: readonly {
    readonly slug: string;
    readonly tier: 'full' | 'block';
    readonly outlines: readonly (readonly Point[])[];
  }[];
  readonly gates: readonly GateInput[];
  readonly entrances: readonly EntranceInput[];
}
export interface AttachResult {
  readonly walk: Walk;
  readonly gates: Gate[];
  readonly entrances: Entrance[];
  readonly errors: string[];
  readonly notes: string[];
}

const dist = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const fmt = (p: Point) => `${String(round(p[0]))}, ${String(round(p[1]))}`;

/** The point of segment a–b nearest p, and where along it (0 at a, 1 at b). */
function nearestOn(p: Point, a: Point, b: Point): { at: Point; t: number } {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return { at: [a[0] + t * dx, a[1] + t * dy], t };
}

/** The point of a ring's walls nearest p. */
function nearestWall(p: Point, ring: readonly Point[]): Point {
  return ring
    .map((a, i) => nearestOn(p, a, ring[(i + 1) % ring.length] as Point).at)
    .reduce((best, q) => (dist(p, q) < dist(p, best) ? q : best));
}

/** The network as it grows: points and links can be added, links split. */
interface Grow {
  readonly points: Point[];
  readonly keys: string[];
  readonly ways: WayInfo[];
  readonly links: Link[];
  readonly buildings: AttachInput['buildings'];
  readonly errors: string[];
}

function addPoint(g: Grow, key: string, p: Point): number {
  g.points.push(p);
  g.keys.push(key);
  return g.points.length - 1;
}

/** The building a straight walk from p to q passes through (more than brushing a wall), if any. */
function blockedBy(g: Grow, p: Point, q: Point): string | undefined {
  const steps = Math.ceil(dist(p, q) / 0.25);
  for (let i = 1; i < steps; i++) {
    const s: Point = [p[0] + ((q[0] - p[0]) * i) / steps, p[1] + ((q[1] - p[1]) * i) / steps];
    if (dist(s, p) < SAME || dist(s, q) < SAME) continue;
    const hit = g.buildings.find((b) =>
      b.outlines.some((r) => pointInRing(s, r) && dist(s, nearestWall(s, r)) > ON_WALL),
    );
    if (hit) return hit.slug;
  }
  return undefined;
}

/**
 * The nearest spot on a real path: not a crosswalk (a door opens onto the sidewalk, never the road) and not another
 * door's link (which would join two buildings by their walls).
 */
function nearestLink(g: Grow, p: Point): { link: number; at: Point; t: number } | undefined {
  let best: { link: number; at: Point; t: number } | undefined;
  g.links.forEach(([a, b, w], link) => {
    const kind = g.ways[w]?.kind;
    if (kind === 'crossing' || kind === 'door') return;
    const near = nearestOn(p, g.points[a] as Point, g.points[b] as Point);
    if (!best || dist(p, near.at) < dist(p, best.at)) best = { link, ...near };
  });
  return best;
}

/** The point on the path under `p`: an end of the nearest link if close to one, else a new point splitting it. */
function pointOnPath(g: Grow, near: { link: number; at: Point; t: number }, key: string): number {
  const [a, b, w] = g.links[near.link] as Link;
  if (dist(near.at, g.points[a] as Point) < SAME) return a;
  if (dist(near.at, g.points[b] as Point) < SAME) return b;
  const s = addPoint(g, key, near.at);
  g.links[near.link] = [a, s, w];
  g.links.push([s, b, w]);
  return s;
}

/** Joins p to the network and returns its point, or records an error and returns undefined. */
function join(g: Grow, p: Point, key: string, label: string): number | undefined {
  const near = nearestLink(g, p);
  const d = near ? dist(p, near.at) : Infinity;
  if (!near || d > MAX_DOOR) {
    g.errors.push(`${label}: the nearest path is ${String(Math.round(d))} m away (at most ${String(MAX_DOOR)})`);
    return undefined;
  }
  if (d <= SAME) return pointOnPath(g, near, key);
  const through = blockedBy(g, p, near.at);
  if (through) {
    g.errors.push(`${label}: the way to the nearest path (${fmt(p)} → ${fmt(near.at)}) goes through ${through}`);
    return undefined;
  }
  const door = addPoint(g, key, p);
  const on = pointOnPath(g, near, `${key}:path`);
  let w = g.ways.findIndex((x) => x.kind === 'door');
  if (w < 0) w = g.ways.push({ kind: 'door' }) - 1;
  g.links.push([door, on, w]);
  return door;
}

function attachGates(g: Grow, gates: readonly GateInput[]): Gate[] {
  return gates.flatMap((gate) => {
    const known = g.keys.indexOf(gate.key);
    const point = known >= 0 ? known : join(g, gate.point, `gate:${gate.id}`, `gate ${gate.id}`);
    return point === undefined ? [] : [{ id: gate.id, name: gate.name, point }];
  });
}

function attachEntrances(g: Grow, entrances: readonly EntranceInput[]): Entrance[] {
  return entrances.flatMap((e, i) => {
    const label = `${e.building} ${e.kind} entrance`;
    const building = g.buildings.find((b) => b.slug === e.building);
    if (!building) {
      g.errors.push(`${label}: ${e.building} is not in buildings.json`);
      return [];
    }
    const wall = building.outlines
      .map((r) => nearestWall(e.point, r))
      .sort((a, b) => dist(e.point, a) - dist(e.point, b))[0];
    if (!wall || dist(e.point, wall) > MAX_PIN) {
      const d = wall ? Math.round(dist(e.point, wall)) : Infinity;
      g.errors.push(`${label}: the pin is ${String(d)} m from the building (at most ${String(MAX_PIN)})`);
      return [];
    }
    const point = join(g, wall, `door:${e.building}:${String(i)}`, label);
    if (point === undefined) return [];
    return [
      {
        building: e.building,
        kind: e.kind,
        point,
        verified: e.verified,
        ...(e.name !== undefined && { name: e.name }),
      },
    ];
  });
}

/** Errors for full buildings with no main entrance pinned; a note for block ones. */
function missingMains(input: AttachInput, errors: string[], notes: string[]): void {
  const pinned = new Set(input.entrances.filter((e) => e.kind === 'main').map((e) => e.building));
  const missing = input.buildings.filter((b) => !pinned.has(b.slug));
  for (const b of missing.filter((b) => b.tier === 'full'))
    errors.push(`${b.slug}: no main entrance in data-src/campus/entrances.json`);
  const blocks = missing.filter((b) => b.tier === 'block').map((b) => b.slug);
  if (blocks.length > 0) notes.push(`entrances: no main entrance yet for ${blocks.join(', ')} (block tier)`);
}

/** Every point reachable from `start` over the links. */
function reachable(g: Grow, start: number): Set<number> {
  const next = new Map<number, number[]>();
  for (const [a, b] of g.links) {
    next.set(a, [...(next.get(a) ?? []), b]);
    next.set(b, [...(next.get(b) ?? []), a]);
  }
  const seen = new Set([start]);
  for (const queue = [start]; queue.length > 0;) {
    for (const n of next.get(queue.pop() as number) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

export function attach(input: AttachInput): AttachResult {
  const n = input.network;
  const g: Grow = {
    points: [...n.points],
    keys: [...n.keys],
    ways: [...n.ways],
    links: n.links.map((l): Link => [...l]),
    buildings: input.buildings,
    errors: [],
  };
  const notes: string[] = [];
  const gates = attachGates(g, input.gates);
  const entrances = attachEntrances(g, input.entrances);
  missingMains(input, g.errors, notes);

  const [first] = gates;
  if (!first) g.errors.push('walk: no gates');
  else {
    const seen = reachable(g, first.point);
    const away = [
      ...gates.filter((x) => !seen.has(x.point)).map((x) => x.id),
      ...entrances.filter((e) => !seen.has(e.point)).map((e) => `${e.building} ${e.kind} entrance`),
    ];
    if (away.length > 0) g.errors.push(`walk: ${away.join(', ')} can't be reached from ${first.id}`);
  }
  const walk: Walk = { points: g.points.flatMap(([x, y]) => [round(x), round(y)]), ways: g.ways, links: g.links };
  return { walk, gates, entrances, errors: g.errors, notes };
}
