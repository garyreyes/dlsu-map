// 4b: the router behind docs/SPLIT.md's Routes meeting point. Built once from the loaded data, then called on every
// Start or route-option change. Pure: no React, no fetch. Costs and the door rule: D34.
import type { Campus, CampusBuilding, Entrance } from '@/shared/data/campus';
import type { Room } from '@/shared/data/rooms';
import type { From, Leg, RouteResult, Router, To, WalkEnd } from '@/shared/data/route';
import { floorsLeg } from './floors.ts';
import { buildWalkGraph, cheapestWalk, type WalkGraph } from './walk-graph.ts';

/** What the router reads from `campus.json`. The full Campus fits; the tests pass less. */
export type RouterCampus = Pick<Campus, 'walk' | 'gates' | 'entrances'> & {
  readonly buildings: readonly Pick<CampusBuilding, 'slug' | 'tier' | 'levels'>[];
};
export interface RouterRooms {
  readonly rooms: readonly Pick<Room, 'code' | 'building' | 'floor'>[];
}

/** A walk point where a route can start or end, and what to call it. */
interface Opening {
  readonly point: number;
  readonly end: WalkEnd;
}
/** A trip end, found in the data: its building and floor (a gate has no building) and its openings. */
interface Spot {
  readonly building?: string;
  readonly floor: number;
  readonly openings: readonly Opening[];
}
interface Places {
  /** null when the gate, building, room or floor isn't in the data. */
  from(from: From): Spot | null;
  to(to: To): Spot | null;
  /** Assumed until 8a maps the real ones (PROJECT_FACTS "Routing"): every full building has an elevator. */
  hasElevator(building: string): boolean;
}

export function createRouter(campus: RouterCampus, rooms: RouterRooms): Router {
  const g = buildWalkGraph(campus.walk);
  const places = placesOf(campus, rooms, g);
  return (from, to, mode) => {
    const a = places.from(from);
    const b = places.to(to);
    if (a === null || b === null || b.building === undefined) return { ok: false, reason: 'unknown-place' };
    if (from.kind === 'room' && to.kind === 'room' && from.code === to.code) return { ok: false, reason: 'same-room' };
    const floors = (building: string, f: number, t: number) =>
      floorsLeg(building, f, t, mode, places.hasElevator(building));
    if (a.building === b.building) return done(compact([floors(b.building, a.floor, b.floor)]));
    const walk = walkLeg(g, a, b);
    if (walk === null) return { ok: false, reason: 'no-route' };
    const down = a.building === undefined ? null : floors(a.building, a.floor, 1);
    return done(compact([down, walk, floors(b.building, 1, b.floor)]));
  };
}

function placesOf(campus: RouterCampus, rooms: RouterRooms, g: WalkGraph): Places {
  const buildings = new Map(campus.buildings.map((b) => [b.slug, b]));
  const roomByCode = new Map(rooms.rooms.map((r) => [r.code, r]));
  const door = (e: Entrance): Opening => ({
    point: e.point,
    end: {
      kind: 'door',
      building: e.building,
      door: e.kind,
      ...(e.name === undefined ? {} : { name: e.name }),
      verified: e.verified,
      at: g.at(e.point),
    },
  });
  /** Leaving from G starts at the main entrance(s), the PRD's spot default; otherwise any door will do (D34). */
  const inBuilding = (slug: string, floor: number, leaving: boolean): Spot | null => {
    const b = buildings.get(slug);
    if (b === undefined || !Number.isInteger(floor) || floor < 1 || floor > b.levels) return null;
    const all = campus.entrances.filter((e) => e.building === slug);
    const mains = all.filter((e) => e.kind === 'main');
    const usable = leaving && floor === 1 && mains.length > 0 ? mains : all;
    return { building: slug, floor, openings: usable.map(door) };
  };
  const inRoom = (code: string, leaving: boolean): Spot | null => {
    const room = roomByCode.get(code);
    return room === undefined ? null : inBuilding(room.building, room.floor, leaving);
  };
  const atGate = (id: string): Spot | null => {
    const gate = campus.gates.find((x) => x.id === id);
    if (gate === undefined) return null;
    const end = { kind: 'gate', gate: gate.id, name: gate.name, at: g.at(gate.point) } as const;
    return { floor: 1, openings: [{ point: gate.point, end }] };
  };
  return {
    from: (from) => {
      if (from.kind === 'gate') return atGate(from.gate);
      return from.kind === 'room' ? inRoom(from.code, true) : inBuilding(from.building, from.floor, true);
    },
    to: (to) => (to.kind === 'room' ? inRoom(to.code, false) : inBuilding(to.building, 1, false)),
    hasElevator: (slug) => buildings.get(slug)?.tier === 'full',
  };
}

/** The outdoor leg between two spots, or null if nothing joins them (or one has no doors). */
function walkLeg(g: WalkGraph, a: Spot, b: Spot): Leg | null {
  const walk = cheapestWalk(
    g,
    a.openings.map((o) => o.point),
    b.openings.map((o) => o.point),
  );
  const first = a.openings.find((o) => o.point === walk?.points[0]);
  const last = b.openings.find((o) => o.point === walk?.points.at(-1));
  if (walk === null || first === undefined || last === undefined) return null;
  return {
    kind: 'walk',
    from: first.end,
    to: last.end,
    path: walk.points.map((p) => g.at(p)),
    meters: walk.meters,
    seconds: walk.seconds,
  };
}

/** Totals come from the unrounded legs; each number is rounded to a whole once, here. */
function done(legs: readonly Leg[]): RouteResult {
  const meters = legs.reduce((m, l) => m + (l.kind === 'walk' ? l.meters : 0), 0);
  const seconds = legs.reduce((s, l) => s + l.seconds, 0);
  const rounded = legs.map((l) =>
    l.kind === 'walk' ? { ...l, meters: Math.round(l.meters), seconds: Math.round(l.seconds) } : l,
  );
  // 4c's directions fill `steps` (the next PR, `4c-direction-text`); until then a route has none.
  return { ok: true, route: { legs: rounded, steps: [], meters: Math.round(meters), seconds: Math.round(seconds) } };
}

const compact = (legs: readonly (Leg | null)[]): Leg[] => legs.filter((l) => l !== null);
