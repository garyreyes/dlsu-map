// The floor-files meeting point between the lanes (docs/SPLIT.md): Lane B's compiler (6b) writes one
// public/data/buildings/<slug>.json per building that has floor files, and Lane A's floor builder and indoor view
// (6c, 7a) read it. Same frame as campus.json. 8a adds rooms, doors, stairs, elevators and the indoor graph as new
// fields, never by changing these.
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

export const indoorSchema = z
  .strictObject({
    /** Building slug, as in campus.json. */
    building: slugSchema,
    /** Only the floors traced so far, lowest first. */
    floors: z.array(indoorFloorSchema).min(1),
  })
  .refine(
    (b) => b.floors.every((f, i) => i === 0 || f.floor > (b.floors[i - 1]?.floor ?? 0)),
    'floors must be lowest first, each once',
  );

export type Indoor = z.infer<typeof indoorSchema>;
export type IndoorFloor = z.infer<typeof indoorFloorSchema>;
