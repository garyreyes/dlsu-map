// Route options' door chips as map labels (8▸ critique, P2): each door of the building being left, by the words on
// its chip. Pure: no React. Tests: spot-labels.test.ts.
import type { SpotLabel } from '@/shared/data/spot-labels';
import type { ExitChoices } from './exits';

/** One label per door, on G. The chips' own labels are already capitalised and carry no "(quickest)" tag. */
export function exitSpotLabels(choices: ExitChoices): readonly SpotLabel[] {
  return choices.doors.map((d) => ({
    building: choices.building,
    floor: 1,
    spot: { kind: 'entrance', entrance: d.entrance },
    label: d.label,
  }));
}
