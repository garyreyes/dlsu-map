// 4b: the router behind docs/SPLIT.md's Routes meeting point. Built once from the loaded data, then called on every
// Start or route-option change. Pure: no React, no fetch. Costs and the door rule: D34. 8b (D41): with a building's
// file, the route goes inside, and the door is the one that's cheapest for the whole trip, inside and out.
import { AUTO_ELEVATOR_FLOORS } from '@/shared/config/routing';
import type { Campus, CampusBuilding, Entrance } from '@/shared/data/campus';
import type { Room } from '@/shared/data/rooms';
import type { FloorMode, From, IndoorFiles, Leg, RouteResult, Router, Step, To, WalkEnd } from '@/shared/data/route';
import { createDirections, type Directions } from './directions.ts';
import { floorsLeg } from './floors.ts';
import { indoorModel, type Climb, type IndoorModel, type IndoorPath } from './indoor-graph.ts';
import { indoorChunk, type Chunk } from './indoor-route.ts';
import { shownMeters } from './turns.ts';
import { buildWalkGraph, cheapestWalk, type EndCosts, type WalkGraph } from './walk-graph.ts';

/** What the router reads from `campus.json`. The full Campus fits; the tests pass less. */
export type RouterCampus = Pick<Campus, 'walk' | 'gates' | 'entrances'> & {
  readonly buildings: readonly Pick<
    CampusBuilding,
    'slug' | 'name' | 'short' | 'tier' | 'levels' | 'floorLabels' | 'volumes'
  >[];
};
export interface RouterRooms {
  readonly rooms: readonly Pick<Room, 'code' | 'building' | 'floor'>[];
}

/** A walk point where a route can start or end, and what to call it. */
interface Opening {
  readonly point: number;
  readonly end: WalkEnd;
  /** A door's index in campus.json's `entrances`, which the building file joins to its G floor. */
  readonly entrance?: number;
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
  /** Assumed for a building without a file (PROJECT_FACTS "Routing"): every full building has an elevator. */
  hasElevator(building: string): boolean;
}

/** Where a trip starts or ends inside a building with a labelled floor plan. */
interface Inside {
  readonly model: IndoorModel;
  readonly floor: number;
  readonly points: readonly number[];
  /** The room at this end. */
  readonly room?: string;
  /** What the start step calls it: "AL101", "the elevator", "the main entrance". */
  readonly name: string;
}
/** null when this end needs no walk inside (a gate, a building's door), 'missing' when it needs one but has no plan. */
type End = Inside | null | 'missing';

/** Legs with their steps, once their place among the legs is known (`first`). `lead`: see Chunk. */
type Part = Pick<Chunk, 'legs' | 'steps'> & { readonly lead?: number };

interface Trip {
  readonly from: From;
  readonly to: To;
  readonly mode: FloorMode;
  readonly files: IndoorFiles;
  readonly a: Spot;
  readonly b: Spot & { readonly building: string };
}

interface Context {
  readonly g: WalkGraph;
  readonly places: Places;
  readonly directions: Directions;
}

export function createRouter(campus: RouterCampus, rooms: RouterRooms): Router {
  const g = buildWalkGraph(campus.walk);
  const ctx: Context = {
    g,
    places: placesOf(campus, rooms, g),
    directions: createDirections(campus.walk, g, campus.buildings),
  };
  return (from, to, mode, files = new Map()) => {
    const a = ctx.places.from(from);
    const b = ctx.places.to(to);
    if (a === null || b === null || b.building === undefined) return { ok: false, reason: 'unknown-place' };
    if (from.kind === 'room' && to.kind === 'room' && from.code === to.code) return { ok: false, reason: 'same-room' };
    const trip: Trip = { from, to, mode, files, a, b: { ...b, building: b.building } };
    return a.building === b.building ? within(ctx, trip) : between(ctx, trip);
  };
}

/** Stairs or elevator for a climb between two floors (D34), and whether the elevator was asked for in vain. */
function climbOf(mode: FloorMode, from: number, to: number, hasElevator: boolean) {
  const wants = mode === 'elevator' || (mode === 'auto' && Math.abs(to - from) >= AUTO_ELEVATOR_FLOORS);
  const climb: Climb = wants && hasElevator ? 'elevator' : 'stairs';
  return { climb, noElevator: mode === 'elevator' && !hasElevator };
}

/** Does the building have an elevator: from its file when there is one, else the old assumption. */
function elevatorIn(ctx: Context, trip: Trip, slug: string): boolean {
  const file = trip.files.get(slug);
  return file === undefined ? ctx.places.hasElevator(slug) : indoorModel(file).hasElevator;
}

/** A floors leg as before 8b, with its step. `last`: the leg up to the To room, whose step says the room's floor. */
function floorsPart(ctx: Context, trip: Trip, building: string, f: number, t: number, last: boolean): Part | null {
  const leg = floorsLeg(building, f, t, trip.mode, elevatorIn(ctx, trip, building));
  const room = last && trip.to.kind === 'room' ? trip.to.code : undefined;
  return leg === null ? null : { legs: [leg], steps: (i) => [ctx.directions.floors(leg, i, room)] };
}

