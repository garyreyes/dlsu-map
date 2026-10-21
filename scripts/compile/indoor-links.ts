// One building's labelled floors, already in meters → its rooms, stairs, elevators and entrances on the indoor graph
// (8a), with the build checks of ARCHITECTURE §3.4: every door near a hallway, every vertical on real floors, every
// room on its list and every room reachable from every main entrance. A floor without `rooms` (or `verticals`) is not
// labelled yet and asks nothing. Pure. Tests: indoor-links.test.ts.
import type { VerticalSource } from '../../src/shared/data/floor-source.ts';
import type { IndoorRoom, Vertical } from '../../src/shared/data/indoor.ts';
import { round, type Point } from './geometry.ts';
import { buildGraph, reachable, type Attach, type Built, type GraphLink, type IndoorGraph } from './indoor-graph.ts';

/** ARCHITECTURE §3.4: a door further than this from every hallway was placed wrong, or a hallway is missing. */
const DOOR_REACH = 3;
/** An entrance pin sits on the outer wall, and a lobby can lie between it and the hallway line. STRC's main pin is
 *  2.3 m from its G hallway (2026-10-21). */
const ENTRANCE_REACH = 5;

export interface LabelledFloor {
  readonly path: string;
  readonly floor: number;
  readonly hallways: readonly (readonly Point[])[];
  readonly rooms?: readonly { codes: readonly string[]; label: Point; doors: readonly Point[] }[];
  readonly verticals?: readonly { id: string; point: Point }[];
}

export interface LinkInput {
  readonly slug: string;
  readonly levels: number;
  readonly floors: readonly LabelledFloor[];
  /** The building's verticals.json, or an empty list at the path it would have. */
  readonly verticals: { readonly path: string; readonly list: readonly VerticalSource[] };
  /** This building's rooms from its room list. One with its own `floorLabel` (a mezzanine) needn't be placed. */
  readonly rooms: readonly { code: string; floor: number; floorLabel?: string }[];
  /** This building's entrances, with their index in campus.json's `entrances`. */
  readonly entrances: readonly { index: number; kind: 'main' | 'side' | 'back'; point: Point }[];
}

export interface LinkResult {
  readonly graph: IndoorGraph;
  readonly rooms: IndoorRoom[];
  readonly verticals: Vertical[];
  readonly entrances: { entrance: number; point: number }[];
  readonly errors: string[];
  readonly notes: string[];
}

type Tag =
  | {
      readonly is: 'door';
      readonly path: string;
      readonly floor: number;
      readonly codes: string[];
      readonly room: number;
    }
  | { readonly is: 'vertical'; readonly path: string; readonly floor: number; readonly id: string }
  | { readonly is: 'entrance'; readonly index: number; readonly kind: string };

/** How far something is from a hallway, for a message; `onG` for an entrance, which only joins the G floor. */
const far = (d: number, most: number, onG = false) =>
  d === Infinity
    ? `on ${onG ? 'a G floor' : 'a floor'} with no hallway`
    : `${String(round(d))} m from ${onG ? "G's" : 'the'} nearest hallway (${String(most)} m at most)`;

/** The codes of each placed room that are on this floor's list; the others are reported. */
function checkRooms(input: LinkInput, f: LabelledFloor, errors: string[]): string[][] {
  if (!f.rooms) return [];
  const floorOf = new Map(input.rooms.map((r) => [r.code, r.floor]));
  const placed = new Set(f.rooms.flatMap((r) => r.codes));
  const valid = f.rooms.map((r) =>
    r.codes.filter((code) => {
      const on = floorOf.get(code);
      if (on === undefined) errors.push(`${f.path}: ${code} is not on ${input.slug}'s room list`);
      else if (on !== f.floor)
        errors.push(`${f.path}: ${code} is on floor ${String(on)}'s room list, not floor ${String(f.floor)}'s`);
      return on === f.floor;
    }),
  );
  for (const r of input.rooms.filter((x) => x.floor === f.floor && !x.floorLabel && !placed.has(x.code))) {
    errors.push(`${f.path}: ${r.code} is on floor ${String(f.floor)}'s room list but not placed`);
  }
  return valid;
}

function checkVerticals(input: LinkInput, errors: string[]): void {
  const { path, list } = input.verticals;
  for (const v of list) {
    for (const n of v.servesFloors.filter((s) => s > input.levels)) {
      errors.push(`${path}: ${v.id} serves floor ${String(n)}, but ${input.slug} has ${String(input.levels)} floors`);
    }
  }
  for (const f of input.floors.filter((x) => x.verticals)) {
    const placed = new Set(f.verticals?.map((v) => v.id));
    for (const p of f.verticals ?? []) {
      const v = list.find((x) => x.id === p.id);
      if (!v) errors.push(`${f.path}: ${p.id} is not in ${path}`);
      else if (!v.servesFloors.includes(f.floor))
        errors.push(`${f.path}: ${p.id} does not stop at floor ${String(f.floor)} (${path})`);
    }
    for (const v of list.filter((x) => x.servesFloors.includes(f.floor) && !placed.has(x.id))) {
      errors.push(`${f.path}: ${v.id} stops at floor ${String(f.floor)} but is not placed`);
    }
  }
}

