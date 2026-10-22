// The floor rail (7a): which floor of the entered building the step is on, and how tall the building is. Display
// only (owner's choice, 7a shape brief); the map buttons' column places it, so it rides above the compass.
import type { RailRow } from '../cutaway';

interface Props {
  rows: readonly RailRow[];
  /** How many floors the building has, for the spoken "3 of 4". */
  levels: number;
}

/** The step's floor in a filled Campus Green chip like the floor band's, the goal floor in an outlined chip (the ring
 *  carries it, not colour alone), other traced floors as plain ink text, floors not traced yet muted.
 *  Not interactive; read aloud as one image. */
export function FloorRail({ rows, levels }: Props) {
  const current = rows.find((r) => r.kind === 'floor' && r.current);
  const goal = rows.find((r) => r.kind === 'floor' && r.goal);
  const here =
    current?.kind === 'floor' ? `Floor ${current.label}, ${String(current.floor)} of ${String(levels)}` : 'Floors';
  const description = goal?.kind === 'floor' ? `${here}. Going to ${goal.label}` : here;
  return (
    <div
      role="img"
      aria-label={description}
      className="pointer-events-none flex w-12 flex-col items-center gap-1 rounded-full bg-surface px-1 py-2 shadow-float"
    >
      {rows.map((row, i) =>
        row.kind === 'gap' ? (
          <span key={`gap-${String(i)}`} aria-hidden="true" className="text-base leading-6 text-ink-3">
            ⋮
          </span>
        ) : (
          <span
            key={row.floor}
            aria-hidden="true"
            className={`grid h-8 min-w-10 place-items-center rounded-full px-1 text-base leading-6 ${
              row.current
                ? 'bg-accent font-bold text-white'
                : row.goal
                  ? 'font-bold text-accent ring-2 ring-inset ring-accent'
                  : row.traced
                    ? 'text-ink'
                    : 'text-ink-3'
            }`}
          >
            {row.label}
          </span>
        ),
      )}
    </div>
  );
}
