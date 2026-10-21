// Cleanup of a floor file (D17): delete false walls by their index, add missed ones, redraw the hallways, and place
// the rooms, doors, stairs and elevators (8a). Claude reads the indices and plan px off `review`'s pictures, writes
// them as a spec, and `edit` applies it. Tests: edit.test.ts.
import { floorSourceSchema, roomCode, verticalId, type FloorSource } from '../../src/shared/data/floor-source.ts';
import { z } from '../../src/shared/data/zod.ts';
import { fourDecimals } from './floor-file.ts';

/** A line in plan px, as `review`'s grid labels it: x 0 → plan.width, y 0 → plan.height. */
const pxLine = z
  .array(z.number())
  .refine((a) => a.length % 2 === 0, 'needs an even number of values (x, y pairs)')
  .refine((a) => a.length >= 4, 'needs at least 2 points');

/** A point in plan px: [x, y]. */
const pxPoint = z.tuple([z.number(), z.number()]);

const editSpecSchema = z
  .strictObject({
    /** Indices into the file's walls as it is now, i.e. as the last `review` numbered them. */
    delete: z
      .array(z.int().min(0))
      .check((ctx) => {
        const twice = ctx.value.find((i, at) => ctx.value.indexOf(i) !== at);
        if (twice !== undefined)
          ctx.issues.push({ code: 'custom', message: `wall ${String(twice)} is listed twice`, input: ctx.value });
      })
      .optional(),
    /** New walls, added after the kept ones. */
    add: z.array(pxLine).optional(),
    /** Replaces every hallway line. */
    hallways: z.array(pxLine).optional(),
    /** Replaces every room: canonical codes (`ST204`), where the number is printed, and each door to the hallway. */
    rooms: z
      .array(z.strictObject({ codes: z.array(roomCode).min(1), label: pxPoint, doors: z.array(pxPoint).min(1) }))
      .optional(),
    /** Replaces every stair and elevator: its id in verticals.json and its middle. */
    verticals: z.array(z.strictObject({ id: verticalId, point: pxPoint })).optional(),
  })
  // An empty `hallways`, `rooms` or `verticals` removes them all; empty `delete` and `add` lists do nothing.
  .refine(
    (s) =>
      (s.delete?.length ?? 0) + (s.add?.length ?? 0) > 0 ||
      s.hallways !== undefined ||
      s.rooms !== undefined ||
      s.verticals !== undefined,
    'nothing to change: give delete, add, hallways, rooms or verticals',
  );

export type EditSpec = z.infer<typeof editSpecSchema>;

const issues = (error: z.ZodError) => error.issues.map((i) => `${i.path.join('.') || 'spec'}: ${i.message}`).join('; ');

export function parseEditSpec(json: unknown): EditSpec {
  const parsed = editSpecSchema.safeParse(json);
  if (!parsed.success) throw new Error(issues(parsed.error));
  return parsed.data;
}

export interface Edited {
  readonly file: FloorSource;
  readonly removed: number;
  readonly added: number;
  /** It was checked: the owner's check was of the old walls, so they look again in P1. */
  readonly unchecked: boolean;
}

/** The floor file with the spec applied, checked against the schema the compiler uses. Throws on any mistake. */
export function applyEdit(floor: FloorSource, spec: EditSpec): Edited {
  const name = `${floor.building} ${String(floor.floor)}F`;
  const gone = new Set(spec.delete ?? []);
  for (const i of gone) {
    if (i >= floor.walls.length) {
      throw new Error(`no wall ${String(i)}: ${name} has walls 0–${String(floor.walls.length - 1)}`);
    }
  }
  const { width, height } = floor.plan;
  const toPlan = (line: readonly number[]) => line.map((v, i) => fourDecimals(i % 2 === 0 ? v / width : v / height));
  const point = ([x, y]: readonly [number, number]): [number, number] => [
    fourDecimals(x / width),
    fourDecimals(y / height),
  ];
  const added = (spec.add ?? []).map(toPlan);
  const next = {
    ...floor,
    checked: false,
    walls: [...floor.walls.filter((_, i) => !gone.has(i)), ...added],
    hallways: spec.hallways ? spec.hallways.map(toPlan) : floor.hallways,
    ...(spec.rooms && {
      rooms: spec.rooms.map((r) => ({ codes: r.codes, label: point(r.label), doors: r.doors.map(point) })),
    }),
    ...(spec.verticals && { verticals: spec.verticals.map((v) => ({ id: v.id, point: point(v.point) })) }),
  };
  const parsed = floorSourceSchema.safeParse(next);
  if (!parsed.success) throw new Error(`${name}: ${issues(parsed.error)}`);
  return { file: parsed.data, removed: gone.size, added: added.length, unchecked: floor.checked };
}
