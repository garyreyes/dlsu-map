// Schema for data-src/floors/<building>/<NN>.json: one floor, traced from its evacuation-map photo by
// tools/floor-extract and cleaned up by Claude (D17). Lines stay in the sign's own coordinates, so cleanup can be
// checked against the photo; the compiler fits them onto the building's OSM outline (D36) and writes meters into
// public/data/buildings/<slug>.json (`indoor.ts`). Rooms, doors, stairs and elevators join in 8a, as new fields.
import { z } from 'zod';

/** 0–1 across the straightened sign, with a little room past the edge: outer walls traced on the frame can land at
 *  -0.001 or 1.001. */
const planNumber = z.number().min(-0.1).max(1.1);

/** A line as flat x, y pairs in sign coordinates: x left → right, y top → bottom of the sign, as photographed. */
const planLine = z
  .array(planNumber)
  .refine((a) => a.length % 2 === 0, 'needs an even number of values (x, y pairs)')
  .refine((a) => a.length >= 4, 'needs at least 2 points');

export const floorSourceSchema = z.strictObject({
  /** Building slug, as in buildings.json. Must match the folder. */
  building: z.string().regex(/^[a-z0-9-]+$/),
  /** Floor number, G = 1. Must match the file name: `03.json` is floor 3. */
  floor: z.int().min(1),
  /** The photo it was traced from, in data-src/photos/ (gitignored): `strc_03F.jpg`. */
  extractedFrom: z.string().regex(/^[^/\\]+\.(jpe?g|png|heic)$/i),
  /** Set by the owner only, after the 3D preview (ARCHITECTURE §4 step 6). */
  checked: z.boolean(),
  /** The straightened sign's size in pixels, as floor-extract wrote it: which of its sides is the long one. */
  plan: z.strictObject({ width: z.int().positive(), height: z.int().positive() }),
  /** How the sign sits on the outline (D36). The outline alone can't tell a sign from the same sign turned round,
   *  so Claude sets the turn by hand and the preview checks it. The sign's long side always lies along the
   *  outline's long side; then `turn: 0` points the sign's top as near north as that allows, and 180 as near
   *  south. */
  fit: z.strictObject({ turn: z.union([z.literal(0), z.literal(180)]) }),
  /** One line per wall: double lines on the sign are already merged into one. */
  walls: z.array(planLine),
  /** The evacuation route line, which runs down the hallways. */
  hallways: z.array(planLine),
});

export type FloorSource = z.infer<typeof floorSourceSchema>;
