// The campus meeting point between the lanes (docs/SPLIT.md): Lane B's compiler (2b) writes public/data/campus.json
// in this shape, and Lane A's scene (2c) reads it. The loader validates it with campusSchema before use.
// Additive changes only after 2c starts: the walk network, gates and entrances joined in 4a that way.
import { z } from './zod.ts';

/** A flat list of x, y pairs in meters: `[x0, y0, x1, y1, …]`. */
const flatPoints = (minPoints: number) =>
  z
    .array(z.number()) // Zod 4 already rejects NaN and Infinity
    .refine((a) => a.length % 2 === 0, 'needs an even number of values (x, y pairs)')
    .refine((a) => a.length >= minPoints * 2, `needs at least ${String(minPoints)} points`);

/** A closed outline, not repeating its first point: at least 3 points. */
export const ringSchema = flatPoints(3);
/** An open line: at least 2 points. */
export const lineSchema = flatPoints(2);

/** One extruded block: the outline raised from `base` to `top`, in meters above the ground. */
export const volumeSchema = z
  .strictObject({ outline: ringSchema, base: z.number().min(0), top: z.number().positive() })
  .refine((v) => v.top > v.base, 'top must be above base');

const prefix = z.string().regex(/^[A-Z]+$/);

export const buildingSchema = z
  .strictObject({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    short: z.string().min(1),
    /** Other names students search by ("Andrew", "Gonzalez Hall"). */
    aliases: z.array(z.string().min(1)),
    /** `full`: interiors traced (v1's 10). `block`: outside only (D20). */
    tier: z.enum(['full', 'block']),
    /** Canonical prefix first (ARCHITECTURE §3.3). Empty for buildings without room codes, like Connon. */
    prefixes: z.array(prefix),
    /** Printed on the building's signs but only suggested, never accepted (D25). */
    suggestPrefixes: z.array(prefix).optional(),
    /** Floor number → the label on its signs, only where seen: `{ "1": "G" }`. Others show as "2F". */
    floorLabels: z.record(z.string().regex(/^\d+$/), z.string().min(1)).optional(),
    levels: z.number().int().positive(),
    /** A podium and a tower are two volumes. The building's own outline comes first, then its parts: `levels`
     *  counts the storeys of that first one. */
    volumes: z.array(volumeSchema).min(1),
  })
  .refine((b) => b.tier === 'block' || b.prefixes.length > 0, 'a full-tier building needs a room prefix');

const slug = z.string().regex(/^[a-z0-9-]+$/);
/** An index into `walk.points`, counted in points, not numbers: point 2 is `points[4], points[5]`. */
const pointIndex = z.int().min(0);

/**
 * The walking network (4a), joined to entrances and gates. Straight links between points; their lengths are worked
 * out from the points. Routing (4b) runs on it and the direction text (4c) names its ways.
 */
export const walkSchema = z.strictObject({
  /** Every point of the network as flat x, y pairs. Entrances and gates are points too. */
  points: z.array(z.number()).refine((a) => a.length % 2 === 0, 'needs an even number of values (x, y pairs)'),
  /** What a link is part of. `sidewalk` is drawn beside Taft Avenue, whose two sides meet only at a `crossing`
   *  (D32); a crossing's name is the street it crosses. `door` joins an entrance or a gate to the nearest path. */
  ways: z.array(
    z.strictObject({
      kind: z.enum(['path', 'steps', 'street', 'sidewalk', 'crossing', 'door']),
      name: z.string().min(1).optional(),
      covered: z.literal(true).optional(),
    }),
  ),
  /** `[from point, to point, way]`. Walkable both ways. */
  links: z.array(z.tuple([pointIndex, pointIndex, z.int().min(0)])),
});

export const gateSchema = z.strictObject({
  /** Stable id for deep links and the picker: `gate-1`, `agno`. */
  id: slug,
  /** As students say it: `Gate 2 (North)`. */
  name: z.string().min(1),
  point: pointIndex,
});

export const entranceSchema = z.strictObject({
  /** Building slug. */
  building: slug,
  kind: z.enum(['main', 'side', 'back']),
  point: pointIndex,
  /** False until checked on site (11a). Directions to it end in "(approximate)" (O6). */
  verified: z.boolean(),
  /** Where it opens to, when a building has more than one of a kind: `to SJ Walk`. */
  name: z.string().min(1).optional(),
});

const campusFields = z.strictObject({
  /** The OSM snapshot date, `YYYY-MM-DD`. */
  snapshot: z.iso.date(),
  /** Shown on the map and in About (D4). */
  attribution: z.literal('© OpenStreetMap contributors (ODbL)'),
  /** The point at x = 0, y = 0. x is meters east, y is meters north. */
  origin: z.strictObject({ lon: z.number().min(-180).max(180), lat: z.number().min(-90).max(90) }),
  /** The campus boundary. Several rings: Andrew and Razon sit across the street from the main campus. */
  campus: z.array(ringSchema).min(1),
  /** Tappable campus buildings. */
  buildings: z.array(buildingSchema).min(1),
  /** Skybridges: drawn, not tappable. Which floors they join comes with the indoor graph (8a). */
  bridges: z.array(volumeSchema),
  /** Surrounding city blocks: muted, not tappable, hidden on the lowest quality tier. */
  city: z.array(z.strictObject({ outline: ringSchema, top: z.number().positive() })),
  /** Lines on the ground, cut at the edge of the map. `rail` is the LRT Line 1 viaduct over Taft Avenue: a landmark,
   *  never walked on. */
  paths: z.array(
    z.strictObject({
      kind: z.enum(['street', 'road', 'foot', 'rail']),
      name: z.string().min(1).optional(),
      line: lineSchema,
    }),
  ),
  walk: walkSchema,
  /** The named gates, for "I'm outside" in Where are you (S4). */
  gates: z.array(gateSchema),
  entrances: z.array(entranceSchema),
});

type CampusFields = z.infer<typeof campusFields>;

/** Every index points at something that exists, so routing never meets a dangling link. */
function checkReferences(c: CampusFields, ctx: z.RefinementCtx): void {
  const points = c.walk.points.length / 2;
  const issue = (path: (string | number)[], message: string) => {
    ctx.addIssue({ code: 'custom', path, message });
  };
  c.walk.links.forEach(([a, b, way], i) => {
    if (a >= points || b >= points) issue(['walk', 'links', i], `has a point past the last (${String(points)})`);
    if (a === b) issue(['walk', 'links', i], 'joins a point to itself');
    if (way >= c.walk.ways.length) issue(['walk', 'links', i], 'has a way that does not exist');
  });
  const ids = new Set<string>();
  c.gates.forEach((g, i) => {
    if (g.point >= points) issue(['gates', i, 'point'], 'is not a walk point');
    if (ids.has(g.id)) issue(['gates', i, 'id'], `${g.id} is used twice`);
    ids.add(g.id);
  });
  const slugs = new Set(c.buildings.map((b) => b.slug));
  c.entrances.forEach((e, i) => {
    if (e.point >= points) issue(['entrances', i, 'point'], 'is not a walk point');
    if (!slugs.has(e.building)) issue(['entrances', i, 'building'], `${e.building} is not a building`);
  });
}

export const campusSchema = campusFields.superRefine(checkReferences);

export type Campus = z.infer<typeof campusSchema>;
export type Walk = Campus['walk'];
export type Gate = z.infer<typeof gateSchema>;
export type Entrance = z.infer<typeof entranceSchema>;
export type CampusBuilding = z.infer<typeof buildingSchema>;
export type Volume = z.infer<typeof volumeSchema>;
export type CampusPath = Campus['paths'][number];
