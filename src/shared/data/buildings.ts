// Schema for data-src/campus/buildings.json: the buildings we author by hand (ARCHITECTURE §3.1). The compiler
// (2b) joins each one to its OSM footprint and writes campus.json. The room-code prefixes live here, and only here.
import { z } from 'zod';

const prefix = z.string().regex(/^[A-Z]+$/);

export const buildingSourceSchema = z
  .strictObject({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    /** OSM elements that make up the footprint, as in the snapshot: `way/22480439`, `relation/6095002`. */
    osm: z.array(z.string().regex(/^(way|relation)\/\d+$/)).min(1),
    name: z.string().min(1),
    short: z.string().min(1),
    /** Other names students search by ("Andrew", "Gonzalez Hall"). */
    aliases: z.array(z.string().min(1)),
    /** `full`: interiors traced (v1's 10). `block`: outside only (D20). */
    tier: z.enum(['full', 'block']),
    /** Canonical prefix first (ARCHITECTURE §3.3). Empty for buildings without room codes. */
    prefixes: z.array(prefix),
    /** Printed on the building's signs but only suggested, never accepted (D25). */
    suggestPrefixes: z.array(prefix).optional(),
    /** Floor number → the label on its signs, only where seen: `{ "1": "G" }`. Others show as "2F". */
    floorLabels: z.record(z.string().regex(/^\d+$/), z.string().min(1)).optional(),
  })
  .refine((b) => b.tier === 'block' || b.prefixes.length > 0, 'a full-tier building needs a room prefix');

export const buildingSourcesSchema = z
  .array(buildingSourceSchema)
  .refine((list) => new Set(list.map((b) => b.slug)).size === list.length, 'slugs must be unique');

export type BuildingSource = z.infer<typeof buildingSourceSchema>;