/** Inside one building: a path through its plan when both ends have one, else a floors leg as before 8b. */
function within(ctx: Context, trip: Trip): RouteResult {
  const { a, b } = trip;
  const ia = insideFrom(trip, true);
  const ib = insideTo(trip);
  if (isInside(ia) && isInside(ib)) {
    const { climb, noElevator } = climbOf(trip.mode, ia.floor, ib.floor, ia.model.hasElevator);
    const path = ia.model.search(ia.points, ib.points, climb);
    if (path !== null) return done(compact([chunkOf(ctx, ia, ib, path, noElevator)]), []);
  }
  // Here with both ends inside means the plan doesn't join them: route as before 8b, and say so.
  const failed = ia === 'missing' || ib === 'missing' || (isInside(ia) && isInside(ib));
  const missing = failed ? [b.building] : [];
  return done(compact([floorsPart(ctx, trip, b.building, a.floor, b.floor, true)]), missing);
}

/** Between two buildings, or from a gate: inside (or down) at A, the walk, inside (or up) at B. */
function between(ctx: Context, trip: Trip): RouteResult {
  const { a, b } = trip;
  const outA = exits(trip, insideFrom(trip, false), a, 'out');
  const inB = exits(trip, insideTo(trip), b, 'in');
  const walk = walkLeg(ctx.g, a, b, { starts: outA.costs, targets: inB.costs });
  if (walk === null) return { ok: false, reason: 'no-route' };
  const outdoors: Part = {
    legs: [walk.leg],
    steps: (i) => ctx.directions.walk(walk.points, walk.leg.from, walk.to, i),
  };
  const before =
    a.building === undefined
      ? null
      : outA.inside === null
        ? floorsPart(ctx, trip, a.building, a.floor, 1, false)
        : chunkOf(ctx, outA.inside, null, outA.paths[walk.first] ?? null, outA.noElevator);
  const after =
    inB.inside === null
      ? floorsPart(ctx, trip, b.building, 1, b.floor, true)
      : chunkOf(ctx, null, inB.inside, inB.paths[walk.last] ?? null, inB.noElevator);
  const missing = [...(outA.missing ? [a.building ?? ''] : []), ...(inB.missing ? [b.building] : [])];
  return done(compact([before, outdoors, after]), missing);
}

interface Exits {
  /** The trip's end inside, when its plan joins at least one door. */
  readonly inside: Inside | null;
  /** By opening: the path between the end and that door, or null. */
  readonly paths: readonly (IndoorPath | null)[];
  /** By opening: what that path costs, for choosing the door. Infinity when there's none. */
  readonly costs: readonly number[];
  readonly noElevator: boolean;
  /** The end needs a walk inside but has no plan for it. */
  readonly missing: boolean;
}

/** The ways between an end inside a building and each of the building's doors: `out` from the end, `in` to it. */
function exits(trip: Trip, end: End, spot: Spot, way: 'out' | 'in'): Exits {
  const none = { inside: null, paths: [], costs: [], noElevator: false };
  if (!isInside(end)) return { ...none, missing: end === 'missing' };
  const { climb, noElevator } = climbOf(trip.mode, end.floor, 1, end.model.hasElevator);
  const paths = spot.openings.map((o) => {
    const door = o.entrance === undefined ? undefined : end.model.entrance(o.entrance);
    if (door === undefined) return null;
    return way === 'out' ? end.model.search(end.points, [door], climb) : end.model.search([door], end.points, climb);
  });
  if (paths.every((p) => p === null)) return { ...none, missing: true };
  return { inside: end, paths, costs: paths.map((p) => p?.cost ?? Infinity), noElevator, missing: false };
}

/** The legs and steps of a path through a building, from A's end (`ia`) or to B's (`ib`), or both. */
function chunkOf(
  ctx: Context,
  ia: Inside | null,
  ib: Inside | null,
  path: IndoorPath | null,
  noElevator: boolean,
): Part | null {
  const model = ia?.model ?? ib?.model;
  if (path === null || model === undefined) return null;
  const skip = [ia?.room, ib?.room].filter((r) => r !== undefined);
  const opts = {
    building: model.file.building,
    noElevator,
    skip,
    ...(ia === null ? {} : { start: ia.name }),
    ...(ib?.room === undefined ? {} : { room: ib.room }),
  };
  return indoorChunk(model, path.points, opts, ctx.directions);
}

const isInside = (end: End): end is Inside => end !== null && end !== 'missing';

