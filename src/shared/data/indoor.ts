// The floor-files meeting point between the lanes (docs/SPLIT.md): Lane B's compiler (6b) writes one
// public/data/buildings/<slug>.json per building that has floor files, and Lane A's floor builder and indoor view
// (6c, 7a) read it. Same frame as campus.json. 8a added the indoor graph, rooms, stairs, elevators and entrances as new
// fields, without changing the floors; 8b routes on the graph and 8c draws its steps.
import { z } from './zod.ts';
import { lineSchema } from './campus.ts';

export const indoorFloorSchema = z.strictObject({
  /** Floor number, G = 1. Its label comes from the building's `floorLabels` in campus.json. */
  floor: z.int().min(1),
  /** Height of this floor's slab above the ground, meters. */
  base: z.number().min(0),
  /** Slab to slab, meters: how tall to raise this floor's walls. */
  height: z.number().positive(),
  /** False until the owner checks the 3D preview. The beta can show unchecked floors; launch needs all checked. */
  checked: z.boolean(),
  /** One line per wall, x meters east and y meters north of campus.json's origin. Raise each from `base`. */
  walls: z.array(lineSchema),
  /** Hallway centre lines, from the evacuation route. Drawn on the floor; routing uses them from 8a. */
  hallways: z.array(lineSchema),
});

/** A building slug, as in campus.json. Also names the file, so the loader checks it before building a path. */
export const slugSchema = z.string().regex(/^[a-z0-9-]+$/);

const pointIndex = z.int().min(0);

/**
 * Every floor's walkable lines as one graph (8a). Straight links between points; a link's length is worked out from
 * its points, except `stairs` and `elevator` links, which join one floor to another at the same spot and cost by
 * the floors they cross (D34). `door` joins a room's door to its hallway, `entrance` a building entrance on G.
 */
export const indoorGraphSchema = z.strictObject({
  /** Flat x, y pairs in meters, as the walls. */
  points: z.array(z.number()).refine((a) => a.length % 2 === 0, 'needs an even number of values (x, y pairs)'),
  /** The floor of each point. */
  floors: z.array(z.int().min(1)),
  links: z.array(z.tuple([pointIndex, pointIndex, z.enum(['hall', 'door', 'stairs', 'elevator', 'entrance'])])),
});

export const indoorRoomSchema = z.strictObject({
  /** Canonical code, as in rooms.json. */
  code: z.string().regex(/^[A-Z]+[1-9]\d{2,3}[A-Z]?$/),
  floor: z.int().min(1),
  /** Where its number goes, x, y meters. */
  label: z.tuple([z.number(), z.number()]),
  /** Its doors: graph points on its floor. A route to the room ends at the nearest. */
  doors: z.array(pointIndex).min(1),
});

export const verticalSchema = z.strictObject({
  /** `east-stairs`: unique within the building. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(['stairs', 'elevator']),
  /** Every floor it stops at, lowest first, traced or not. */
  servesFloors: z.array(z.int().min(1)).min(2),
  /** Where it is on each traced, labelled floor it serves, lowest first: a graph point on that floor. */
  stops: z.array(z.strictObject({ floor: z.int().min(1), point: pointIndex })),
});

export const indoorEntranceSchema = z.strictObject({
  /** Its index in campus.json's `entrances`; both files come from the same build. */
  entrance: pointIndex,
  /** Where it joins the G floor: a graph point. */
  point: pointIndex,
});

export const indoorSchema = z
  .strictObject({
    /** Building slug, as in campus.json. */
    building: slugSchema,
    /** Only the floors traced so far, lowest first. */
    floors: z.array(indoorFloorSchema).min(1),
    graph: indoorGraphSchema,
    /** The rooms on the labelled floors, by code. */
    rooms: z.array(indoorRoomSchema),
    verticals: z.array(verticalSchema),
    /** Its entrances, once G is traced. */
    entrances: z.array(indoorEntranceSchema),
  })
  .refine(
    (b) => b.floors.every((f, i) => i === 0 || f.floor > (b.floors[i - 1]?.floor ?? 0)),
    'floors must be lowest first, each once',
  )
  .superRefine(checkGraph);

interface GraphFields {
  readonly floors: readonly { floor: number }[];
  readonly graph: z.infer<typeof indoorGraphSchema>;
  readonly rooms: readonly z.infer<typeof indoorRoomSchema>[];
  readonly verticals: readonly z.infer<typeof verticalSchema>[];
  readonly entrances: readonly z.infer<typeof indoorEntranceSchema>[];
}

type Issue = (path: (string | number)[], message: string) => void;

/** Points on the file's floors; each link between two of them, once; only stairs and elevators change floor. */
function checkLinks(b: GraphFields, issue: Issue): void {
  const { points, floors, links } = b.graph;
  const traced = new Set(b.floors.map((f) => f.floor));
  if (floors.length !== points.length / 2) issue(['graph', 'floors'], 'needs one floor per point');
  if (!floors.every((f) => traced.has(f))) issue(['graph', 'floors'], 'needs floors that are in the file');
  const seen = new Set<string>();
  for (const [n, [a, c, kind]] of links.entries()) {
    if (a >= floors.length || c >= floors.length || a === c) {
      issue(['graph', 'links', n], 'needs two different points that exist');
    }
    const between = floors[a] !== floors[c];
    if (between !== (kind === 'stairs' || kind === 'elevator')) {
      issue(['graph', 'links', n], 'only stairs and elevator links join two floors, and they always do');
    }
    const key = a < c ? `${String(a)}-${String(c)}` : `${String(c)}-${String(a)}`;
    if (seen.has(key)) issue(['graph', 'links', n], 'the same two points are already linked');
    seen.add(key);
  }
}

/** Every room, stop and entrance on a point of its own floor, so routing never meets a dangling index. */
function checkGraph(b: GraphFields, ctx: z.RefinementCtx): void {
  const issue: Issue = (path, message) => {
    ctx.addIssue({ code: 'custom', path, message });
  };
  checkLinks(b, issue);
  const { floors } = b.graph;
  const at = (i: number, floor: number) => i < floors.length && floors[i] === floor;
  for (const [n, r] of b.rooms.entries()) {
    if (!r.doors.every((d) => at(d, r.floor))) issue(['rooms', n, 'doors'], "needs points on the room's floor");
  }
  if (new Set(b.rooms.map((r) => r.code)).size !== b.rooms.length) issue(['rooms'], 'each room code once');
  if (new Set(b.verticals.map((v) => v.id)).size !== b.verticals.length) issue(['verticals'], 'each id once');
  for (const [n, v] of b.verticals.entries()) {
    if (!v.stops.every((s, k) => k === 0 || s.floor > (v.stops[k - 1]?.floor ?? 0))) {
      issue(['verticals', n, 'stops'], 'lowest floor first, each floor once');
    }
    for (const [k, s] of v.stops.entries()) {
      if (!at(s.point, s.floor) || !v.servesFloors.includes(s.floor)) {
        issue(['verticals', n, 'stops', k], 'needs a point on a floor it serves');
      }
    }
  }
  for (const [n, e] of b.entrances.entries()) {
    if (!at(e.point, 1)) issue(['entrances', n, 'point'], 'needs a point on G');
  }
}

export type Indoor = z.infer<typeof indoorSchema>;
export type IndoorFloor = z.infer<typeof indoorFloorSchema>;
export type IndoorGraph = z.infer<typeof indoorGraphSchema>;
export type IndoorRoom = z.infer<typeof indoorRoomSchema>;
export type Vertical = z.infer<typeof verticalSchema>;
