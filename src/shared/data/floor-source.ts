// Schema for data-src/floors/<building>/<NN>.json: one floor, traced from its evacuation-map photo by
// tools/floor-extract and cleaned up by Claude (D17). Lines stay in the sign's own coordinates, so cleanup can be
// checked against the photo; the compiler fits them onto the building's OSM outline (D36) and writes meters into
// public/data/buildings/<slug>.json (`indoor.ts`). 8a adds rooms, doors, stairs and elevators, as optional fields, and
// `verticals.json` beside the floor files.
import { z } from './zod.ts';

/** 0–1 across the straightened sign, with a little room past the edge: outer walls traced on the frame can land at
 *  -0.001 or 1.001. */
const planNumber = z.number().min(-0.1).max(1.1);

/** A line as flat x, y pairs in sign coordinates: x left → right, y top → bottom of the sign, as photographed. */
const planLine = z
  .array(planNumber)
  .refine((a) => a.length % 2 === 0, 'needs an even number of values (x, y pairs)')
  .refine((a) => a.length >= 4, 'needs at least 2 points');

/** A point in sign coordinates: [x, y]. */
const planPoint = z.tuple([planNumber, planNumber]);

/** A room code as in rooms.json: canonical (`ST311`, not the printed `C311`), which the compiler checks against the
 *  floor's rooms; this schema can only check its shape. */
const roomCode = z.string().regex(/^[A-Z]+[1-9]\d{2,3}[A-Z]?$/, 'needs a canonical room code like ST311');

/** A stair or elevator's name within its building: `east-stairs`. */
const verticalId = z.string().regex(/^[a-z0-9-]+$/, 'needs lowercase letters, digits and dashes');

const roomPlace = z.strictObject({
  /** Usually one; a combined room drawn as one space has each of its codes here (D18). */
  codes: z.array(roomCode).min(1),
  /** Where its number is printed on the sign. */
  label: planPoint,
  /** Each door to the hallway; a big lab can have two. */
  doors: z.array(planPoint).min(1),
});

const verticalPlace = z.strictObject({
  /** As in the building's verticals.json. */
  id: verticalId,
  /** Where it is on this floor: the middle of the stair or the elevator's ✕-box. */
  point: planPoint,
});

/** True when every value appears once. */
const once = (values: readonly string[]) => new Set(values).size === values.length;

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
  /** Every room on this floor (8a). Left out until the floor is labelled; once here, the room list's rooms on this
   *  floor must all be placed. */
  rooms: z
    .array(roomPlace)
    .refine((rooms) => once(rooms.flatMap((r) => r.codes)), 'each room code once per floor')
    .optional(),
  /** Every stair and elevator that serves this floor (8a). Left out until the floor is labelled. */
  verticals: z
    .array(verticalPlace)
    .refine((vs) => once(vs.map((v) => v.id)), 'each vertical once per floor')
    .optional(),
});

export type FloorSource = z.infer<typeof floorSourceSchema>;

/**
 * data-src/floors/<building>/verticals.json: the building's stairs and elevators and the floors each one stops at.
 * Not left to the floor files, because a sign draws an elevator shaft on every floor, also ones it skips.
 */
export const verticalSourcesSchema = z
  .array(
    z.strictObject({
      id: verticalId,
      kind: z.enum(['stairs', 'elevator']),
      /** Lowest first, each once: `[1, 2, 3, 4]`, or `[1, 3, 4]` for an elevator that skips 2. */
      servesFloors: z
        .array(z.int().min(1))
        .min(2)
        .refine((fs) => fs.every((f, i) => i === 0 || f > (fs[i - 1] ?? 0)), 'lowest first, each floor once'),
    }),
  )
  .refine((vs) => once(vs.map((v) => v.id)), 'each id once');

export type VerticalSource = z.infer<typeof verticalSourcesSchema>[number];