/** The From end inside its building. A G tap needs one only for a room in the same building (`same`). */
function insideFrom(trip: Trip, same: boolean): End {
  const { from, files, a } = trip;
  if (from.kind === 'gate' || a.building === undefined) return null;
  const file = files.get(a.building);
  if (from.kind === 'room') return file === undefined ? 'missing' : roomEnd(indoorModel(file), from.code, a.floor);
  if (a.floor === 1 && !(same && trip.to.kind === 'room')) return null;
  if (file === undefined) return 'missing';
  const model = indoorModel(file);
  if (a.floor === 1) {
    const points = a.openings.flatMap((o) => (o.entrance === undefined ? [] : [model.entrance(o.entrance) ?? -1]));
    const joined = points.filter((p) => p >= 0);
    return joined.length === 0 ? 'missing' : { model, floor: 1, points: joined, name: 'the main entrance' };
  }
  // PRD UC2: an upper floor starts at its elevator lobby; without an elevator there, at the first stairs listed.
  const stops = model.file.verticals.flatMap((v) => v.stops.filter((s) => s.floor === a.floor).map((s) => ({ v, s })));
  const stop = stops.find((x) => x.v.kind === 'elevator') ?? stops[0];
  if (stop === undefined) return 'missing';
  return { model, floor: a.floor, points: [stop.s.point], name: `the ${stop.v.id.split('-').join(' ')}` };
}

/** The To end inside its building: a room's doors. A building as To needs none. */
function insideTo(trip: Trip): End {
  const { to, files, b } = trip;
  if (to.kind === 'building') return null;
  const file = files.get(b.building);
  return file === undefined ? 'missing' : roomEnd(indoorModel(file), to.code, b.floor);
}

function roomEnd(model: IndoorModel, code: string, floor: number): End {
  const room = model.file.rooms.find((r) => r.code === code);
  return room === undefined ? 'missing' : { model, floor, points: room.doors, room: code, name: code };
}

function placesOf(campus: RouterCampus, rooms: RouterRooms, g: WalkGraph): Places {
  const buildings = new Map(campus.buildings.map((b) => [b.slug, b]));
  const roomByCode = new Map(rooms.rooms.map((r) => [r.code, r]));
  const door = (e: Entrance, entrance: number): Opening => ({
    point: e.point,
    entrance,
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
    const all = campus.entrances.flatMap((e, i) => (e.building === slug ? [door(e, i)] : []));
    const mains = all.filter((o) => o.end.kind === 'door' && o.end.door === 'main');
    const usable = leaving && floor === 1 && mains.length > 0 ? mains : all;
    return { building: slug, floor, openings: usable };
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

interface Outdoors {
  readonly leg: Leg & { readonly kind: 'walk' };
  /** The walk points, for the directions. */
  readonly points: readonly number[];
  readonly to: Extract<WalkEnd, { kind: 'door' }>;
  /** Which of A's and B's openings it uses. */
  readonly first: number;
  readonly last: number;
}

/** The outdoor leg between two spots, or null if nothing joins them (or one has no doors). */
function walkLeg(g: WalkGraph, a: Spot, b: Spot, ends: EndCosts): Outdoors | null {
  const walk = cheapestWalk(
    g,
    a.openings.map((o) => o.point),
    b.openings.map((o) => o.point),
    ends,
  );
  // Openings are told apart by their walk point; two doors on one point cost the same, so the first will do.
  const first = a.openings.findIndex((o, i) => o.point === walk?.points[0] && (ends.starts[i] ?? 0) !== Infinity);
  const last = b.openings.findIndex((o, i) => o.point === walk?.points.at(-1) && (ends.targets[i] ?? 0) !== Infinity);
  const to = b.openings[last]?.end;
  const from = a.openings[first]?.end;
  // A To spot is always a building, so its openings are doors.
  if (walk === null || from === undefined || to === undefined || to.kind !== 'door') return null;
  const path = walk.points.map((p) => g.at(p));
  const leg = { kind: 'walk', from, to, path, meters: walk.meters, seconds: walk.seconds } as const;
  return { leg, points: walk.points, to, first, last };
}

/** Totals come from the unrounded legs; each number is rounded to a whole once, here. An enter step followed by a
 *  walk inside gets that walk's meters (the part's `lead`). */
function done(parts: readonly Part[], missing: readonly string[]): RouteResult {
  const legs: Leg[] = [];
  const steps: Step[] = [];
  for (const part of parts) {
    const own = part.steps(legs.length);
    const prev = steps.at(-1);
    if (part.lead !== undefined && prev?.kind === 'enter')
      steps[steps.length - 1] = { ...prev, meters: shownMeters(part.lead) };
    legs.push(...part.legs);
    steps.push(...own);
  }
  const walked = (l: Leg) => (l.kind === 'walk' || l.kind === 'indoor' ? l.meters : 0);
  const meters = legs.reduce((m, l) => m + walked(l), 0);
  const seconds = legs.reduce((s, l) => s + l.seconds, 0);
  const rounded = legs.map((l) =>
    l.kind === 'walk' || l.kind === 'indoor'
      ? { ...l, meters: Math.round(l.meters), seconds: Math.round(l.seconds) }
      : l,
  );
  const route = { legs: rounded, steps, meters: Math.round(meters), seconds: Math.round(seconds) };
  return { ok: true, route: missing.length === 0 ? route : { ...route, noIndoorMap: [...new Set(missing)] } };
}

const compact = (parts: readonly (Part | null)[]): Part[] => parts.filter((p) => p !== null);
