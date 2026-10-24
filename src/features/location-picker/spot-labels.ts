// S4's Change spot choices as map labels (8▸ critique, P2): the same words as the chips, so a student can tell which
// stairs is which on the map. Pure: no React. Tests: spot-labels.test.ts.
import type { SpotLabel } from '@/shared/data/spot-labels';
import type { SpotChoice } from './spots';

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** One label per choice on the floor; none while they are still loading (null), or when fewer than two are offered:
 *  the step then offers no chips to tell apart. */
export function spotLabelsOf(
  building: string,
  floor: number,
  choices: readonly SpotChoice[] | null,
): readonly SpotLabel[] {
  if (choices === null || choices.length < 2) return [];
  return choices.map((c) => ({ building, floor, spot: c.spot, label: capital(c.label) }));
}
