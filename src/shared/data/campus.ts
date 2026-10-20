// The campus meeting point between the lanes (docs/SPLIT.md): Lane B's compiler (2b) writes public/data/campus.json
// in this shape, and Lane A's scene (2c) reads it. The loader validates it with campusSchema before use.
// Additive changes only after 2c starts: gates, entrances and walkways join in 4a without touching these fields.
import { z } from 'zod';

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
    /** A podium and a tower are two volumes. */
    volumes: z.array(volumeSchema).min(1),
  })
  .refine((b) => b.tier === 'block' || b.prefixes.length > 0, 'a full-tier building needs a room prefix');

export const campusSchema = z.strictObject({
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
  paths: z.array(
    z.strictObject({
      kind: z.enum(['street', 'road', 'foot']),
      name: z.string().min(1).optional(),
      line: lineSchema,
    }),
  ),
});

export type Campus = z.infer<typeof campusSchema>;
export type CampusBuilding = z.infer<typeof buildingSchema>;
export type Volume = z.infer<typeof volumeSchema>;
export type CampusPath = Campus['paths'][number];