/** Everything to hang off the hallways, each with what it is, for the results and the messages. */
function attachments(
  input: LinkInput,
  errors: string[],
): { attach: Attach[]; tags: Tag[]; rooms: { f: LabelledFloor; codes: string[]; label: Point }[] } {
  const attach: Attach[] = [];
  const tags: Tag[] = [];
  const rooms: { f: LabelledFloor; codes: string[]; label: Point }[] = [];
  const known = new Set(input.verticals.list.map((v) => v.id));
  for (const f of input.floors) {
    for (const [i, codes] of checkRooms(input, f, errors).entries()) {
      const room = f.rooms?.[i];
      if (!room || codes.length === 0) continue;
      rooms.push({ f, codes, label: room.label });
      for (const door of room.doors) {
        attach.push({ floor: f.floor, point: door, kind: 'door', within: DOOR_REACH });
        tags.push({ is: 'door', path: f.path, floor: f.floor, codes, room: rooms.length - 1 });
      }
    }
    for (const v of f.verticals ?? []) {
      if (!known.has(v.id)) continue;
      attach.push({ floor: f.floor, point: v.point, kind: 'hall', within: DOOR_REACH });
      tags.push({ is: 'vertical', path: f.path, floor: f.floor, id: v.id });
    }
  }
  if (input.floors.some((f) => f.floor === 1)) {
    for (const e of input.entrances) {
      attach.push({ floor: 1, point: e.point, kind: 'entrance', within: ENTRANCE_REACH });
      tags.push({ is: 'entrance', index: e.index, kind: e.kind });
    }
  }
  return { attach, tags, rooms };
}

/** How many separate pieces each floor's hallway lines make, for the floors with more than one. */
function pieceNotes(slug: string, graph: IndoorGraph): string[] {
  const halls = graph.links.filter(([, , kind]) => kind === 'hall');
  const hallOnly: IndoorGraph = { ...graph, links: halls };
  const seen = new Set<number>();
  const pieces = new Map<number, number>();
  for (const [a] of halls) {
    if (seen.has(a)) continue;
    for (const n of reachable(hallOnly, a)) seen.add(n);
    const floor = graph.floors[a] ?? 0;
    pieces.set(floor, (pieces.get(floor) ?? 0) + 1);
  }
  return [...pieces]
    .filter(([, n]) => n > 1)
    .sort(([a], [b]) => a - b)
    .map(([floor, n]) => `${slug} floor ${String(floor)}: hallways in ${String(n)} pieces`);
}

function reachErrors(
  slug: string,
  graph: IndoorGraph,
  rooms: readonly IndoorRoom[],
  mains: readonly number[],
): string[] {
  const errors = new Set<string>();
  for (const main of mains) {
    const reached = reachable(graph, main);
    const lost = rooms.filter((r) => !r.doors.some((d) => reached.has(d))).map((r) => r.code);
    if (lost.length > 0) errors.add(`${slug}: can't reach ${lost.join(', ')} from the main entrance`);
  }
  return [...errors];
}

/** Where each attachment landed in the graph, sorted by what it is; the ones too far from a hallway are reported. */
function sortOut(slug: string, tags: readonly Tag[], built: Built, rooms: number, errors: string[]) {
  const doors = Array.from({ length: rooms }, (): number[] => []);
  const stops = new Map<string, { floor: number; point: number }[]>();
  const entrances: { entrance: number; point: number }[] = [];
  const mains: number[] = [];
  for (const [i, tag] of tags.entries()) {
    const node = built.nodes[i] ?? null;
    const distance = built.distances[i] ?? Infinity;
    if (tag.is === 'entrance') {
      if (node === null) errors.push(`${slug}'s ${tag.kind} entrance is ${far(distance, ENTRANCE_REACH, true)}`);
      else entrances.push({ entrance: tag.index, point: node });
      if (node !== null && tag.kind === 'main') mains.push(node);
    } else if (node === null) {
      const what = tag.is === 'door' ? `${tag.codes[0] ?? ''}'s door` : tag.id;
      errors.push(`${tag.path}: ${what} is ${far(distance, DOOR_REACH)}`);
    } else if (tag.is === 'door') doors[tag.room]?.push(node);
    else stops.set(tag.id, [...(stops.get(tag.id) ?? []), { floor: tag.floor, point: node }]);
  }
  return { doors, stops, entrances, mains };
}

export function linkBuilding(input: LinkInput): LinkResult {
  const errors: string[] = [];
  checkVerticals(input, errors);
  const { attach, tags, rooms: placed } = attachments(input, errors);
  const built = buildGraph(input.floors, attach);
  const notes = pieceNotes(input.slug, built.graph);
  const { doors, stops, entrances, mains } = sortOut(input.slug, tags, built, placed.length, errors);
  const rooms = placed
    .flatMap((r, i) =>
      r.codes.map((code) => ({
        code,
        floor: r.f.floor,
        label: [round(r.label[0]), round(r.label[1])] as [number, number],
        doors: doors[i] ?? [],
      })),
    )
    // A room whose every door was too far is already an error; it is left out rather than written doorless.
    .filter((r) => r.doors.length > 0)
    .sort((a, b) => a.code.localeCompare(b.code));
  const verticals = input.verticals.list.map((v) => ({
    ...v,
    servesFloors: [...v.servesFloors],
    stops: [...(stops.get(v.id) ?? [])].sort((a, b) => a.floor - b.floor),
  }));
  const risers: GraphLink[] = verticals.flatMap((v) =>
    v.stops.slice(1).map((s, k): GraphLink => [v.stops[k]?.point ?? s.point, s.point, v.kind]),
  );
  const graph = { ...built.graph, links: [...built.graph.links, ...risers] };
  const noMain = !input.entrances.some((e) => e.kind === 'main');
  if (input.floors.some((f) => f.floor === 1) && noMain && rooms.length > 0) {
    errors.push(`${input.slug}: no main entrance in campus.json, so no room can be checked for reach`);
  } else if (input.floors.some((f) => f.floor === 1)) errors.push(...reachErrors(input.slug, graph, rooms, mains));
  else if (rooms.length > 0) notes.push(`${input.slug}: rooms not checked for reach, since G has no floor file yet`);
  return { graph, rooms, verticals, entrances, errors, notes };
}
