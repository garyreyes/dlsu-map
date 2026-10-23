// Where on a floor S4's Change spot offers to stand (D42, D48): the building's doors on G, and the stairs and
// elevators the building file can place on that floor. Pure: no React, no fetch. Tests: spots.test.ts.
import type { Indoor } from '@/shared/data/indoor';
import type { Spot } from '@/shared/data/route';
import { doorWords, verticalWords } from '@/shared/data/spot-words';
import type { PickerBuilding } from './places';

export interface SpotChoice {
  readonly spot: Spot;
  /** Lower case, as the steps say it: `main entrance facing Agno`, `east stairs`. */
  readonly label: string;
}

type Door = PickerBuilding['doors'][number];

/** Main doors first, then the others; each group keeps campus.json's order. */
const doorChoices = (doors: readonly Door[]): SpotChoice[] =>
  [...doors.filter((d) => d.kind === 'main'), ...doors.filter((d) => d.kind !== 'main')].map((d) => ({
    spot: { kind: 'entrance', entrance: d.entrance },
    label: doorWords(d),
  }));

/** Only a vertical with a stop on the floor: serving it isn't enough, the router can only place a stop. */
function verticalChoices(floor: number, file: Indoor | null): SpotChoice[] {
  const here = (file?.verticals ?? []).filter((v) => v.stops.some((s) => s.floor === floor));
  return [...here.filter((v) => v.kind === 'elevator'), ...here.filter((v) => v.kind === 'stairs')].map((v) => ({
    spot: { kind: 'vertical', id: v.id },
    label: verticalWords(v.id),
  }));
}

/** G: every door, then the verticals; upper floors: the verticals only. Empty when the file isn't there. */
export function spotChoices(doors: readonly Door[], floor: number, file: Indoor | null): SpotChoice[] {
  return [...(floor === 1 ? doorChoices(doors) : []), ...verticalChoices(floor, file)];
}

/** True when some floor would have 2 or more choices, so Change spot is worth showing. */
export function offersSpot(doors: readonly Door[], file: Indoor | null): boolean {
  if (doors.length >= 2) return true;
  const floors = new Set((file?.verticals ?? []).flatMap((v) => v.stops.map((s) => s.floor)));
  return [...floors].some((floor) => spotChoices(doors, floor, file).length >= 2);
}
