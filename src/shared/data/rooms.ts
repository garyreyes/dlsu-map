// The rooms meeting point between the lanes (docs/SPLIT.md): Lane B's compiler (3b) writes public/data/rooms.json in
// this shape, and Lane A's search and room card (3c, 3d) read it. The loader validates it with roomsSchema.
// Additive changes only: each room's position on its floor joins with the floor files (6d).
import { z } from './zod.ts';

export const roomSchema = z.strictObject({
  /** Canonical code: canonical prefix + number (never starting with 0) + optional capital letter. `ST315A`. That the
   *  prefix is the canonical one (`ST`, not `C`) needs the prefix table, so the compiler checks it, not this schema. */
  code: z.string().regex(/^[A-Z]+[1-9]\d{2,3}[A-Z]?$/),
  /** Building slug, as in campus.json. */
  building: z.string().regex(/^[a-z0-9-]+$/),
  /** The floor the directory or map puts it on (D26), 1 = ground. Usually number ÷ 100, but not always. */
  floor: z.number().int().positive(),
  /** Only where the room's floor reads differently from its building's `floorLabels`: `"G Mezz"` (D26). */
  floorLabel: z.string().min(1).optional(),
  /** As printed on the lobby directory, with obvious spelling fixed. Shared by combined entries (D18). */
  name: z.string().min(1),
});

export const roomsSchema = z.strictObject({
  /**
   * Every room on campus, sorted by code. An array, not an object keyed by code: JSON.parse keeps only the last of
   * two equal keys without a word, while here a duplicate is rejected.
   */
  rooms: z
    .array(roomSchema)
    .min(1)
    .refine((rooms) => new Set(rooms.map((r) => r.code)).size === rooms.length, 'room codes must be unique'),
});

export type Rooms = z.infer<typeof roomsSchema>;
export type Room = z.infer<typeof roomSchema>;
