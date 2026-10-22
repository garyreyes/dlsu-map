import { RAIL_ROWS, type RailRow } from './cutaway';

/** Rows a set of floors takes: one per floor, plus a gap row wherever floors are skipped. */
function rowCount(floors: ReadonlySet<number>): number {
  const sorted = [...floors].sort((a, b) => a - b);
  return sorted.reduce((n, f, i) => n + 1 + (i > 0 && f - (sorted[i - 1] ?? f) > 1 ? 1 : 0), 0);
}

/** The floors to show for a tall building: the top, floor 1 and a window around `current`, grown one floor at a
 *  time on the side with the shorter reach, until another floor would not fit in RAIL_ROWS. */
function windowFloors(levels: number, current: number, goal: number | undefined): Set<number> {
  const shown = new Set([levels, 1, current]);
  if (goal !== undefined) shown.add(goal);
  let lo = current;
  let hi = current;
  for (;;) {
    const upFirst = hi - current <= current - lo;
    const options = upFirst ? [hi + 1, lo - 1] : [lo - 1, hi + 1];
    const next = options.find((f) => f >= 1 && f <= levels && rowCount(new Set([...shown, f])) <= RAIL_ROWS);
    if (next === undefined) return shown;
    shown.add(next);
    if (next > hi) hi = next;
    else lo = next;
  }
}

/** The floor rail's rows, highest floor first (7a). Up to RAIL_ROWS floors shows them all; a taller building keeps
 *  its top floor, floor 1 and the goal floor, and a window around `current` with a gap row wherever floors are left
 *  out. The goal floor is marked `goal` unless it is the current one. */
export function railRows(
  levels: number,
  floorLabels: Readonly<Record<string, string>> | undefined,
  traced: readonly number[],
  current: number,
  goal?: number,
): RailRow[] {
  const here = Math.min(Math.max(Math.round(current), 1), levels);
  const there = goal === undefined ? undefined : Math.min(Math.max(Math.round(goal), 1), levels);
  const shown =
    levels <= RAIL_ROWS ? new Set(Array.from({ length: levels }, (_, i) => i + 1)) : windowFloors(levels, here, there);
  const descending = [...shown].sort((a, b) => b - a);
  return descending.flatMap((floor, i): RailRow[] => {
    const row: RailRow = {
      kind: 'floor',
      floor,
      label: floorLabels?.[String(floor)] ?? `${String(floor)}F`,
      traced: traced.includes(floor),
      current: floor === here,
      ...(floor === there && floor !== here ? { goal: true } : {}),
    };
    const above = descending[i - 1];
    return above !== undefined && above - floor > 1 ? [{ kind: 'gap' }, row] : [row];
  });
}
